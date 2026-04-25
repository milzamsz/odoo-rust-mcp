import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { Button } from './Button';
import { getInstanceTags, parseInstanceTagsInput } from '../instanceTags';
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

const inputBaseClassName =
  'w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500';

function getInputClassName(hasError: boolean, extraClassName = '') {
  return `${inputBaseClassName} ${hasError ? 'border-red-400' : 'border-slate-300'} ${extraClassName}`.trim();
}

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
  const [tagsInput, setTagsInput] = useState('');
  const [disabledTools, setDisabledTools] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set<string>([...TOOL_GROUPS.map((group) => group.id), OTHER_TOOL_GROUP.id])
  );

  useEffect(() => {
    if (instanceName && instanceData) {
      setName(instanceName);
      setUrl(instanceData.url);
      setDb(instanceData.db || '');
      setVersion(instanceData.version ? String(instanceData.version) : '');
      setTagsInput(getInstanceTags(instanceData).join(', '));

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
      setTagsInput('');
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
  const dbRequired = authType === 'userPass';

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

    if (dbRequired && !db.trim()) {
      newErrors.db = 'Database name is required when using username/password authentication';
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
    };
    const trimmedDb = db.trim();
    if (trimmedDb) {
      data.db = trimmedDb;
    } else {
      delete data.db;
    }

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

    const normalizedTags = parseInstanceTagsInput(tagsInput);
    if (normalizedTags.length > 0) {
      data.tags = normalizedTags;
    } else {
      delete data.tags;
    }

    // Legacy instances may still include aliases in raw API responses.
    delete data['aliases'];

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50 shadow-2xl">
        <div className="border-b border-slate-200 bg-white px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-600">
                Instance Setup
              </div>
              <h3 className="mt-2 text-2xl font-semibold text-slate-950">
                {instanceName ? 'Edit Instance' : 'Add New Instance'}
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Capture the connection details, choose the right authentication flow, and decide
                which tools should stay available for this instance only.
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-slate-200 bg-slate-50 p-2 text-slate-400 transition-colors hover:border-slate-300 hover:bg-white hover:text-slate-600"
              aria-label="Close instance form"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="space-y-6 p-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="text-base font-semibold text-slate-950">Connection Identity</h4>
                  <p className="mt-1 text-sm text-slate-600">
                    Keep the instance name short and stable. The URL, database, and version drive
                    how the backend connects.
                  </p>
                </div>
                <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                  Hot reload applies after save
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Instance Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={!!instanceName}
                    className={getInputClassName(
                      Boolean(errors.name),
                      instanceName ? 'cursor-not-allowed bg-slate-100 text-slate-500' : ''
                    )}
                    placeholder="e.g., production, local, staging"
                  />
                  <p className="mt-1.5 text-xs text-slate-500">
                    This canonical name is what tools and resources now use.
                  </p>
                  {errors.name && <p className="mt-1.5 text-sm text-red-600">{errors.name}</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    URL <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className={getInputClassName(Boolean(errors.url))}
                    placeholder="e.g., https://odoo.example.com"
                  />
                  <p className="mt-1.5 text-xs text-slate-500">
                    Use the public Odoo base URL that the MCP server should contact.
                  </p>
                  {errors.url && <p className="mt-1.5 text-sm text-red-600">{errors.url}</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Database Name {dbRequired && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="text"
                    value={db}
                    onChange={(e) => setDb(e.target.value)}
                    className={getInputClassName(Boolean(errors.db), 'font-mono text-[13px]')}
                    placeholder={
                      dbRequired ? 'e.g., production_db' : 'Optional for single-tenant Odoo 19'
                    }
                  />
                  <p className="mt-1.5 text-xs text-slate-500">
                    {dbRequired
                      ? 'Required for username/password connections and JSON-RPC flows.'
                      : 'Optional for API key connections on Odoo 19. Leave blank for simple single-tenant setups, or enter the exact database name when the server expects one.'}
                  </p>
                  {errors.db && <p className="mt-1.5 text-sm text-red-600">{errors.db}</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Odoo Version
                  </label>
                  <input
                    type="text"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    className={getInputClassName(false)}
                    placeholder="e.g., 16, 17, 18, 19"
                  />
                  <p className="mt-1.5 text-xs text-slate-500">
                    Version helps the backend choose the expected protocol and auth flow.
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label
                    htmlFor="instance-tags"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Tags
                  </label>
                  <textarea
                    id="instance-tags"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    className={getInputClassName(false, 'min-h-[88px]')}
                    placeholder="e.g., prod, kdkmp, finance"
                  />
                  <p className="mt-1.5 text-xs text-slate-500">
                    Separate tags with commas or new lines. Tags help search and filter the
                    Odoo Instances list.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5">
                <h4 className="text-base font-semibold text-slate-950">Authentication</h4>
                <p className="mt-1 text-sm text-slate-600">
                  Pick the auth style that matches the target Odoo instance. The form will show
                  only the fields needed for that flow.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label
                  className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                    authType === 'apiKey'
                      ? 'border-blue-300 bg-blue-50 shadow-sm'
                      : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    value="apiKey"
                    checked={authType === 'apiKey'}
                    onChange={(e) => setAuthType(e.target.value as AuthType)}
                    className="sr-only"
                  />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">API Key</div>
                      <p className="mt-1 text-sm text-slate-600">
                        Best for Odoo 19 and JSON-2 connections.
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                        authType === 'apiKey'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {authType === 'apiKey' ? 'Selected' : 'Available'}
                    </span>
                  </div>
                </label>

                <label
                  className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                    authType === 'userPass'
                      ? 'border-blue-300 bg-blue-50 shadow-sm'
                      : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    value="userPass"
                    checked={authType === 'userPass'}
                    onChange={(e) => setAuthType(e.target.value as AuthType)}
                    className="sr-only"
                  />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        Username & Password
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        Use for legacy Odoo deployments and JSON-RPC.
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                        authType === 'userPass'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {authType === 'userPass' ? 'Selected' : 'Available'}
                    </span>
                  </div>
                </label>
              </div>

              <div className={`mt-5 grid gap-4 ${authType === 'userPass' ? 'md:grid-cols-2' : ''}`}>
                {authType === 'userPass' ? (
                  <>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Username <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className={getInputClassName(Boolean(errors.username))}
                        placeholder="e.g., admin@example.com"
                      />
                      {errors.username && (
                        <p className="mt-1.5 text-sm text-red-600">{errors.username}</p>
                      )}
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Password <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={getInputClassName(Boolean(errors.password))}
                        placeholder="Enter password"
                      />
                      {errors.password && (
                        <p className="mt-1.5 text-sm text-red-600">{errors.password}</p>
                      )}
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      API Key <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className={getInputClassName(Boolean(errors.apiKey), 'font-mono text-[13px]')}
                      placeholder="Enter API key"
                    />
                    <p className="mt-1.5 text-xs text-slate-500">
                      Leave the database blank only when the Odoo 19 host can resolve the tenant
                      automatically.
                    </p>
                    {errors.apiKey && (
                      <p className="mt-1.5 text-sm text-red-600">{errors.apiKey}</p>
                    )}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-900/[0.02] p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h4 className="text-base font-semibold text-slate-950">Per-Instance Tool Access</h4>
                  <p className="mt-1 text-sm text-slate-600">
                    Start from the shared tool catalog, then trim access for this specific instance.
                    Global guards still apply at runtime.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-right shadow-sm">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Enabled
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">
                    {enabledToolCount}/{availableTools.length}
                  </div>
                </div>
              </div>

              {availableTools.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                  Global tools are not available yet. Refresh the Instances page after tools load if
                  you want to tune per-instance access.
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

          <div className="flex justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
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
