import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { Button } from './Button';
import type { InstanceDetails, ToolConfig } from '../types';
import {
  ALL_GROUPED_TOOL_NAMES,
  countEnabledToolsForInstance,
  filterKnownDisabledTools,
  OTHER_TOOL_GROUP,
  TOOL_GROUPS,
} from '../toolGroups';

interface InstanceFormProps {
  instanceName: string | null;
  instanceData: InstanceDetails | null;
  existingNames: string[];
  availableTools: ToolConfig[];
  onSave: (name: string, data: InstanceDetails) => void;
  onCancel: () => void;
}

type AuthType = 'apiKey' | 'userPass';

export function InstanceForm({
  instanceName,
  instanceData,
  existingNames,
  availableTools,
  onSave,
  onCancel,
}: InstanceFormProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [db, setDb] = useState('');
  const [authType, setAuthType] = useState<AuthType>('userPass');
  const [apiKey, setApiKey] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [version, setVersion] = useState('');
  const [disabledTools, setDisabledTools] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set<string>([...TOOL_GROUPS.map((group) => group.id), OTHER_TOOL_GROUP.id])
  );

  useEffect(() => {
    if (instanceName && instanceData) {
      setName(instanceName);
      setUrl(instanceData.url);
      setDb(instanceData.db);
      setVersion(instanceData.version ? String(instanceData.version) : '');

      if (instanceData.apiKey) {
        setAuthType('apiKey');
        setApiKey(instanceData.apiKey);
        setUsername(instanceData.username || '');
        setPassword(instanceData.password || '');
      } else {
        setAuthType('userPass');
        setApiKey(instanceData.apiKey || '');
        setUsername(instanceData.username || '');
        setPassword(instanceData.password || '');
      }

      setDisabledTools(
        filterKnownDisabledTools(availableTools, instanceData.toolConfig?.disabledTools || [])
      );
    } else {
      setName('');
      setUrl('');
      setDb('');
      setAuthType('userPass');
      setApiKey('');
      setUsername('');
      setPassword('');
      setVersion('');
      setDisabledTools([]);
    }
    setErrors({});
  }, [availableTools, instanceData, instanceName]);

  const availableToolMap = useMemo(
    () => new Map(availableTools.map((tool) => [tool.name, tool])),
    [availableTools]
  );

  const groupedSections = useMemo(
    () =>
      TOOL_GROUPS.map((group) => ({
        ...group,
        tools: group.tools
          .map((toolName) => availableToolMap.get(toolName))
          .filter((tool): tool is ToolConfig => Boolean(tool)),
      })),
    [availableToolMap]
  );

  const otherTools = useMemo(
    () =>
      [...availableTools]
        .filter((tool) => !ALL_GROUPED_TOOL_NAMES.has(tool.name))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
    [availableTools]
  );

  const disabledToolSet = useMemo(() => new Set(disabledTools), [disabledTools]);
  const enabledToolCount = countEnabledToolsForInstance(availableTools, disabledTools);

  const setToolEnabled = (toolName: string, enabled: boolean) => {
    setDisabledTools((current) => {
      const next = new Set(current);
      if (enabled) next.delete(toolName);
      else next.add(toolName);
      return [...next].sort((left, right) => left.localeCompare(right));
    });
  };

  const setGroupEnabled = (toolNames: string[], enabled: boolean) => {
    setDisabledTools((current) => {
      const next = new Set(current);
      for (const toolName of toolNames) {
        if (enabled) next.delete(toolName);
        else next.add(toolName);
      }
      return [...next].sort((left, right) => left.localeCompare(right));
    });
  };

  const toggleGroupExpanded = (groupId: string) => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Instance name is required';
    } else if (!instanceName && existingNames.includes(name.trim())) {
      newErrors.name = 'Instance name already exists';
    }

    if (!url.trim()) {
      newErrors.url = 'URL is required';
    }

    if (!db.trim()) {
      newErrors.db = 'Database name is required';
    }

    if (authType === 'apiKey' && !apiKey.trim()) {
      newErrors.apiKey = 'API Key is required when using API Key authentication';
    }

    if (authType === 'userPass') {
      if (!username.trim()) {
        newErrors.username =
          'Username is required when using username/password authentication';
      }
      if (!password.trim()) {
        newErrors.password =
          'Password is required when using username/password authentication';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    const data: InstanceDetails = {
      ...(instanceData ?? {}),
      url: url.trim(),
      db: db.trim(),
    };

    if (authType === 'apiKey') {
      data.apiKey = apiKey.trim();
      delete data.username;
      delete data.password;
    } else {
      data.username = username.trim();
      data.password = password.trim();
      delete data.apiKey;
    }

    if (version.trim()) {
      data.version = version.trim();
    } else {
      delete data.version;
    }

    const sanitizedDisabledTools = filterKnownDisabledTools(availableTools, disabledTools)
      .sort((left, right) => left.localeCompare(right));

    if (sanitizedDisabledTools.length > 0) {
      data.toolConfig = {
        disabledTools: sanitizedDisabledTools,
      };
    } else {
      delete data.toolConfig;
    }

    onSave(name.trim(), data);
  };

  const renderToolGroup = (
    groupId: string,
    label: string,
    headerClass: string,
    badgeClass: string,
    enableBtnClass: string,
    tools: ToolConfig[]
  ) => {
    if (tools.length === 0) {
      return null;
    }

    const enabledInGroup = tools.filter((tool) => !disabledToolSet.has(tool.name)).length;
    const isExpanded = expandedGroups.has(groupId);

    return (
      <div key={groupId} className={`overflow-hidden rounded-lg border ${headerClass}`}>
        <div className={`flex items-center justify-between px-4 py-3 ${headerClass}`}>
          <button
            type="button"
            onClick={() => toggleGroupExpanded(groupId)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            {isExpanded ? (
              <ChevronDown size={16} className="flex-shrink-0 text-gray-600" />
            ) : (
              <ChevronRight size={16} className="flex-shrink-0 text-gray-600" />
            )}
            <span className="font-semibold text-gray-900">{label}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}>
              {enabledInGroup}/{tools.length} enabled
            </span>
          </button>

          <div className="ml-3 flex flex-shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setGroupEnabled(tools.map((tool) => tool.name), true)}
              aria-label={`Enable ${label}`}
              className={`rounded border px-2.5 py-1 text-xs font-medium transition-colors ${enableBtnClass}`}
            >
              Enable
            </button>
            <button
              type="button"
              onClick={() => setGroupEnabled(tools.map((tool) => tool.name), false)}
              aria-label={`Disable ${label}`}
              className="rounded border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100"
            >
              Disable
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="divide-y divide-gray-100 bg-white">
            {tools.map((tool) => {
              const enabled = !disabledToolSet.has(tool.name);
              return (
                <div
                  key={tool.name}
                  className="flex items-start justify-between gap-4 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-semibold text-gray-900">
                      {tool.name}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500">
                      {tool.description || 'No description available'}
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(event) => setToolEnabled(tool.name, event.target.checked)}
                      aria-label={`Enable ${tool.name}`}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    Enabled
                  </label>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">
              {instanceName ? 'Edit Instance' : 'Add New Instance'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Global tools still come from the Tools tab. These settings only decide which tools
              stay enabled for this instance.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-400 transition-colors hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="space-y-6 p-6">
            <section className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Instance Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!!instanceName}
                  className={`w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  } ${instanceName ? 'cursor-not-allowed bg-gray-100' : ''}`}
                  placeholder="e.g., production, local, staging"
                />
                {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className={`w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.url ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="e.g., https://odoo.example.com"
                />
                {errors.url && <p className="mt-1 text-sm text-red-600">{errors.url}</p>}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Database Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={db}
                  onChange={(e) => setDb(e.target.value)}
                  className={`w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.db ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="e.g., production_db"
                />
                {errors.db && <p className="mt-1 text-sm text-red-600">{errors.db}</p>}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Authentication Method <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="userPass"
                      checked={authType === 'userPass'}
                      onChange={(e) => setAuthType(e.target.value as AuthType)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Username & Password</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="apiKey"
                      checked={authType === 'apiKey'}
                      onChange={(e) => setAuthType(e.target.value as AuthType)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">API Key</span>
                  </label>
                </div>
              </div>

              {authType === 'userPass' ? (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Username <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className={`w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.username ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="e.g., admin@example.com"
                    />
                    {errors.username && (
                      <p className="mt-1 text-sm text-red-600">{errors.username}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.password ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Enter password"
                    />
                    {errors.password && (
                      <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                    )}
                  </div>
                </>
              ) : (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    API Key <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className={`w-full rounded-lg border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.apiKey ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter API key"
                  />
                  {errors.apiKey && <p className="mt-1 text-sm text-red-600">{errors.apiKey}</p>}
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Odoo Version
                </label>
                <input
                  type="text"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 16, 17, 18, 19"
                />
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-base font-semibold text-gray-900">Per-Instance Tool Access</h4>
                  <p className="mt-1 text-sm text-gray-600">
                    Use the same tool groups as the global Tools screen, then fine-tune individual
                    tools for this instance. Global security guards still apply at runtime.
                  </p>
                </div>
                <div className="rounded-lg bg-white px-3 py-2 text-xs text-gray-600 shadow-sm">
                  {enabledToolCount}/{availableTools.length} enabled
                </div>
              </div>

              {availableTools.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-500">
                  Global tools are not available yet. Refresh the Instances page after tools load if
                  you want to edit per-instance access.
                </div>
              ) : (
                <div className="space-y-4">
                  {groupedSections.map((group) =>
                    renderToolGroup(
                      group.id,
                      group.label,
                      group.headerClass,
                      group.badgeClass,
                      group.enableBtnClass,
                      group.tools
                    )
                  )}

                  {renderToolGroup(
                    OTHER_TOOL_GROUP.id,
                    OTHER_TOOL_GROUP.label,
                    OTHER_TOOL_GROUP.headerClass,
                    OTHER_TOOL_GROUP.badgeClass,
                    OTHER_TOOL_GROUP.enableBtnClass,
                    otherTools
                  )}
                </div>
              )}
            </section>
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {instanceName ? 'Update Instance' : 'Add Instance'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
