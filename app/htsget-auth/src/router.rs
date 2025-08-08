//! The htsget auth service axum router.
//!

use crate::error::ErrorResponse;
use axum::http::{StatusCode, Uri};
use axum::Router;
use axum::routing::get;
use tower::ServiceBuilder;
use tower_http::trace::TraceLayer;
use utoipa::{openapi, Modify, OpenApi};
use utoipa::openapi::security::{Http, HttpAuthScheme, SecurityScheme};
use utoipa_swagger_ui::SwaggerUi;
use crate::config::Config;
use crate::error::Result;
use crate::error::Error;
use tracing::trace;

/// A handler for when a route is not found.
async fn fallback(uri: Uri) -> (StatusCode, String) {
    (StatusCode::NOT_FOUND, format!("No route for {uri}"))
}

/// Create the router for the htsget auth service.
pub fn router(config: Config) -> Router {
    Router::default()
        .route(
            "/auth",
            get(auth),
        )
        .fallback(fallback)
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
        )
        // .layer(AuthLayer::from(
        //     AuthBuilder::default().with_config(auth).build()?,
        // ))
        .merge(swagger_ui())
}

#[utoipa::path(
    get,
    path = "/auth",
    responses(
        (status = OK, description = "The htsget restrictions for the request", body = ()),
        Error,
    ),
    context_path = "/api/v1",
    tag = "get",
)]
pub async fn auth() -> Result<()> {
    trace!("processing htsget auth request");
    Ok(())
}

/// API docs.
#[derive(Debug, OpenApi)]
#[openapi(
    paths(auth),
    components(schemas(ErrorResponse)),
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
