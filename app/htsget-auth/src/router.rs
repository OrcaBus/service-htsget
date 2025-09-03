//! The htsget auth service axum router.
//!

use crate::config::Config;
use crate::error::Error;
use crate::error::Error::{AuthorizationError, ConfigError};
use crate::error::ErrorResponse;
use crate::error::Result;
use axum::Json;
use axum::Router;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode, Uri};
use axum::routing::get;
use htsget_config::config::advanced::auth::response::{
    AuthorizationRestrictionsBuilder, AuthorizationRuleBuilder, ReferenceNameRestrictionBuilder,
};
use htsget_config::config::advanced::auth::{
    AuthConfigBuilder, AuthMode, AuthorizationRestrictions,
};
use htsget_http::middleware::auth::{Auth, AuthBuilder};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tower::ServiceBuilder;
use tower_http::trace::TraceLayer;
use tracing::trace;
use utoipa::openapi::security::{Http, HttpAuthScheme, SecurityScheme};
use utoipa::{Modify, OpenApi, ToSchema, openapi};
use utoipa_swagger_ui::SwaggerUi;

/// App state containing config.
#[derive(Clone)]
pub struct AppState {
    auth: Arc<Auth>,
}

/// A handler for when a route is not found.
async fn fallback(uri: Uri) -> (StatusCode, String) {
    (StatusCode::NOT_FOUND, format!("No route for {uri}"))
}

/// Create the router for the htsget auth service.
pub fn router(config: Config) -> Result<Router> {
    let mut auth_config = AuthConfigBuilder::default();
    if let Some(subject) = config.validate_subject {
        auth_config = auth_config.validate_subject(subject);
    }
    if let Some(issuer) = config.validate_issuer {
        auth_config = auth_config.validate_issuer(issuer);
    }
    if let Some(audience) = config.validate_audience {
        auth_config = auth_config.validate_audience(audience);
    }
    let auth_config = auth_config
        .authentication_only(true)
        .auth_mode(AuthMode::Jwks(config.jwks_url.clone()))
        .trusted_authorization_url(config.jwks_url)
        .build()
        .map_err(|err| ConfigError(err.to_string()))?;

    let router = Router::default()
        .route("/auth", get(auth))
        .layer(ServiceBuilder::new().layer(TraceLayer::new_for_http()))
        .with_state(AppState {
            auth: Arc::new(
                AuthBuilder::default()
                    .with_config(auth_config)
                    .build()
                    .map_err(|err| ConfigError(err.to_string()))?,
            ),
        });

    Ok(Router::new()
        .nest("/api/v1", router)
        .fallback(fallback)
        .merge(swagger_ui()))
}

/// The htsget authorization restrictions response.
#[derive(Debug, ToSchema, Serialize, Deserialize)]
#[schema(value_type = Value)]
#[serde(transparent, rename_all = "camelCase")]
pub struct AuthResponse(#[schema(inline)] AuthorizationRestrictions);

#[utoipa::path(
    get,
    path = "/auth",
    responses(
        (status = OK, description = "The htsget restrictions for the request", body = AuthResponse),
        Error,
    ),
    context_path = "/api/v1",
    tag = "get",
)]
pub async fn auth(headers: HeaderMap, state: State<AppState>) -> Result<Json<AuthResponse>> {
    trace!("processing htsget auth request");

    let claims = state
        .auth
        .validate_jwt(&headers)
        .await
        .map_err(|err| AuthorizationError(err.to_string()))?;

    let groups = claims
        .claims
        .get("cognito:groups")
        .and_then(|group| group.as_array())
        .map(|groups| {
            groups
                .iter()
                .flat_map(|group| group.as_str())
                .collect::<Vec<_>>()
        })
        .ok_or_else(|| {
            AuthorizationError("invalid cognito groups inside JWT claims".to_string())
        })?;

    let restrictions = if groups.contains(&"admin") {
        AuthorizationRestrictionsBuilder::default()
            .rule(AuthorizationRuleBuilder::default().path(".*").build()?)
            .build()?
    } else if groups.contains(&"curators") {
        let create_rule = |start: u32, end: u32, name: &str| {
            Ok::<_, Error>(
                AuthorizationRuleBuilder::default()
                    .path(".*")
                    .reference_name(
                        ReferenceNameRestrictionBuilder::default()
                            .name(name)
                            .start(start)
                            .end(end)
                            .build()?,
                    )
                    .build()?,
            )
        };
        // https://asia.ensembl.org/Homo_sapiens/Gene/Summary?db=core;g=ENSG00000198804;r=MT:5874-7475;t=ENST00000361624
        AuthorizationRestrictionsBuilder::default()
            .rules(vec![
                // https://asia.ensembl.org/Homo_sapiens/Gene/Summary?db=core;g=ENSG00000198804;r=MT:5874-7475;t=ENST00000361624
                create_rule(5904, 7445, "chrM")?,
                create_rule(5904, 7445, "M")?,
                create_rule(5904, 7445, "chrMT")?,
                create_rule(5904, 7445, "MT")?,
                // https://asia.ensembl.org/Homo_sapiens/Gene/Summary?db=core;g=ENSG00000133703;r=12:25205246-25250936
                create_rule(25205246, 25250936, "chr12")?,
                create_rule(25205246, 25250936, "12")?,
                // https://asia.ensembl.org/Homo_sapiens/Gene/Summary?db=core;g=ENSG00000139618;r=13:32315086-32400268
                create_rule(32315086, 32400268, "chr13")?,
                create_rule(32315086, 32400268, "13")?,
                // https://asia.ensembl.org/Homo_sapiens/Gene/Summary?db=core;g=ENSG00000012048;r=17:43044292-43170245
                create_rule(43044292, 43170245, "chr17")?,
                create_rule(43044292, 43170245, "17")?,
            ])
            .build()?
    } else {
        AuthorizationRestrictionsBuilder::default()
            .rule(AuthorizationRuleBuilder::default().path(".*").build()?)
            .build()?
    };

    Ok(Json(AuthResponse(restrictions)))
}

/// API docs.
#[derive(Debug, OpenApi)]
#[openapi(
    paths(auth),
    components(schemas(AuthResponse, ErrorResponse)),
    modifiers(&SecurityAddon),
    security(("orcabus_api_token" = []))
)]
pub struct ApiDoc;

/// Security add on for the API docs.
#[derive(Debug)]
pub struct SecurityAddon;

impl Modify for SecurityAddon {
    fn modify(&self, openapi: &mut openapi::OpenApi) {
        if let Some(components) = openapi.components.as_mut() {
            components.add_security_scheme(
                "orcabus_api_token",
                SecurityScheme::Http(Http::new(HttpAuthScheme::Bearer)),
            )
        }
    }
}

/// The path to the swagger ui.
pub const SWAGGER_UI_PATH: &str = "/schema/swagger-ui";

/// Create the swagger ui endpoint.
pub fn swagger_ui() -> SwaggerUi {
    SwaggerUi::new(SWAGGER_UI_PATH).url("/schema/openapi.json", ApiDoc::openapi())
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum_test::TestServer;

    fn create_test_config() -> Config {
        Config {
            jwks_url: "https://example.com/.well-known/jwks.json".parse().unwrap(),
            validate_audience: Some(vec!["test-audience".to_string()]),
            validate_issuer: Some(vec!["test-issuer".to_string()]),
            validate_subject: Some("test-subject".to_string()),
        }
    }

    #[tokio::test]
    async fn test_fallback_route() {
        let config = create_test_config();
        let app = router(config).unwrap();
        let server = TestServer::new(app).unwrap();

        let response = server.get("/nonexistent").await;
        assert_eq!(response.status_code(), 404);
    }

    #[tokio::test]
    async fn test_swagger_ui_route() {
        let config = create_test_config();
        let app = router(config).unwrap();
        let server = TestServer::new(app).unwrap();

        let response = server.get("/schema/swagger-ui/").await;
        assert!(response.status_code() == 200 || response.status_code() == 301);
    }
}
