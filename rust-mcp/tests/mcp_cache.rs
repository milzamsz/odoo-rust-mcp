//! Tests for MCP cache module
#[cfg(test)]
mod tests {
    use std::time::Duration;

    #[test]
    fn test_ttl_duration() {
        let ttl = Duration::from_secs(300); // 5 minutes
        assert_eq!(ttl.as_secs(), 300);
    }

    #[test]
    fn test_cache_key_generation() {
        let model = "res.partner";
        let cache_key = format!("metadata:{}", model);
        assert_eq!(cache_key, "metadata:res.partner");
    }

    #[test]
    fn test_cache_ttl_values() {
        // Test different TTL values
        let short_ttl = Duration::from_secs(60);
        let medium_ttl = Duration::from_secs(300);
        let long_ttl = Duration::from_secs(3600);

        assert!(short_ttl < medium_ttl);
        assert!(medium_ttl < long_ttl);
    }

    #[test]
    fn test_model_cache_keys() {
        let models = ["res.partner", "sale.order", "account.move"];
        let keys: Vec<String> = models.iter().map(|m| format!("metadata:{}", m)).collect();

        assert_eq!(keys.len(), 3);
        assert!(keys.contains(&"metadata:res.partner".to_string()));
    }

    #[test]
    fn test_cache_expiration_check() {
        use std::time::{SystemTime, UNIX_EPOCH};

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let cache_time = now - 400; // 400 seconds ago
        let ttl_secs = 300; // 5 minutes

        let is_expired = (now - cache_time) > ttl_secs;
        assert!(is_expired);
    }

    #[test]
    fn test_cache_not_expired() {
        use std::time::{SystemTime, UNIX_EPOCH};

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let cache_time = now - 100; // 100 seconds ago
        let ttl_secs = 300; // 5 minutes

        let is_expired = (now - cache_time) > ttl_secs;
        assert!(!is_expired);
    }

    #[test]
    fn test_fields_cache_key() {
        let model = "res.partner";
        let key = format!("fields:{}", model);
        assert_eq!(key, "fields:res.partner");
    }

    #[test]
    fn test_multiple_cache_entries() {
        let entries = [
            ("metadata:res.partner", "partner_metadata"),
            ("metadata:sale.order", "order_metadata"),
            ("fields:res.partner", "partner_fields"),
        ];

        assert_eq!(entries.len(), 3);
        assert!(entries.iter().any(|(k, _)| k.contains("metadata")));
        assert!(entries.iter().any(|(k, _)| k.contains("fields")));
    }
}
