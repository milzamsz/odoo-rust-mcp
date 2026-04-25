import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import type {
  AlternateInstancesSource,
  InstancesSyncStatusResponse,
  RuntimeSourceKind,
  StatusMessage as StatusMessageType,
  SyncInstancesEnvResponse,
} from '../types';
import { Button } from './Button';
import { Card } from './Card';
import { StatusMessage } from './StatusMessage';

const TOKEN_STORAGE_KEY = 'mcp_config_token';

class HttpResponseError extends Error {
  status: number;
  bodyText: string;

  constructor(message: string, status: number, bodyText = '') {
    super(message);
    this.name = 'HttpResponseError';
    this.status = status;
    this.bodyText = bodyText;
  }
}

function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function handleUnauthorized(response: Response) {
  if (response.status === 401) {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.location.reload();
  }
}

function looksLikeHtml(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  return (
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<body') ||
    trimmed.includes('<head')
  );
}

function extractErrorText(body: unknown): string | null {
  if (typeof body === 'string') {
    const trimmed = body.trim();
    if (!trimmed || looksLikeHtml(trimmed)) {
      return null;
    }
    return trimmed.replace(/\s+/g, ' ');
  }

  if (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof body.error === 'string' &&
    body.error.trim()
  ) {
    return body.error.trim();
  }

  if (
    typeof body === 'object' &&
    body !== null &&
    'message' in body &&
    typeof body.message === 'string' &&
    body.message.trim()
  ) {
    return body.message.trim();
  }

  return null;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);

  if (response.status === 401) {
    handleUnauthorized(response);
    throw new Error('Session expired. Please log in again.');
  }

  const rawText = await response.text().catch(() => '');
  let data: unknown = {};

  if (rawText.trim()) {
    try {
      data = JSON.parse(rawText);
    } catch {
      if (response.ok) {
        throw new HttpResponseError('Invalid JSON response', response.status, rawText);
      }
      data = rawText;
    }
  }

  if (!response.ok) {
    const errorMessage = extractErrorText(data) ?? `HTTP ${response.status}`;
    throw new HttpResponseError(errorMessage, response.status, rawText);
  }

  return data as T;
}

function getSyncFailureMessage(error: unknown): string {
  if (error instanceof HttpResponseError) {
    if (
      error.status === 404 ||
      error.status === 405 ||
      (error.message === 'Invalid JSON response' && looksLikeHtml(error.bodyText))
    ) {
      return 'Sync to Env is not available in the running server build. Restart using the updated MCP server.';
    }

    if (
      error.status === 500 &&
      (!error.message.trim() ||
        error.message === 'Request failed' ||
        error.message === 'HTTP 500')
    ) {
      return 'Sync to Env failed on the server (HTTP 500). Check the server logs and try again.';
    }

    if (
      !error.message.trim() ||
      error.message === 'Request failed' ||
      /^HTTP \d+$/.test(error.message)
    ) {
      return `Sync to Env failed on the server (HTTP ${error.status}). Check the server logs and try again.`;
    }

    if (error.message === 'Invalid JSON response') {
      return 'Sync to Env failed. The running server returned an unexpected response. Restart using the updated MCP server.';
    }

    return `Sync to Env failed: ${error.message}`;
  }

  if (error instanceof TypeError) {
    return 'Sync to Env failed. Could not reach the Config UI API.';
  }

  if (!(error instanceof Error)) {
    return 'Sync to Env failed. The server did not return details. Check the server logs and try again.';
  }

  const message = error.message.trim();
  if (!message || message === 'Request failed') {
    return 'Sync to Env failed. The server did not return details. Check the server logs and try again.';
  }

  if (
    message === 'Failed to fetch' ||
    message.includes('NetworkError') ||
    message.includes('network') ||
    message.includes('fetch')
  ) {
    return 'Sync to Env failed. Could not reach the Config UI API.';
  }

  return `Sync to Env failed: ${message}`;
}

function countSyncStates(instances: InstancesSyncStatusResponse['instances']) {
  return Object.values(instances).reduce(
    (counts, state) => {
      if (state === 'synced') {
        counts.synced += 1;
      } else if (state === 'out_of_sync') {
        counts.outOfSync += 1;
      } else if (state === 'not_synced') {
        counts.notSynced += 1;
      }

      return counts;
    },
    {
      synced: 0,
      outOfSync: 0,
      notSynced: 0,
    }
  );
}

function getRuntimeSourceLabel(kind: RuntimeSourceKind) {
  switch (kind) {
    case 'instances_json':
      return 'Instances JSON';
    case 'inline_env':
      return 'Inline Env Snapshot';
    case 'single_instance':
      return 'Single-Instance Env';
    default:
      return 'Unknown';
  }
}

function getRuntimeSourceDescription(kind: RuntimeSourceKind) {
  switch (kind) {
    case 'instances_json':
      return 'Runtime is reading from a file-backed instances source.';
    case 'inline_env':
      return 'Runtime is reading directly from ODOO_INSTANCES in the env file.';
    case 'single_instance':
      return 'Runtime is using ODOO_URL and related single-instance env vars.';
    default:
      return 'Runtime source is unknown.';
  }
}

export function RuntimeEnvSnapshotCard() {
  const [syncStatus, setSyncStatus] = useState<InstancesSyncStatusResponse | null>(null);
  const [syncStatusError, setSyncStatusError] = useState<string | null>(null);
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [syncingEnv, setSyncingEnv] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [actionStatus, setActionStatus] = useState<StatusMessageType | null>(null);
  const actionStatusTimerRef = useRef<number | null>(null);

  const setTimedActionStatus = useCallback(
    (nextStatus: StatusMessageType, timeoutMs?: number) => {
      if (actionStatusTimerRef.current !== null) {
        window.clearTimeout(actionStatusTimerRef.current);
        actionStatusTimerRef.current = null;
      }

      setActionStatus(nextStatus);

      if (timeoutMs) {
        actionStatusTimerRef.current = window.setTimeout(() => {
          setActionStatus(null);
          actionStatusTimerRef.current = null;
        }, timeoutMs);
      }
    },
    []
  );

  const loadSyncStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const data = await fetchJson<InstancesSyncStatusResponse>(
        '/api/config/instances/sync-status',
        {
          headers: getAuthHeaders(),
        }
      );
      setSyncStatus(data);
      setSyncStatusError(null);
    } catch (error) {
      console.error('Failed to load env sync status:', error);
      setSyncStatus(null);
      setSyncStatusError(
        error instanceof Error ? error.message : 'Failed to load env sync status'
      );
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    void loadSyncStatus();
  }, [loadSyncStatus]);

  useEffect(() => {
    return () => {
      if (actionStatusTimerRef.current !== null) {
        window.clearTimeout(actionStatusTimerRef.current);
      }
    };
  }, []);

  const handleSyncToEnv = async () => {
    setTimedActionStatus(
      {
        message: 'Syncing instances to the env file...',
        type: 'loading',
      },
      undefined
    );
    setSyncingEnv(true);

    try {
      const response = await fetchJson<SyncInstancesEnvResponse>(
        '/api/config/instances/sync-env',
        {
          method: 'POST',
          headers: getAuthHeaders(),
        }
      );

      setSyncStatus({
        configured: response.configured,
        synced_count: response.synced_count,
        total_count: response.total_count,
        instances: response.instances,
        extra_env_instances: response.extra_env_instances,
        runtime_source_kind: response.runtime_source_kind,
        instances_source_path: response.instances_source_path,
        env_file_path: response.env_file_path,
        alternate_sources: response.alternate_sources,
      });
      setSyncStatusError(null);
      setShowSyncConfirm(false);
      setTimedActionStatus(
        {
          message: response.message,
          type: response.restart_required ? 'warning' : 'success',
        },
        response.restart_required ? 7000 : 4000
      );
    } catch (error) {
      console.error('Failed to sync instances to env:', error);
      setTimedActionStatus(
        {
          message: getSyncFailureMessage(error),
          type: 'error',
        },
        undefined
      );
    } finally {
      setSyncingEnv(false);
    }
  };

  const syncCounts = syncStatus ? countSyncStates(syncStatus.instances) : null;
  const instanceCount = syncStatus?.total_count ?? 0;

  return (
    <Card
      title="Runtime & Env Snapshot"
      description="Review where instance configuration is loaded from and sync env-backed launches when needed."
    >
      <div className="space-y-4">
        {actionStatus && (
          <StatusMessage
            status={actionStatus}
            iconOverride={actionStatus.type === 'error' ? AlertTriangle : undefined}
            onDismiss={
              actionStatus.type === 'error' || actionStatus.type === 'warning'
                ? () => setActionStatus(null)
                : undefined
            }
          />
        )}

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-slate-600">
            This operational view lives here so the Odoo Instances page can stay focused on
            finding and editing connections.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setShowSyncConfirm(true)}
              icon={<ArrowLeftRight size={16} />}
              variant="secondary"
              size="sm"
              disabled={instanceCount === 0 || syncingEnv || loadingStatus}
            >
              Sync to Env
            </Button>
            <Button
              onClick={() => {
                void loadSyncStatus();
              }}
              loading={loadingStatus}
              icon={<RefreshCw size={16} />}
              variant="ghost"
              size="sm"
            >
              Refresh
            </Button>
          </div>
        </div>

        <ActiveSourcePanel syncStatus={syncStatus} />
        <SyncSummaryPanel
          syncStatus={syncStatus}
          syncStatusError={syncStatusError}
          syncCounts={syncCounts}
        />
      </div>

      {showSyncConfirm && (
        <SyncToEnvDialog
          instanceCount={instanceCount}
          onConfirm={handleSyncToEnv}
          onCancel={() => setShowSyncConfirm(false)}
          loading={syncingEnv}
        />
      )}
    </Card>
  );
}

function ActiveSourcePanel({
  syncStatus,
}: {
  syncStatus: InstancesSyncStatusResponse | null;
}) {
  if (!syncStatus) {
    return null;
  }

  const alternateSources = syncStatus.alternate_sources ?? [];
  const staleAlternates = alternateSources.filter(
    (source) => source.status === 'stale'
  );

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      role="group"
      aria-label="Active source"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Active Source
          </div>
          <div className="mt-2 text-base font-semibold text-slate-900">
            {getRuntimeSourceLabel(syncStatus.runtime_source_kind)}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {getRuntimeSourceDescription(syncStatus.runtime_source_kind)}
          </p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
          {syncStatus.instances_source_path ? 'File-backed runtime' : 'Env-backed runtime'}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Runtime Path
          </div>
          <div className="mt-2 break-all font-mono text-xs text-slate-700">
            {syncStatus.instances_source_path ?? 'Not using an instances.json file'}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Env File
          </div>
          <div className="mt-2 break-all font-mono text-xs text-slate-700">
            {syncStatus.env_file_path}
          </div>
        </div>
      </div>

      {alternateSources.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
            <AlertTriangle size={12} />
            Alternate Sources
          </div>
          <div className="mt-2 space-y-2 text-sm text-amber-900">
            {alternateSources.map((source: AlternateInstancesSource) => (
              <div key={source.path} className="flex items-start justify-between gap-3">
                <code className="break-all text-xs">{source.path}</code>
                <span className="rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                  {source.status === 'matches_runtime'
                    ? 'Matches runtime'
                    : source.status === 'unreadable'
                      ? 'Unreadable'
                      : 'Stale'}
                </span>
              </div>
            ))}
          </div>
          {staleAlternates.length > 0 && (
            <p className="mt-3 text-sm text-amber-800">
              At least one alternate `instances.json` disagrees with the active runtime source.
              This is usually where naming confusion comes from in local launches.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SyncSummaryPanel({
  syncStatus,
  syncStatusError,
  syncCounts,
}: {
  syncStatus: InstancesSyncStatusResponse | null;
  syncStatusError: string | null;
  syncCounts: ReturnType<typeof countSyncStates> | null;
}) {
  if (!syncStatus || !syncCounts) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-orange-50 p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-amber-100 p-2 text-amber-700">
            <AlertTriangle size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
              Env Snapshot Unavailable
            </div>
            <p className="mt-2 text-sm font-medium text-slate-800">
              Sync status could not be loaded right now.
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {syncStatusError ?? 'Unable to read env sync status from the running server.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const progressPercent =
    syncStatus.total_count > 0 ? Math.round((syncStatus.synced_count / syncStatus.total_count) * 100) : 0;
  const summaryCopy = syncStatus.configured
    ? 'The env file already contains an ODOO_INSTANCES snapshot. Sync after changes when you need env-based launches to mirror the active UI config.'
    : 'No ODOO_INSTANCES snapshot is saved yet. Use Sync to Env when you want env-based launches to mirror the active UI configuration.';

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 via-white to-blue-50 p-4 shadow-sm"
      role="group"
      aria-label="Env sync summary"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            <span className="rounded-full bg-blue-100 p-1.5 text-blue-600">
              <ArrowLeftRight size={12} />
            </span>
            Env Snapshot
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-slate-900">
              {syncStatus.synced_count}/{syncStatus.total_count}
            </span>
            <span className="text-sm font-medium text-slate-600">synced</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <SyncStatPill label="Synced" count={syncCounts.synced} tone="green" />
          <SyncStatPill label="Out of sync" count={syncCounts.outOfSync} tone="amber" />
          <SyncStatPill label="Not synced" count={syncCounts.notSynced} tone="slate" />
        </div>
      </div>

      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500 transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <p className="mt-3 text-sm text-slate-600">{summaryCopy}</p>

      {syncStatus.extra_env_instances.length > 0 && (
        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
          <AlertTriangle size={12} />
          Env-only instances: {syncStatus.extra_env_instances.join(', ')}
        </div>
      )}
    </div>
  );
}

function SyncStatPill({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: 'green' | 'amber' | 'slate';
}) {
  const toneClasses = {
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    slate: 'border-slate-200 bg-slate-100 text-slate-700',
  };

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${toneClasses[tone]}`}
      aria-label={`${label}: ${count}`}
    >
      <CheckCircle2 size={12} className={tone === 'green' ? '' : 'opacity-50'} />
      <span>{count}</span>
      <span>{label}</span>
    </div>
  );
}

interface SyncToEnvDialogProps {
  instanceCount: number;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

function SyncToEnvDialog({
  instanceCount,
  onConfirm,
  onCancel,
  loading,
}: SyncToEnvDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-lg rounded-xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 p-2">
              <AlertTriangle size={20} className="text-amber-700" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Sync Instances to Env</h3>
              <p className="text-sm text-gray-500">
                Capture {instanceCount} instance{instanceCount !== 1 ? 's' : ''} as an env
                snapshot.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-6">
          <p className="text-sm text-gray-700">
            This saves the current Config UI instances into the <code>env</code> file as inline{' '}
            <code>ODOO_INSTANCES</code> JSON for launch modes that read from env snapshots.
          </p>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-medium">Before you continue:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Instance credentials will be written into the env file.</li>
              <li>This is a bulk action for all configured instances.</li>
              <li>File-backed runtimes stay on the active instances file unless relaunched differently.</li>
              <li>Env-based launches may need a restart before they pick up the new snapshot.</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-200 p-6">
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={onConfirm}
            loading={loading}
            icon={<ArrowLeftRight size={16} />}
          >
            Sync to Env
          </Button>
        </div>
      </div>
    </div>
  );
}
