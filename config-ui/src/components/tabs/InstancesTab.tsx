import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  Edit2,
  Key,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  Upload,
  User,
  Wifi,
  XCircle,
} from 'lucide-react';
import { useConfig } from '../../hooks/useConfig';
import { countEnabledToolsForInstance } from '../../toolGroups';
import type { InstanceConfig, ToolConfig } from '../../types';
import { Button } from '../Button';
import { Card } from '../Card';
import { InstanceForm } from '../InstanceForm';
import { StatusMessage } from '../StatusMessage';
import { getInstanceTags } from '../../instanceTags';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const refreshData = useCallback(async () => {
    await Promise.all([loadInstances(), loadAvailableTools()]);
  }, [loadAvailableTools, loadInstances]);

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

  const instances = useMemo(() => Object.entries(config), [config]);
  const existingNames = useMemo(() => Object.keys(config), [config]);
  const isBusy = loading || toolsLoading;
  const activeStatus = status;
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  const allTags = useMemo(() => {
    const tagsByKey = new Map<string, string>();

    for (const [, instance] of instances) {
      for (const tag of getInstanceTags(instance)) {
        const key = tag.toLocaleLowerCase();
        if (!tagsByKey.has(key)) {
          tagsByKey.set(key, tag);
        }
      }
    }

    return [...tagsByKey.values()].sort((left, right) =>
      left.localeCompare(right, undefined, { sensitivity: 'base' })
    );
  }, [instances]);
  const filteredInstances = useMemo(
    () =>
      instances.filter(([name, instance]) => {
        const tags = getInstanceTags(instance);
        if (
          selectedTag &&
          !tags.some((tag) => tag.toLocaleLowerCase() === selectedTag.toLocaleLowerCase())
        ) {
          return false;
        }

        if (!normalizedSearchQuery) {
          return true;
        }

        const authMode = instance.apiKey ? 'api key json2 token' : 'username password user pass jsonrpc';
        const searchableText = [
          name,
          instance.url,
          instance.db ?? '',
          authMode,
          instance.version ? `v${instance.version} ${instance.version}` : 'auto version',
          ...tags,
        ]
          .join(' ')
          .toLocaleLowerCase();

        return searchableText.includes(normalizedSearchQuery);
      }),
    [instances, normalizedSearchQuery, selectedTag]
  );
  const filtersActive = Boolean(normalizedSearchQuery || selectedTag);

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

      {activeStatus && <StatusMessage status={activeStatus} />}

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

      <Card>
        <div className="mb-5 flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-[280px] flex-1">
            <h3 className="text-lg font-semibold text-gray-900">
              Configured Instances ({instances.length})
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Search, tag, test, and edit Odoo connections without the env snapshot details in
              the way.
            </p>
          </div>
          <div
            className="flex gap-2 flex-wrap"
            role="group"
            aria-label="Instance table actions"
          >
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

        {instances.length > 0 && (
          <div className="mb-5 rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 via-white to-emerald-50 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <label className="relative min-w-[240px] flex-1">
                <span className="sr-only">Search Odoo instances</span>
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search name, URL, DB, auth, version, or tags..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Tag size={15} className="text-emerald-600" />
                <span>
                  Showing {filteredInstances.length} of {instances.length}
                </span>
              </div>
            </div>

            {allTags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2" aria-label="Instance tag filters">
                {allTags.map((tag) => {
                  const active = selectedTag?.toLocaleLowerCase() === tag.toLocaleLowerCase();
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setSelectedTag(active ? null : tag)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        active
                          ? 'border-emerald-500 bg-emerald-600 text-white shadow-sm'
                          : 'border-emerald-200 bg-white text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
                {filtersActive && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedTag(null);
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <XCircle size={12} />
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {instances.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center">
            <Database className="mx-auto mb-4 text-slate-400" size={48} />
            <h4 className="text-lg font-semibold text-slate-900">No instances configured</h4>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
              Add your first Odoo instance to start testing connections, adding tags, and managing
              tool access.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <Button onClick={handleAdd} icon={<Plus size={16} />} variant="primary">
                Add Your First Instance
              </Button>
              <Button onClick={handleImportClick} icon={<Upload size={16} />} variant="ghost">
                Import from File
              </Button>
            </div>
          </div>
        ) : filteredInstances.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-emerald-200 bg-emerald-50/60 py-14 text-center">
            <Search className="mx-auto mb-4 text-emerald-500" size={44} />
            <h4 className="text-lg font-semibold text-slate-900">No instances match your filters</h4>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
              Try a different search term or clear the selected tag filter.
            </p>
            <Button
              onClick={() => {
                setSearchQuery('');
                setSelectedTag(null);
              }}
              icon={<XCircle size={16} />}
              variant="ghost"
              className="mt-5"
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredInstances.map(([name, instance]) => {
              const authType = instance.apiKey ? 'API Key' : 'Username/Password';
              const AuthIcon = instance.apiKey ? Key : User;
              const connectionStatus = connStatuses[name] ?? { status: 'idle' };
              const instanceTags = getInstanceTags(instance);
              const totalToolCount = availableTools.length;
              const enabledToolCount = countEnabledToolsForInstance(
                availableTools,
                instance.toolConfig?.disabledTools ?? []
              );

              return (
                <div
                  key={name}
                  data-testid={`instance-card-${name}`}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-3">
                        <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
                          <Database size={18} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <code className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-sm font-semibold text-slate-900">
                              {name}
                            </code>
                            <ConnectionStatusBadge cs={connectionStatus} />
                          </div>

                          <a
                            href={instance.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 block truncate text-sm text-blue-600 hover:text-blue-800 hover:underline"
                            title={instance.url}
                          >
                            {instance.url}
                          </a>

                          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                            <InstanceMetaPill
                              label="Database"
                              value={instance.db || 'Optional / unset'}
                              monospace={Boolean(instance.db)}
                            />
                            <InstanceMetaPill
                              label="Authentication"
                              value={authType}
                              icon={<AuthIcon size={14} />}
                            />
                            <InstanceMetaPill
                              label="Version"
                              value={instance.version ? `v${instance.version}` : 'Auto'}
                            />
                            <InstanceMetaPill
                              label="Tools"
                              value={
                                totalToolCount > 0
                                  ? `${enabledToolCount}/${totalToolCount} enabled`
                                  : 'Catalog unavailable'
                              }
                            />
                          </div>

                          {instanceTags.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {instanceTags.map((tag) => (
                                <span
                                  key={tag}
                                  className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                                >
                                  <Tag size={11} />
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div
                      className="flex flex-wrap items-center gap-2 xl:justify-end"
                      role="group"
                      aria-label={`Actions for ${name}`}
                    >
                      <Button
                        onClick={() => testConnection(name)}
                        icon={
                          connectionStatus.status === 'checking' ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Wifi size={14} />
                          )
                        }
                        variant="ghost"
                        size="sm"
                        disabled={connectionStatus.status === 'checking'}
                      >
                        Test
                      </Button>
                      <Button
                        onClick={() => handleEdit(name)}
                        icon={<Edit2 size={14} />}
                        variant="ghost"
                        size="sm"
                      >
                        Edit
                      </Button>
                      <Button
                        onClick={() => handleDelete(name)}
                        icon={<Trash2 size={14} />}
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
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

function InstanceMetaPill({
  label,
  value,
  icon,
  monospace = false,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  monospace?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
      <div
        className={`mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-900 ${
          monospace ? 'font-mono text-[13px]' : ''
        }`}
      >
        {icon}
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}

function ConnectionStatusBadge({ cs }: { cs: ConnStatus }) {
  if (cs.status === 'idle') {
    return (
      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
        Not checked
      </span>
    );
  }

  if (cs.status === 'checking') {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-500">
        <Loader2 size={13} className="animate-spin" />
        <span>Checking...</span>
      </div>
    );
  }

  if (cs.status === 'ok') {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
        <CheckCircle2 size={13} />
        <span>Healthy {cs.latency}ms</span>
      </div>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600"
      title={cs.error}
    >
      <XCircle size={13} />
      <span className="max-w-[140px] truncate">Error</span>
    </div>
  );
}
