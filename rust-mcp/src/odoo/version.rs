use serde_json::{Value, json};
use url::Url;

use crate::odoo::types::{OdooError, OdooResult};

/// Parsed Odoo server series. Ordered by (major, minor), so `saas~19.3` sorts
/// between `19.0` and `20.0`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct OdooVersion {
    pub major: u32,
    pub minor: u32,
}

impl OdooVersion {
    /// Accepts "18", "18.0", "18.0+e", "18.0+e-20260703", "20.0-20261029", "saas~19.3", "saas~19.3+e".
    pub fn parse(raw: &str) -> Option<Self> {
        let raw = raw.trim();
        let raw = raw.strip_prefix("saas~").unwrap_or(raw);
        // Drop "+e" and build-date suffixes ("20.0-20261029").
        let raw = raw.split(['+', '-']).next().unwrap_or(raw);
        let mut parts = raw.split('.');
        let major = parts.next()?.trim().parse().ok()?;
        let minor = match parts.next() {
            Some(minor) => minor.trim().parse().ok()?,
            None => 0,
        };
        Some(Self { major, minor })
    }

    pub fn at_least(self, major: u32, minor: u32) -> bool {
        self >= Self { major, minor }
    }
}

/// What `/web/webclient/version_info` reports about the server.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ServerVersionInfo {
    /// Raw `server_version`, e.g. "20.0" or "saas~19.3+e".
    pub server_version: String,
    /// True when the server marks itself Enterprise ("+e" or a trailing "e" in version_info).
    pub enterprise_marker: bool,
}

impl ServerVersionInfo {
    pub fn from_result(result: &Value) -> OdooResult<Self> {
        let server_version = result
            .get("server_version")
            .and_then(Value::as_str)
            .ok_or_else(|| {
                OdooError::InvalidResponse("version_info has no server_version".to_string())
            })?
            .to_string();
        let marker_in_info = result
            .get("server_version_info")
            .and_then(Value::as_array)
            .and_then(|info| info.get(5))
            .and_then(Value::as_str)
            == Some("e");
        Ok(Self {
            enterprise_marker: marker_in_info || server_version.contains("+e"),
            server_version,
        })
    }
}

/// Calls the unauthenticated `/web/webclient/version_info` route (Odoo 16-20).
pub async fn fetch_version_info(
    http: &reqwest::Client,
    base_url: &Url,
) -> OdooResult<ServerVersionInfo> {
    let mut url = base_url.clone();
    url.set_path("/web/webclient/version_info");
    let body: Value = http
        .post(url)
        .json(&json!({"jsonrpc": "2.0", "method": "call", "params": {}}))
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    if let Some(error) = body.get("error") {
        return Err(OdooError::InvalidResponse(format!(
            "version_info failed: {error}"
        )));
    }
    ServerVersionInfo::from_result(body.get("result").unwrap_or(&Value::Null))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn v(major: u32, minor: u32) -> Option<OdooVersion> {
        Some(OdooVersion { major, minor })
    }

    #[test]
    fn test_should_parse_every_known_version_form() {
        assert_eq!(OdooVersion::parse("18"), v(18, 0));
        assert_eq!(OdooVersion::parse("18.0"), v(18, 0));
        assert_eq!(OdooVersion::parse("18.0+e"), v(18, 0));
        assert_eq!(OdooVersion::parse("18.0+e-20260703"), v(18, 0));
        assert_eq!(OdooVersion::parse("20.0-20261029"), v(20, 0));
        assert_eq!(OdooVersion::parse(" 20 "), v(20, 0));
        assert_eq!(OdooVersion::parse("20.0"), v(20, 0));
        assert_eq!(OdooVersion::parse("saas~19.3"), v(19, 3));
        assert_eq!(OdooVersion::parse("saas~19.3+e"), v(19, 3));
        assert_eq!(OdooVersion::parse("v18"), None);
        assert_eq!(OdooVersion::parse(""), None);
    }

    #[test]
    fn test_should_order_saas_between_majors() {
        let saas = OdooVersion::parse("saas~19.3").unwrap();
        assert!(saas > OdooVersion::parse("19.0").unwrap());
        assert!(saas < OdooVersion::parse("20.0").unwrap());
        assert!(saas.at_least(19, 3));
        assert!(!saas.at_least(19, 4));
    }

    #[test]
    fn test_should_detect_enterprise_marker() {
        let online = json!({"server_version": "saas~19.3+e",
            "server_version_info": ["saas~19", 3, 0, "final", 0, "e"]});
        assert!(
            ServerVersionInfo::from_result(&online)
                .unwrap()
                .enterprise_marker
        );
        let ce = json!({"server_version": "20.0",
            "server_version_info": [20, 0, 0, "final", 0, ""]});
        let ce = ServerVersionInfo::from_result(&ce).unwrap();
        assert!(!ce.enterprise_marker);
        assert_eq!(ce.server_version, "20.0");
        assert!(ServerVersionInfo::from_result(&json!({})).is_err());
    }
}
