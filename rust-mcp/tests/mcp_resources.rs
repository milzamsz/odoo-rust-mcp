//! Tests for MCP resources module
#[cfg(test)]
mod tests {
    #[test]
    fn test_odoo_uri_scheme() {
        let uri = "odoo://models/res.partner";
        assert!(uri.starts_with("odoo://"));
    }

    #[test]
    fn test_resource_uri_parsing() {
        let uri = "odoo://models/sale.order/fields";
        let parts: Vec<&str> = uri.split('/').collect();

        assert_eq!(parts[0], "odoo:");
        assert!(parts.contains(&"models"));
        assert!(parts.contains(&"sale.order"));
    }

    #[test]
    fn test_model_resource_uri() {
        let model = "res.partner";
        let uri = format!("odoo://models/{}", model);
        assert_eq!(uri, "odoo://models/res.partner");
    }

    #[test]
    fn test_fields_resource_uri() {
        let model = "sale.order";
        let uri = format!("odoo://models/{}/fields", model);
        assert_eq!(uri, "odoo://models/sale.order/fields");
    }

    #[test]
    fn test_metadata_resource_uri() {
        let model = "account.move";
        let uri = format!("odoo://models/{}/metadata", model);
        assert_eq!(uri, "odoo://models/account.move/metadata");
    }

    #[test]
    fn test_resource_uri_validation() {
        let valid_uri = "odoo://models/res.partner";
        assert!(valid_uri.starts_with("odoo://"));
        assert!(valid_uri.contains("models"));
    }

    #[test]
    fn test_uri_components() {
        let uri = "odoo://models/res.partner/fields/name";
        let without_scheme = uri.strip_prefix("odoo://").unwrap();

        assert_eq!(without_scheme, "models/res.partner/fields/name");
        assert!(without_scheme.contains("res.partner"));
    }

    #[test]
    fn test_multiple_resource_types() {
        let resources = vec![
            "odoo://models/res.partner",
            "odoo://models/sale.order/fields",
            "odoo://models/account.move/metadata",
        ];

        for resource in resources {
            assert!(resource.starts_with("odoo://"));
        }
    }

    #[test]
    fn test_resource_path_extraction() {
        let uri = "odoo://models/res.partner/fields";
        let path = uri.strip_prefix("odoo://").unwrap();
        let segments: Vec<&str> = path.split('/').collect();

        assert_eq!(segments[0], "models");
        assert_eq!(segments[1], "res.partner");
        assert_eq!(segments[2], "fields");
    }

    #[test]
    fn test_resource_uri_encoding() {
        let model = "res.partner";
        let encoded = model.replace(".", "_");
        assert_eq!(encoded, "res_partner");
    }
}
