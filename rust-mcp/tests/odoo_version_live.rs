//! Live version/edition detection against real Odoo servers. Ignored by default.
//!
//! ODOO_E2E_VERSION_URLS="http://127.0.0.1:20069=20:community,http://127.0.0.1:20070=20:enterprise" \
//!   cargo test --test odoo_version_live -- --ignored --nocapture

use rust_mcp::odoo::version::{OdooVersion, fetch_version_info};
use url::Url;

#[tokio::test]
#[ignore]
async fn test_should_detect_live_server_version_and_edition() {
    let spec = std::env::var("ODOO_E2E_VERSION_URLS").expect("set ODOO_E2E_VERSION_URLS");
    let http = reqwest::Client::new();
    for entry in spec.split(',') {
        let (url, expected) = entry.split_once('=').expect("url=major:edition");
        let (major, edition) = expected.split_once(':').expect("major:edition");
        let info = fetch_version_info(&http, &Url::parse(url).unwrap())
            .await
            .unwrap_or_else(|e| panic!("{url}: {e}"));
        println!("{url}: {info:?}");
        let version = OdooVersion::parse(&info.server_version).expect("parsable server_version");
        assert_eq!(version.major.to_string(), major, "{url}");
        assert_eq!(info.enterprise_marker, edition == "enterprise", "{url}");
    }
}
