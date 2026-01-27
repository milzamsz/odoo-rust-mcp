//! Tests for cleanup database module
#[cfg(test)]
mod tests {
    use rust_mcp::cleanup::database::{
        CleanupDetail, CleanupOptions, CleanupReport, CleanupReportSummary,
    };

    #[test]
    fn test_cleanup_options_creation() {
        let options = CleanupOptions {
            remove_test_data: Some(true),
            remove_inactive_records: Some(false),
            cleanup_drafts: Some(true),
            archive_old_records: Some(true),
            optimize_database: Some(false),
            days_threshold: Some(30),
            dry_run: Some(true),
        };

        assert_eq!(options.remove_test_data, Some(true));
        assert_eq!(options.days_threshold, Some(30));
        assert_eq!(options.dry_run, Some(true));
    }

    #[test]
    fn test_cleanup_options_default_values() {
        let options = CleanupOptions {
            remove_test_data: None,
            remove_inactive_records: None,
            cleanup_drafts: None,
            archive_old_records: None,
            optimize_database: None,
            days_threshold: None,
            dry_run: Some(false),
        };

        assert!(options.remove_test_data.is_none());
        assert!(options.days_threshold.is_none());
        assert_eq!(options.dry_run, Some(false));
    }

    #[test]
    fn test_cleanup_report_summary() {
        let summary = CleanupReportSummary {
            test_data_removed: 150,
            inactive_records_archived: 300,
            drafts_cleaned: 50,
            orphan_records_removed: 25,
            logs_cleaned: 1000,
            attachments_cleaned: 75,
            cache_cleared: true,
            total_records_processed: 1600,
        };

        assert_eq!(summary.test_data_removed, 150);
        assert_eq!(summary.total_records_processed, 1600);
        assert!(summary.cache_cleared);
    }

    #[test]
    fn test_cleanup_detail_creation() {
        let detail = CleanupDetail {
            operation: "remove_test_data".to_string(),
            model: "res.partner".to_string(),
            records_affected: 50,
            details: "Removed 50 test partners".to_string(),
            status: "success".to_string(),
        };

        assert_eq!(detail.operation, "remove_test_data");
        assert_eq!(detail.model, "res.partner");
        assert_eq!(detail.records_affected, 50);
        assert_eq!(detail.status, "success");
    }

    #[test]
    fn test_cleanup_report_success() {
        let report = CleanupReport {
            success: true,
            timestamp: "2026-01-27T10:00:00Z".to_string(),
            summary: CleanupReportSummary {
                test_data_removed: 100,
                inactive_records_archived: 200,
                drafts_cleaned: 30,
                orphan_records_removed: 10,
                logs_cleaned: 500,
                attachments_cleaned: 25,
                cache_cleared: true,
                total_records_processed: 865,
            },
            details: vec![],
            warnings: vec![],
            errors: vec![],
            dry_run: false,
        };

        assert!(report.success);
        assert!(!report.dry_run);
        assert_eq!(report.summary.total_records_processed, 865);
        assert!(report.errors.is_empty());
    }

    #[test]
    fn test_cleanup_report_with_warnings() {
        let report = CleanupReport {
            success: true,
            timestamp: "2026-01-27T10:00:00Z".to_string(),
            summary: CleanupReportSummary {
                test_data_removed: 0,
                inactive_records_archived: 0,
                drafts_cleaned: 0,
                orphan_records_removed: 0,
                logs_cleaned: 0,
                attachments_cleaned: 0,
                cache_cleared: false,
                total_records_processed: 0,
            },
            details: vec![],
            warnings: vec![
                "No test data found".to_string(),
                "Some records locked".to_string(),
            ],
            errors: vec![],
            dry_run: true,
        };

        assert!(report.success);
        assert!(report.dry_run);
        assert_eq!(report.warnings.len(), 2);
        assert!(report.warnings.contains(&"No test data found".to_string()));
    }

    #[test]
    fn test_cleanup_report_with_errors() {
        let report = CleanupReport {
            success: false,
            timestamp: "2026-01-27T10:00:00Z".to_string(),
            summary: CleanupReportSummary {
                test_data_removed: 0,
                inactive_records_archived: 0,
                drafts_cleaned: 0,
                orphan_records_removed: 0,
                logs_cleaned: 0,
                attachments_cleaned: 0,
                cache_cleared: false,
                total_records_processed: 0,
            },
            details: vec![],
            warnings: vec![],
            errors: vec!["Permission denied".to_string()],
            dry_run: false,
        };

        assert!(!report.success);
        assert_eq!(report.errors.len(), 1);
        assert_eq!(report.errors[0], "Permission denied");
    }

    #[test]
    fn test_cleanup_detail_error_status() {
        let detail = CleanupDetail {
            operation: "archive_old_records".to_string(),
            model: "mail.message".to_string(),
            records_affected: 0,
            details: "Failed to archive records".to_string(),
            status: "error".to_string(),
        };

        assert_eq!(detail.status, "error");
        assert_eq!(detail.records_affected, 0);
    }

    #[test]
    fn test_cleanup_detail_warning_status() {
        let detail = CleanupDetail {
            operation: "cleanup_drafts".to_string(),
            model: "sale.order".to_string(),
            records_affected: 5,
            details: "Some drafts could not be deleted".to_string(),
            status: "warning".to_string(),
        };

        assert_eq!(detail.status, "warning");
        assert_eq!(detail.records_affected, 5);
    }

    #[test]
    fn test_cleanup_options_serialization() {
        let options = CleanupOptions {
            remove_test_data: Some(true),
            remove_inactive_records: Some(true),
            cleanup_drafts: Some(false),
            archive_old_records: Some(true),
            optimize_database: Some(true),
            days_threshold: Some(90),
            dry_run: Some(false),
        };

        let json = serde_json::to_string(&options).unwrap();
        assert!(json.contains("remove_test_data"));
        assert!(json.contains("days_threshold"));
    }

    #[test]
    fn test_cleanup_report_serialization() {
        let report = CleanupReport {
            success: true,
            timestamp: "2026-01-27T10:00:00Z".to_string(),
            summary: CleanupReportSummary {
                test_data_removed: 10,
                inactive_records_archived: 20,
                drafts_cleaned: 5,
                orphan_records_removed: 2,
                logs_cleaned: 100,
                attachments_cleaned: 15,
                cache_cleared: true,
                total_records_processed: 152,
            },
            details: vec![],
            warnings: vec![],
            errors: vec![],
            dry_run: false,
        };

        let json = serde_json::to_string(&report).unwrap();
        assert!(json.contains("success"));
        assert!(json.contains("timestamp"));
        // CleanupReportSummary uses camelCase
        assert!(json.contains("totalRecordsProcessed"));
    }
}
