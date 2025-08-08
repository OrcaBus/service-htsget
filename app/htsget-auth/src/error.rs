use std::fmt::{Display, Formatter};
use std::{fmt, io, result};
use axum::http::StatusCode;
use axum::Json;
use axum::response::{IntoResponse, Response};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use utoipa::{IntoResponses, ToSchema};

/// The result type for the htsget axum service.
pub type Result<T> = result::Result<T, Error>;

#[derive(Debug, Error, IntoResponses)]
pub enum Error {
    #[error("config error: {0}")]
    #[response(status = 500)]
    ConfigError(String),
    #[error("io error: {0}")]
    #[response(status = 500)]
    IoError(String),
}

/// The error response format returned in the API.
#[derive(Debug, Serialize, ToSchema, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorResponse {
    #[serde(skip)]
    status_code: StatusCode,
    message: String,
}

impl ErrorResponse {
    /// Create an error response.
    pub fn new(status_code: StatusCode, message: String) -> Self {
        Self { status_code, message }
    }
}

impl Display for ErrorResponse {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        f.write_str(&self.message)
    }
}

impl IntoResponse for ErrorResponse {
    fn into_response(self) -> Response {
        (self.status_code, Json(self)).into_response()
    }
}

impl From<Error> for ErrorResponse {
    fn from(err: Error) -> Self {
        match err {
            Error::ConfigError(_) | Error::IoError(_) => Self::new(StatusCode::INTERNAL_SERVER_ERROR, err.to_string()),
        }
    }
}

impl IntoResponse for Error {
    fn into_response(self) -> Response {
        ErrorResponse::from(self).into_response()
    }
}

impl From<io::Error> for Error {
    fn from(err: io::Error) -> Self {
        Self::IoError(err.to_string())
    }
}
