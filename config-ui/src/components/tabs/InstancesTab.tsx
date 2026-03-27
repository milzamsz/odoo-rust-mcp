import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, RefreshCw, Database, Key, User, Wifi, Loader2, CheckCircle2, XCircle } from 'lucide-react';
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

export function InstancesTab() {
  const { load, save, status, loading } = useConfig('instances');
  const [config, setConfig] = useState<InstanceConfig>({});
  const [showForm, setShowForm] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [connStatuses, setConnStatuses] = useState<Record<string, ConnStatus>>({});

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

  const handleAdd = () => {
    setEditingName(null);
    setShowForm(true);
  };

  const handleEdit = (name: string) => {
    setEditingName(name);
    setShowForm(true);
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Are you sure you want to delete the instance "${name}"?`)) {
      return;
    }
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
      if (editingName && editingName !== name) {
        delete updatedConfig[editingName];
      }
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Odoo Instances</h2>
          <p className="mt-2 text-gray-600">
            Configure your Odoo instance connections. Changes are applied immediately with hot reload.
          </p>
        </div>
        <Button
          onClick={handleAdd}
          icon={<Plus size={18} />}
          variant="primary"
          disabled={loading}
        >
          Add Instance
        </Button>
      </div>

      {status && (
        <StatusMessage
          status={status}
          onDismiss={status.type === 'error' ? () => {} : undefined}
        />
      )}

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Configured Instances ({instances.length})
          </h3>
          <div className="flex gap-2">
            {instances.length > 0 && (
              <Button
                onClick={testAll}
                icon={<Wifi size={16} />}
                variant="ghost"
                size="sm"
              >
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
            <Button onClick={handleAdd} icon={<Plus size={16} />} variant="primary">
              Add Your First Instance
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    URL
                  </th>
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
                  const cs = connStatuses[name] ?? { status: 'idle' };

                  return (
                    <tr key={name} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Database size={16} className="text-blue-600 flex-shrink-0" />
                          <code className="font-mono text-sm font-medium text-gray-900">
                            {name}
                          </code>
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
                        <code className="text-sm text-gray-700 font-mono">
                          {instance.db}
                        </code>
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
          onCancel={() => {
            setShowForm(false);
            setEditingName(null);
          }}
        />
      )}
    </div>
  );
}

function ConnectionStatusBadge({ cs }: { cs: ConnStatus }) {
  if (cs.status === 'idle') {
    return <span className="text-xs text-gray-400">—</span>;
  }
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
