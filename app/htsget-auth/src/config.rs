//! Handles loading environment variables as config options for htsget auth.
//!

use crate::error::Error::ConfigError;
use crate::error::Result;
use axum::http::Uri;
use envy::prefixed;
use serde::Deserialize;
use tracing_subscriber::EnvFilter;
use tracing_subscriber::fmt::layer;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;

/// Configuration environment variables for htsget auth.
#[derive(Debug, Clone, Deserialize, Eq, PartialEq)]
pub struct Config {
    #[serde(with = "http_serde::uri")]
    pub(crate) jwks_url: Uri,
    pub(crate) validate_audience: Option<Vec<String>>,
    pub(crate) validate_issuer: Option<Vec<String>>,
    pub(crate) validate_subject: Option<String>,
}

pub const CONFIG_PREFIX: &str = "HTSGET_AUTH_";

impl Config {
    /// Load environment variables into a `Config` struct.
    pub fn load() -> Result<Self> {
        prefixed(CONFIG_PREFIX)
            .from_env::<Self>()
            .map_err(|err| ConfigError(err.to_string()))
    }

    /// Initialize the default tracing subscriber for logs.
    pub fn init_tracing() {
        let env_filter =
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));

        tracing_subscriber::registry()
            .with(layer().compact())
            .with(env_filter)
            .init();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_environment() {
        let data = vec![
            ("HTSGET_AUTH_JWKS_URL", "https://example.com"),
            ("HTSGET_AUTH_VALIDATE_AUDIENCE", "aud1,aud2"),
            ("HTSGET_AUTH_VALIDATE_ISSUER", "iss1,iss2"),
            ("HTSGET_AUTH_VALIDATE_SUBJECT", "sub"),
        ]
        .into_iter()
        .map(|(key, value)| (key.to_string(), value.to_string()));

        let config: Config = prefixed(CONFIG_PREFIX).from_iter(data).unwrap();

        assert_eq!(
            config,
            Config {
                jwks_url: "https://example.com".parse().unwrap(),
                validate_audience: Some(vec!["aud1".to_string(), "aud2".to_string()]),
                validate_issuer: Some(vec!["iss1".to_string(), "iss2".to_string()]),
                validate_subject: Some("sub".to_string()),
            }
        )
    }
}
