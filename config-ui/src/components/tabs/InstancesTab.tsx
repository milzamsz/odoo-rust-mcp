import { useEffect, useRef, useState } from 'react';
import { Plus, Edit2, Trash2, RefreshCw, Database, Key, User, Wifi, Loader2, CheckCircle2, XCircle, Download, Upload, AlertTriangle } from 'lucide-react';
import { useConfig } from '../../hooks/useConfig';
import { Card } from '../Card';
import { Button } from '../Button';
import { StatusMessage } from '../StatusMessage';
import { InstanceForm } from '../InstanceForm';
import type { InstanceConfig } from '../../types';

const TOKEN_STORAGE_KEY = 'mcp_config_token';

function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

type ConnStatus =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'ok'; latency: number }
  | { status: 'error'; error: string };

type ImportMode = 'merge' | 'replace';

interface ImportPreview {
  incoming: InstanceConfig;
  conflicts: string[];   // names that exist in both
  newNames: string[];    // names only in incoming
  mode: ImportMode;
}

export function InstancesTab() {
  const { load, save, status, loading } = useConfig('instances');
  const [config, setConfig] = useState<InstanceConfig>({});
  const [showForm, setShowForm] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [connStatuses, setConnStatuses] = useState<Record<string, ConnStatus>>({});
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadInstances();
  }, []);

  const loadInstances = async () => {
    try {
      const data = await load() as InstanceConfig;
      setConfig(data);
      setConnStatuses({});
    } catch (error) {
      console.error('Failed to load instances:', error);
    }
  };

  // ── Export ──────────────────────────────────────────────────────────────────

  const handleExport = () => {
    const json = JSON.stringify(config, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `odoo-instances-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Import ──────────────────────────────────────────────────────────────────

  const handleImportClick = () => {
    setImportError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so same file can be re-selected
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
          setImportError('Invalid file: expected a JSON object mapping instance names to configs.');
          return;
        }
        const incoming = parsed as InstanceConfig;
        const existingNames = new Set(Object.keys(config));
        const conflicts = Object.keys(incoming).filter(n => existingNames.has(n));
        const newNames = Object.keys(incoming).filter(n => !existingNames.has(n));
        setImportPreview({ incoming, conflicts, newNames, mode: 'merge' });
        setImportError(null);
      } catch {
        setImportError('Invalid JSON file. Please select a valid instances export.');
      }
    };
    reader.readAsText(file);
  };

  const handleImportConfirm = async () => {
    if (!importPreview) return;
    try {
      let merged: InstanceConfig;
      if (importPreview.mode === 'replace') {
        merged = { ...importPreview.incoming };
      } else {
        // merge: incoming entries overwrite conflicts, keep non-conflicting existing
        merged = { ...config, ...importPreview.incoming };
      }
      await save(merged);
      await loadInstances();
      setImportPreview(null);
    } catch (error) {
      console.error('Failed to import instances:', error);
    }
  };

  // ── Connection test ─────────────────────────────────────────────────────────

  const testConnection = async (name: string) => {
    setConnStatuses(prev => ({ ...prev, [name]: { status: 'checking' } }));
    try {
      const res = await fetch(`/api/config/instances/${encodeURIComponent(name)}/test`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.ok) {
        setConnStatuses(prev => ({ ...prev, [name]: { status: 'ok', latency: data.latency_ms } }));
      } else {
        setConnStatuses(prev => ({
          ...prev,
          [name]: { status: 'error', error: data.error || 'Connection failed' },
        }));
      }
    } catch {
      setConnStatuses(prev => ({ ...prev, [name]: { status: 'error', error: 'Network error' } }));
    }
  };

  const testAll = async () => {
    const names = Object.keys(config);
    await Promise.all(names.map(name => testConnection(name)));
  };

  // ── CRUD ────────────────────────────────────────────────────────────────────

  const handleAdd = () => { setEditingName(null); setShowForm(true); };
  const handleEdit = (name: string) => { setEditingName(name); setShowForm(true); };

  const handleDelete = async (name: string) => {
    if (!confirm(`Are you sure you want to delete the instance "${name}"?`)) return;
    try {
      const updatedConfig = { ...config };
      delete updatedConfig[name];
      await save(updatedConfig);
      await loadInstances();
    } catch (error) {
      console.error('Failed to delete instance:', error);
    }
  };

  const handleSaveInstance = async (name: string, data: InstanceConfig[string]) => {
    try {
      const updatedConfig = { ...config };
      if (editingName && editingName !== name) delete updatedConfig[editingName];
      updatedConfig[name] = data;
      await save(updatedConfig);
      await loadInstances();
      setShowForm(false);
      setEditingName(null);
    } catch (error) {
      console.error('Failed to save instance:', error);
    }
  };

  const instances = Object.entries(config);
  const existingNames = Object.keys(config);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Odoo Instances</h2>
          <p className="mt-2 text-gray-600">
            Configure your Odoo instance connections. Changes are applied immediately with hot reload.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={handleImportClick}
            icon={<Upload size={16} />}
            variant="ghost"
            disabled={loading}
          >
            Import
          </Button>
          <Button
            onClick={handleExport}
            icon={<Download size={16} />}
            variant="ghost"
            disabled={instances.length === 0 || loading}
          >
            Export
          </Button>
          <Button
            onClick={handleAdd}
            icon={<Plus size={18} />}
            variant="primary"
            disabled={loading}
          >
            Add Instance
          </Button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileChange}
      />

      {status && (
        <StatusMessage
          status={status}
          onDismiss={status.type === 'error' ? () => {} : undefined}
        />
      )}

      {importError && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <XCircle size={16} className="flex-shrink-0" />
          {importError}
          <button onClick={() => setImportError(null)} className="ml-auto text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      {/* Import confirmation dialog */}
      {importPreview && (
        <ImportConfirmDialog
          preview={importPreview}
          onModeChange={(mode) => setImportPreview(p => p ? { ...p, mode } : p)}
          onConfirm={handleImportConfirm}
          onCancel={() => setImportPreview(null)}
          loading={loading}
        />
      )}

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Configured Instances ({instances.length})
          </h3>
          <div className="flex gap-2">
            {instances.length > 0 && (
              <Button onClick={testAll} icon={<Wifi size={16} />} variant="ghost" size="sm">
                Test All
              </Button>
            )}
            <Button
              onClick={loadInstances}
              loading={loading}
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
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Database</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Auth Type</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Version</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {instances.map(([name, instance]) => {
                  const authType = instance.apiKey ? 'API Key' : 'Username/Password';
                  const AuthIcon = instance.apiKey ? Key : User;
                  const cs = connStatuses[name] ?? { status: 'idle' };
                  return (
                    <tr key={name} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Database size={16} className="text-blue-600 flex-shrink-0" />
                          <code className="font-mono text-sm font-medium text-gray-900">{name}</code>
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
                        <code className="text-sm text-gray-700 font-mono">{instance.db}</code>
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
                        <ConnectionStatusBadge cs={cs} />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => testConnection(name)}
                            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Test connection"
                            disabled={cs.status === 'checking'}
                          >
                            {cs.status === 'checking'
                              ? <Loader2 size={16} className="animate-spin" />
                              : <Wifi size={16} />}
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
          onSave={handleSaveInstance}
          onCancel={() => { setShowForm(false); setEditingName(null); }}
        />
      )}
    </div>
  );
}

// ── Import Confirmation Dialog ─────────────────────────────────────────────────

interface ImportConfirmDialogProps {
  preview: ImportPreview;
  onModeChange: (mode: ImportMode) => void;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

function ImportConfirmDialog({ preview, onModeChange, onConfirm, onCancel, loading }: ImportConfirmDialogProps) {
  const totalIncoming = Object.keys(preview.incoming).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
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

        <div className="p-6 space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-700">{preview.newNames.length}</div>
              <div className="text-xs text-green-600 mt-0.5">New instances</div>
            </div>
            <div className={`border rounded-lg p-3 text-center ${preview.conflicts.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
              <div className={`text-2xl font-bold ${preview.conflicts.length > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
                {preview.conflicts.length}
              </div>
              <div className={`text-xs mt-0.5 ${preview.conflicts.length > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                Conflicts
              </div>
            </div>
          </div>

          {/* Conflict names */}
          {preview.conflicts.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />
                <span className="text-xs font-medium text-amber-700">
                  These instances already exist and will be overwritten:
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {preview.conflicts.map(n => (
                  <code key={n} className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs font-mono">
                    {n}
                  </code>
                ))}
              </div>
            </div>
          )}

          {/* Import mode */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Import mode</p>
            <div className="space-y-2">
              <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-gray-50 has-[:checked]:border-blue-400 has-[:checked]:bg-blue-50">
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
                    Add new instances and overwrite conflicts. Existing non-conflicting instances are kept.
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-gray-50 has-[:checked]:border-red-400 has-[:checked]:bg-red-50">
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

        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
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

// ── Connection status badge ───────────────────────────────────────────────────

function ConnectionStatusBadge({ cs }: { cs: ConnStatus }) {
  if (cs.status === 'idle') return <span className="text-xs text-gray-400">—</span>;
  if (cs.status === 'checking') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <Loader2 size={13} className="animate-spin" />
        <span>Checking…</span>
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
