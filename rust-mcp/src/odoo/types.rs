use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OdooErrorBody {
    pub name: Option<String>,
    pub message: Option<String>,
    #[serde(default)]
    pub arguments: Vec<Value>,
    #[serde(default)]
    pub context: Value,
    pub debug: Option<String>,
}

#[derive(Debug, thiserror::Error)]
pub enum OdooError {
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("Odoo API error (status {status}): {message}")]
    Api {
        status: u16,
        message: String,
        body: Option<OdooErrorBody>,
    },

    #[error("Invalid response: {0}")]
    InvalidResponse(String),
}

pub type OdooResult<T> = Result<T, OdooError>;

