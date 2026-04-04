import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  Database,
  Download,
  Edit2,
  Key,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  User,
  Wifi,
  XCircle,
} from 'lucide-react';
import { useConfig } from '../../hooks/useConfig';
import { countEnabledToolsForInstance } from '../../toolGroups';
import type {
  InstanceConfig,
  InstanceEnvSyncState,
  InstancesSyncStatusResponse,
  StatusMessage as StatusMessageType,
  SyncInstancesEnvResponse,
  ToolConfig,
} from '../../types';
import { Button } from '../Button';
import { Card } from '../Card';
import { InstanceForm } from '../InstanceForm';
import { StatusMessage } from '../StatusMessage';

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

type ConnStatus =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'ok'; latency: number }
  | { status: 'error'; error: string };

type ImportMode = 'merge' | 'replace';

interface ImportPreview {
  incoming: InstanceConfig;
  conflicts: string[];
  newNames: string[];
  mode: ImportMode;
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

export function InstancesTab() {
  const { load, save, status, loading } = useConfig('instances');
  const { load: loadTools, loading: toolsLoading } = useConfig('tools');
  const [config, setConfig] = useState<InstanceConfig>({});
  const [availableTools, setAvailableTools] = useState<ToolConfig[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [connStatuses, setConnStatuses] = useState<Record<string, ConnStatus>>({});
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<InstancesSyncStatusResponse | null>(null);
  const [syncStatusError, setSyncStatusError] = useState<string | null>(null);
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [syncingEnv, setSyncingEnv] = useState(false);
  const [actionStatus, setActionStatus] = useState<StatusMessageType | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    return () => {
      if (actionStatusTimerRef.current !== null) {
        window.clearTimeout(actionStatusTimerRef.current);
      }
    };
  }, []);

  const loadInstances = useCallback(async () => {
    try {
      const data = (await load()) as InstanceConfig;
      setConfig(data);
      setConnStatuses({});
    } catch (error) {
      console.error('Failed to load instances:', error);
    }
  }, [load]);

  const loadAvailableTools = useCallback(async () => {
    try {
      const data = (await loadTools()) as ToolConfig[];
      setAvailableTools(data);
    } catch (error) {
      console.error('Failed to load tools for instance overrides:', error);
      setAvailableTools([]);
    }
  }, [loadTools]);

  const loadSyncStatus = useCallback(async () => {
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
    }
  }, []);

  const refreshData = useCallback(async () => {
    await Promise.all([loadInstances(), loadAvailableTools(), loadSyncStatus()]);
  }, [loadAvailableTools, loadInstances, loadSyncStatus]);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  const handleExport = () => {
    const json = JSON.stringify(config, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `odoo-instances-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    setImportError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    event.target.value = '';

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const parsed = JSON.parse(loadEvent.target?.result as string);
        if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
          setImportError(
            'Invalid file: expected a JSON object mapping instance names to configs.'
          );
          return;
        }

        const incoming = parsed as InstanceConfig;
        const existingNames = new Set(Object.keys(config));
        const conflicts = Object.keys(incoming).filter((name) => existingNames.has(name));
        const newNames = Object.keys(incoming).filter((name) => !existingNames.has(name));
        setImportPreview({ incoming, conflicts, newNames, mode: 'merge' });
        setImportError(null);
      } catch {
        setImportError('Invalid JSON file. Please select a valid instances export.');
      }
    };
    reader.readAsText(file);
  };

  const handleImportConfirm = async () => {
    if (!importPreview) {
      return;
    }

    try {
      const merged =
        importPreview.mode === 'replace'
          ? { ...importPreview.incoming }
          : { ...config, ...importPreview.incoming };
      await save(merged);
      await refreshData();
      setImportPreview(null);
    } catch (error) {
      console.error('Failed to import instances:', error);
    }
  };

  const testConnection = async (name: string) => {
    setConnStatuses((previous) => ({ ...previous, [name]: { status: 'checking' } }));

    try {
      const data = await fetchJson<{ ok: boolean; latency_ms?: number; error?: string }>(
        `/api/config/instances/${encodeURIComponent(name)}/test`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
        }
      );

      if (data.ok) {
        setConnStatuses((previous) => ({
          ...previous,
          [name]: { status: 'ok', latency: data.latency_ms ?? 0 },
        }));
      } else {
        setConnStatuses((previous) => ({
          ...previous,
          [name]: { status: 'error', error: data.error ?? 'Connection failed' },
        }));
      }
    } catch (error) {
      setConnStatuses((previous) => ({
        ...previous,
        [name]: {
          status: 'error',
          error: error instanceof Error ? error.message : 'Network error',
        },
      }));
    }
  };

  const testAll = async () => {
    const names = Object.keys(config);
    await Promise.all(names.map((name) => testConnection(name)));
  };

  const handleAdd = () => {
    setEditingName(null);
    setShowForm(true);
  };

  const handleEdit = (name: string) => {
    setEditingName(name);
    setShowForm(true);
  };

  const handleDelete = async (name: string) => {
    if (!window.confirm(`Are you sure you want to delete the instance "${name}"?`)) {
      return;
    }

    try {
      const updatedConfig = { ...config };
      delete updatedConfig[name];
      await save(updatedConfig);
      await refreshData();
    } catch (error) {
      console.error('Failed to delete instance:', error);
    }
  };

  const handleSaveInstance = async (name: string, data: InstanceConfig[string]) => {
    try {
      const updatedConfig = { ...config };
      if (editingName && editingName !== name) {
        delete updatedConfig[editingName];
      }

      updatedConfig[name] = data;
      await save(updatedConfig);
      await refreshData();
      setShowForm(false);
      setEditingName(null);
    } catch (error) {
      console.error('Failed to save instance:', error);
    }
  };

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
      });
      setSyncStatusError(null);
      await loadInstances();
      setShowSyncConfirm(false);
      setTimedActionStatus(
        {
          message: response.message,
          type: 'success',
        },
        6000
      );
    } catch (error) {
      console.error('Failed to sync instances to env:', error);
      setTimedActionStatus(
        {
          message: getSyncFailureMessage(error),
          type: 'error',
        },
        6000
      );
    } finally {
      setSyncingEnv(false);
    }
  };

  const instances = Object.entries(config);
  const existingNames = Object.keys(config);
  const isBusy = loading || toolsLoading || syncingEnv;
  const activeStatus = actionStatus ?? status;
  const syncCounts = syncStatus ? countSyncStates(syncStatus.instances) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Odoo Instances</h2>
          <p className="mt-2 text-gray-600">
            Configure your Odoo instance connections. Changes are applied immediately with hot
            reload.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap" role="group" aria-label="Page actions">
          <Button
            onClick={handleImportClick}
            icon={<Upload size={16} />}
            variant="ghost"
            disabled={isBusy}
          >
            Import
          </Button>
          <Button
            onClick={handleExport}
            icon={<Download size={16} />}
            variant="ghost"
            disabled={instances.length === 0 || isBusy}
          >
            Export
          </Button>
          <Button
            onClick={handleAdd}
            icon={<Plus size={18} />}
            variant="primary"
            disabled={isBusy}
          >
            Add Instance
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileChange}
      />

      {activeStatus && (
        <StatusMessage
          status={activeStatus}
          iconOverride={actionStatus?.type === 'error' ? AlertTriangle : undefined}
          onDismiss={
            activeStatus.type === 'error' || activeStatus.type === 'warning'
              ? () => setActionStatus(null)
              : undefined
          }
        />
      )}

      {importError && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <XCircle size={16} className="flex-shrink-0" />
          {importError}
          <button
            onClick={() => setImportError(null)}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            x
          </button>
        </div>
      )}

      {importPreview && (
        <ImportConfirmDialog
          preview={importPreview}
          onModeChange={(mode) =>
            setImportPreview((previous) => (previous ? { ...previous, mode } : previous))
          }
          onConfirm={handleImportConfirm}
          onCancel={() => setImportPreview(null)}
          loading={isBusy}
        />
      )}

      {showSyncConfirm && (
        <SyncToEnvDialog
          instanceCount={instances.length}
          onConfirm={handleSyncToEnv}
          onCancel={() => setShowSyncConfirm(false)}
          loading={syncingEnv}
        />
      )}

      <Card>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div className="min-w-[280px] flex-1">
            <h3 className="text-lg font-semibold text-gray-900">
              Configured Instances ({instances.length})
            </h3>
            <SyncSummaryPanel
              syncStatus={syncStatus}
              syncStatusError={syncStatusError}
              syncCounts={syncCounts}
            />
          </div>
          <div
            className="flex gap-2 flex-wrap"
            role="group"
            aria-label="Instance table actions"
          >
            <Button
              onClick={() => setShowSyncConfirm(true)}
              icon={<ArrowLeftRight size={16} />}
              variant="secondary"
              size="sm"
              disabled={instances.length === 0 || isBusy}
            >
              Sync to Env
            </Button>
            {instances.length > 0 && (
              <Button onClick={testAll} icon={<Wifi size={16} />} variant="ghost" size="sm">
                Test All
              </Button>
            )}
            <Button
              onClick={() => {
                void refreshData();
              }}
              loading={loading || toolsLoading}
              icon={<RefreshCw size={16} />}
              variant="ghost"
              size="sm"
            >
              Refresh
            </Button>
          </div>
        </div>

        {instances.length === 0 ? (
          <div className="text-center py-16">
            <Database className="mx-auto text-gray-400 mb-3" size={48} />
            <p className="text-gray-500 mb-4">No instances configured</p>
            <div className="flex justify-center gap-3">
              <Button onClick={handleAdd} icon={<Plus size={16} />} variant="primary">
                Add Your First Instance
              </Button>
              <Button onClick={handleImportClick} icon={<Upload size={16} />} variant="ghost">
                Import from File
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">URL</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Database
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Auth Type
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Version
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {instances.map(([name, instance]) => {
                  const authType = instance.apiKey ? 'API Key' : 'Username/Password';
                  const AuthIcon = instance.apiKey ? Key : User;
                  const connectionStatus = connStatuses[name] ?? { status: 'idle' };
                  const totalToolCount = availableTools.length;
                  const enabledToolCount = countEnabledToolsForInstance(
                    availableTools,
                    instance.toolConfig?.disabledTools ?? []
                  );
                  const toolSummary =
                    totalToolCount > 0
                      ? `${enabledToolCount}/${totalToolCount} tools enabled for this instance`
                      : 'Tool catalog unavailable';
                  const envSyncState = syncStatus?.instances[name];

                  return (
                    <tr key={name} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4">
                        <div className="flex items-start gap-2">
                          <Database size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <code className="font-mono text-sm font-medium text-gray-900">
                              {name}
                            </code>
                            <div className="mt-1 text-xs text-gray-500">{toolSummary}</div>
                            <div className="mt-2">
                              <InstanceSyncBadge state={envSyncState} />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <a
                          href={instance.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800 hover:underline max-w-xs truncate block"
                          title={instance.url}
                        >
                          {instance.url}
                        </a>
                      </td>
                      <td className="px-4 py-4">
                        <code className="text-sm text-gray-700 font-mono">{instance.db || '-'}</code>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5">
                          <AuthIcon size={14} className="text-gray-500" />
                          <span className="text-xs text-gray-600">{authType}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {instance.version ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-700 text-xs font-medium">
                            v{instance.version}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <ConnectionStatusBadge cs={connectionStatus} />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => testConnection(name)}
                            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Test connection"
                            disabled={connectionStatus.status === 'checking'}
                          >
                            {connectionStatus.status === 'checking' ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Wifi size={16} />
                            )}
                          </button>
                          <button
                            onClick={() => handleEdit(name)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(name)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showForm && (
        <InstanceForm
          instanceName={editingName}
          instanceData={editingName ? config[editingName] : null}
          existingNames={existingNames}
          availableTools={availableTools}
          onSave={handleSaveInstance}
          onCancel={() => {
            setShowForm(false);
            setEditingName(null);
          }}
        />
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
      <div className="mt-4 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-orange-50 p-4 shadow-sm">
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
    ? 'The env file already contains an ODOO_INSTANCES snapshot. Sync after changes, then restart the MCP server to apply it.'
    : 'No ODOO_INSTANCES snapshot is saved yet. Use Sync to Env to capture the current UI configuration.';

  return (
    <div
      className="mt-4 rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 via-white to-blue-50 p-4 shadow-sm"
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
      <span>
        {count} {label}
      </span>
    </div>
  );
}

interface ImportConfirmDialogProps {
  preview: ImportPreview;
  onModeChange: (mode: ImportMode) => void;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

function ImportConfirmDialog({
  preview,
  onModeChange,
  onConfirm,
  onCancel,
  loading,
}: ImportConfirmDialogProps) {
  const totalIncoming = Object.keys(preview.incoming).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-lg rounded-xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <Upload size={20} className="text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Import Instances</h3>
              <p className="text-sm text-gray-500">
                {totalIncoming} instance{totalIncoming !== 1 ? 's' : ''} found in file
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
              <div className="text-2xl font-bold text-green-700">{preview.newNames.length}</div>
              <div className="mt-0.5 text-xs text-green-600">New instances</div>
            </div>
            <div
              className={`rounded-lg border p-3 text-center ${
                preview.conflicts.length > 0
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div
                className={`text-2xl font-bold ${
                  preview.conflicts.length > 0 ? 'text-amber-700' : 'text-gray-400'
                }`}
              >
                {preview.conflicts.length}
              </div>
              <div
                className={`mt-0.5 text-xs ${
                  preview.conflicts.length > 0 ? 'text-amber-600' : 'text-gray-400'
                }`}
              >
                Conflicts
              </div>
            </div>
          </div>

          {preview.conflicts.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="mb-2 flex items-center gap-2">
                <AlertTriangle size={14} className="flex-shrink-0 text-amber-600" />
                <span className="text-xs font-medium text-amber-700">
                  These instances already exist and will be overwritten:
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {preview.conflicts.map((name) => (
                  <code
                    key={name}
                    className="rounded bg-amber-100 px-2 py-0.5 text-xs font-mono text-amber-800"
                  >
                    {name}
                  </code>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Import mode</p>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-gray-50 has-[:checked]:border-blue-400 has-[:checked]:bg-blue-50">
                <input
                  type="radio"
                  name="importMode"
                  value="merge"
                  checked={preview.mode === 'merge'}
                  onChange={() => onModeChange('merge')}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-sm font-medium text-gray-900">Merge</div>
                  <div className="text-xs text-gray-500">
                    Add new instances and overwrite conflicts. Existing non-conflicting instances
                    are kept.
                  </div>
                </div>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-gray-50 has-[:checked]:border-red-400 has-[:checked]:bg-red-50">
                <input
                  type="radio"
                  name="importMode"
                  value="replace"
                  checked={preview.mode === 'replace'}
                  onChange={() => onModeChange('replace')}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-sm font-medium text-gray-900">Replace all</div>
                  <div className="text-xs text-gray-500">
                    Remove all existing instances and use only the imported ones.
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-200 p-6">
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={preview.mode === 'replace' ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
            icon={<Upload size={16} />}
          >
            {preview.mode === 'replace' ? 'Replace All' : `Import ${totalIncoming}`}
          </Button>
        </div>
      </div>
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
                Write {instanceCount} instance{instanceCount !== 1 ? 's' : ''} into
                ODOO_INSTANCES.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-6">
          <p className="text-sm text-gray-700">
            This saves the current Config UI instances into the <code>env</code> file as inline{' '}
            <code>ODOO_INSTANCES</code> JSON.
          </p>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-medium">Before you continue:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Instance credentials will be written into the env file.</li>
              <li>This is a bulk action for all configured instances.</li>
              <li>The new env snapshot applies on the next restart, not immediately.</li>
              <li>Any active <code>ODOO_INSTANCES_JSON</code> entry will be deactivated.</li>
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

function ConnectionStatusBadge({ cs }: { cs: ConnStatus }) {
  if (cs.status === 'idle') {
    return <span className="text-xs text-gray-400">-</span>;
  }

  if (cs.status === 'checking') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <Loader2 size={13} className="animate-spin" />
        <span>Checking...</span>
      </div>
    );
  }

  if (cs.status === 'ok') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-green-700">
        <CheckCircle2 size={13} />
        <span>{cs.latency}ms</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-red-600" title={cs.error}>
      <XCircle size={13} />
      <span className="max-w-[120px] truncate">{cs.error}</span>
    </div>
  );
}

function InstanceSyncBadge({ state }: { state?: InstanceEnvSyncState }) {
  if (!state) {
    return (
      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
        Sync status unavailable
      </span>
    );
  }

  if (state === 'synced') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
        <CheckCircle2 size={12} />
        Synced
      </span>
    );
  }

  if (state === 'out_of_sync') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
        <AlertTriangle size={12} />
        Out of sync
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
      <XCircle size={12} />
      Not synced
    </span>
  );
}
