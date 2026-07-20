use std::collections::{BTreeSet, HashMap};
use std::path::PathBuf;
use std::sync::Arc;

use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use tracing::warn;

const DEFAULT_TTL_SECS: i64 = 300;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ModuleSnapshot {
    pub instance: String,
    pub version: Option<String>,
    pub edition: String,
    pub modules: BTreeSet<String>,
    pub refreshed_at: DateTime<Utc>,
    pub checked_at: DateTime<Utc>,
    pub stale: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
}

#[derive(Clone)]
pub struct ModuleSnapshotStore {
    path: Option<PathBuf>,
    snapshots: Arc<RwLock<HashMap<String, ModuleSnapshot>>>,
}

impl ModuleSnapshotStore {
    pub fn from_env() -> Self {
        let path = std::env::var("MCP_TOOLS_JSON")
            .ok()
            .map(PathBuf::from)
            .and_then(|path| {
                path.parent()
                    .map(|parent| parent.join("module-snapshots.json"))
            });
        Self::new(path)
    }

    pub fn memory() -> Self {
        Self::new(None)
    }

    fn new(path: Option<PathBuf>) -> Self {
        let snapshots = path
            .as_ref()
            .and_then(|path| std::fs::read_to_string(path).ok())
            .and_then(|raw| serde_json::from_str(&raw).ok())
            .unwrap_or_default();
        Self {
            path,
            snapshots: Arc::new(RwLock::new(snapshots)),
        }
    }

    pub async fn get(&self, instance: &str) -> Option<ModuleSnapshot> {
        self.snapshots.read().await.get(instance).cloned()
    }

    pub async fn fresh(&self, instance: &str) -> Option<ModuleSnapshot> {
        let snapshot = self.get(instance).await?;
        let ttl = std::env::var("ODOO_MODULE_SNAPSHOT_TTL_SECS")
            .ok()
            .and_then(|value| value.parse().ok())
            .unwrap_or(DEFAULT_TTL_SECS);
        (ttl > 0 && Utc::now() - snapshot.checked_at < Duration::seconds(ttl)).then_some(snapshot)
    }

    pub async fn success(
        &self,
        instance: &str,
        version: Option<String>,
        edition: String,
        modules: BTreeSet<String>,
    ) -> ModuleSnapshot {
        let now = Utc::now();
        let snapshot = ModuleSnapshot {
            instance: instance.to_string(),
            version,
            edition,
            modules,
            refreshed_at: now,
            checked_at: now,
            stale: false,
            last_error: None,
        };
        self.snapshots
            .write()
            .await
            .insert(instance.to_string(), snapshot.clone());
        self.persist().await;
        snapshot
    }

    pub async fn failure(&self, instance: &str, error: &str) -> ModuleSnapshot {
        let now = Utc::now();
        let mut snapshots = self.snapshots.write().await;
        let snapshot = snapshots
            .entry(instance.to_string())
            .and_modify(|snapshot| {
                // Advance checked_at so a down instance counts as "fresh" for one
                // TTL window: this backs off retries instead of re-scanning on every
                // tools/list while the instance is unreachable. The last-known module
                // set is preserved (only stale/last_error change).
                snapshot.checked_at = now;
                snapshot.stale = true;
                snapshot.last_error = Some(error.to_string());
            })
            .or_insert_with(|| ModuleSnapshot {
                instance: instance.to_string(),
                version: None,
                edition: "unknown".to_string(),
                modules: BTreeSet::new(),
                refreshed_at: now,
                checked_at: now,
                stale: true,
                last_error: Some(error.to_string()),
            })
            .clone();
        drop(snapshots);
        self.persist().await;
        snapshot
    }

    pub async fn mark_all_stale(&self) {
        for snapshot in self.snapshots.write().await.values_mut() {
            snapshot.stale = true;
            snapshot.checked_at = DateTime::UNIX_EPOCH;
        }
        self.persist().await;
    }

    async fn persist(&self) {
        let Some(path) = &self.path else { return };
        let snapshots = self.snapshots.read().await.clone();
        let result = serde_json::to_string_pretty(&snapshots)
            .map_err(anyhow::Error::from)
            .and_then(|raw| {
                if let Some(parent) = path.parent() {
                    std::fs::create_dir_all(parent)?;
                }
                std::fs::write(path, raw)?;
                Ok(())
            });
        if let Err(error) = result {
            warn!(path = %path.display(), %error, "failed to persist module snapshots");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn failed_refresh_preserves_last_modules() {
        let store = ModuleSnapshotStore::memory();
        store
            .success(
                "dev",
                Some("18".into()),
                "community".into(),
                BTreeSet::from(["base".into(), "stock".into()]),
            )
            .await;

        let stale = store.failure("dev", "offline").await;

        assert!(stale.stale);
        assert_eq!(stale.last_error.as_deref(), Some("offline"));
        assert_eq!(
            stale.modules,
            BTreeSet::from(["base".into(), "stock".into()])
        );
    }

    #[tokio::test]
    async fn successful_snapshot_persists_as_json() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("module-snapshots.json");
        let store = ModuleSnapshotStore::new(Some(path.clone()));
        store
            .success(
                "dev",
                Some("18".into()),
                "community".into(),
                BTreeSet::from(["base".into()]),
            )
            .await;

        let loaded = ModuleSnapshotStore::new(Some(path))
            .get("dev")
            .await
            .unwrap();

        assert_eq!(loaded.modules, BTreeSet::from(["base".into()]));
        assert!(!loaded.stale);
    }

    #[tokio::test]
    async fn failed_refresh_stays_fresh_for_one_ttl_window() {
        let store = ModuleSnapshotStore::memory();
        store
            .success(
                "dev",
                None,
                "community".into(),
                BTreeSet::from(["base".into()]),
            )
            .await;
        store.failure("dev", "offline").await;

        // checked_at was advanced by the failure, so the stale snapshot is still
        // within the default TTL window and refresh backs off instead of retrying.
        let fresh = store.fresh("dev").await.expect("stale snapshot within TTL");
        assert!(fresh.stale);
        assert_eq!(fresh.modules, BTreeSet::from(["base".into()]));
    }

    #[tokio::test]
    async fn mark_all_stale_forces_refresh() {
        let store = ModuleSnapshotStore::memory();
        store
            .success(
                "dev",
                None,
                "community".into(),
                BTreeSet::from(["base".into()]),
            )
            .await;
        assert!(store.fresh("dev").await.is_some());

        store.mark_all_stale().await;

        // checked_at reset to the epoch, so the snapshot is no longer fresh and a
        // refresh will be attempted, but the last module list is preserved.
        assert!(store.fresh("dev").await.is_none());
        let snapshot = store.get("dev").await.unwrap();
        assert!(snapshot.stale);
        assert_eq!(snapshot.modules, BTreeSet::from(["base".into()]));
    }
}
