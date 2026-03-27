import { useEffect, useState } from 'react';
import { RefreshCw, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { useConfig } from '../../hooks/useConfig';
import { Card } from '../Card';
import { Button } from '../Button';
import { StatusMessage } from '../StatusMessage';
import { ToolDetail } from '../ToolDetail';
import type { ToolConfig } from '../../types';

const AVAILABLE_GUARDS = [
  {
    key: 'requiresEnvTrue',
    value: 'ODOO_ENABLE_WRITE_TOOLS',
    label: 'Require Write Tools Enabled',
  },
  {
    key: 'requiresEnvTrue',
    value: 'ODOO_ENABLE_CLEANUP_TOOLS',
    label: 'Require Cleanup Tools Enabled',
  },
];

const TOOL_GROUPS = [
  {
    id: 'read',
    label: 'Read Operations',
    headerClass: 'bg-blue-50 border-blue-200',
    badgeClass: 'bg-blue-100 text-blue-800',
    enableBtnClass: 'text-blue-700 border-blue-300 hover:bg-blue-100',
    tools: [
      'odoo_search',
      'odoo_search_read',
      'odoo_read',
      'odoo_count',
      'odoo_read_group',
      'odoo_name_search',
      'odoo_name_get',
      'odoo_default_get',
      'odoo_get_model_metadata',
      'odoo_list_models',
      'odoo_check_access',
      'odoo_onchange',
    ],
  },
  {
    id: 'write',
    label: 'Write Operations',
    headerClass: 'bg-yellow-50 border-yellow-200',
    badgeClass: 'bg-yellow-100 text-yellow-800',
    enableBtnClass: 'text-yellow-700 border-yellow-300 hover:bg-yellow-100',
    tools: [
      'odoo_create',
      'odoo_update',
      'odoo_delete',
      'odoo_execute',
      'odoo_workflow_action',
      'odoo_generate_report',
      'odoo_copy',
      'odoo_create_batch',
    ],
  },
  {
    id: 'cleanup',
    label: 'Cleanup Operations',
    headerClass: 'bg-red-50 border-red-200',
    badgeClass: 'bg-red-100 text-red-800',
    enableBtnClass: 'text-red-700 border-red-300 hover:bg-red-100',
    tools: ['odoo_database_cleanup', 'odoo_deep_cleanup'],
  },
];

const ALL_GROUPED_TOOL_NAMES = new Set<string>(TOOL_GROUPS.flatMap(g => g.tools));

export function ToolsTab() {
  const { load, save, status, loading } = useConfig('tools');
  const [editedTools, setEditedTools] = useState<ToolConfig[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set<string>([...TOOL_GROUPS.map(g => g.id), 'other'])
  );

  useEffect(() => {
    loadTools();
  }, []);

  const loadTools = async () => {
    try {
      const data = await load() as ToolConfig[];
      setEditedTools(data);
    } catch (error) {
      console.error('Failed to load tools:', error);
    }
  };

  const isToolEnabled = (tool: ToolConfig) => {
    return !tool.guards?.requiresEnvTrue;
  };

  const autoSave = async (updatedTools: ToolConfig[]) => {
    try {
      await save(updatedTools);
      setEditedTools(updatedTools);
    } catch (error) {
      console.error('Failed to auto-save tools:', error);
    }
  };

  const applyToggle = (tools: ToolConfig[], names: Set<string>, enabled: boolean): ToolConfig[] => {
    return tools.map(tool => {
      if (!names.has(tool.name)) return tool;
      const newTool = { ...tool };
      if (!enabled) {
        newTool.guards = {
          ...newTool.guards,
          requiresEnvTrue: `ENABLE_${tool.name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`,
        };
      } else {
        if (newTool.guards?.requiresEnvTrue) {
          const restGuards = { ...newTool.guards };
          delete restGuards.requiresEnvTrue;
          newTool.guards = Object.keys(restGuards).length === 0 ? undefined : restGuards;
        }
      }
      return newTool;
    });
  };

  const toggleTool = async (toolName: string, enabled: boolean) => {
    const updated = applyToggle(editedTools, new Set([toolName]), enabled);
    await autoSave(updated);
  };

  const toggleGroup = async (groupId: string, enabled: boolean) => {
    const group = TOOL_GROUPS.find(g => g.id === groupId);
    const names = group
      ? new Set<string>(group.tools)
      : new Set<string>(editedTools.filter(t => !ALL_GROUPED_TOOL_NAMES.has(t.name)).map(t => t.name));
    const updated = applyToggle(editedTools, names, enabled);
    await autoSave(updated);
  };

  const toggleAll = async (enabled: boolean) => {
    const allNames = new Set(editedTools.map(t => t.name));
    const updated = applyToggle(editedTools, allNames, enabled);
    await autoSave(updated);
  };

  const toggleGuard = async (toolName: string, guardKey: string, enabled: boolean) => {
    const updatedTools = editedTools.map(tool => {
      if (tool.name !== toolName) return tool;
      const newTool = { ...tool };
      if (enabled) {
        const guard = AVAILABLE_GUARDS.find(g => g.key === guardKey);
        if (guard) {
          newTool.guards = { ...newTool.guards, [guardKey]: guard.value };
        }
      } else {
        if (newTool.guards) {
          const newGuards = { ...newTool.guards };
          delete newGuards[guardKey as keyof typeof newGuards];
          newTool.guards = Object.keys(newGuards).length === 0 ? undefined : newGuards;
        }
      }
      return newTool;
    });
    await autoSave(updatedTools);
  };

  const toggleGroupExpanded = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const filteredTools = editedTools.filter(tool => {
    const matchesSearch =
      !searchQuery ||
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tool.description?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const enabled = isToolEnabled(tool);
    const matchesFilter =
      filterType === 'all' ||
      (filterType === 'enabled' && enabled) ||
      (filterType === 'disabled' && !enabled);
    return matchesSearch && matchesFilter;
  });

  const enabledCount = editedTools.filter(t => isToolEnabled(t)).length;
  const disabledCount = editedTools.length - enabledCount;

  // Build per-group filtered slices
  const groupSections = TOOL_GROUPS.map(group => {
    const groupToolSet = new Set<string>(group.tools);
    const allGroupTools = editedTools.filter(t => groupToolSet.has(t.name));
    const visibleTools = filteredTools.filter(t => groupToolSet.has(t.name));
    const enabledInGroup = allGroupTools.filter(t => isToolEnabled(t)).length;
    return { ...group, allGroupTools, visibleTools, enabledInGroup };
  });

  const otherTools = filteredTools.filter(t => !ALL_GROUPED_TOOL_NAMES.has(t.name));
  const allOtherTools = editedTools.filter(t => !ALL_GROUPED_TOOL_NAMES.has(t.name));
  const enabledOtherCount = allOtherTools.filter(t => isToolEnabled(t)).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">MCP Tools</h2>
        <p className="mt-2 text-gray-600">
          View and manage available Odoo MCP tools. Toggle individual tools or entire groups.
        </p>
      </div>

      {status && (
        <StatusMessage
          status={status}
          onDismiss={status.type === 'error' ? () => {} : undefined}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-1">Total Tools</p>
            <p className="text-3xl font-bold text-gray-900">{editedTools.length}</p>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-white border-green-200">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-1">Enabled</p>
            <p className="text-3xl font-bold text-green-600">{enabledCount}</p>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-gray-50 to-white border-gray-200">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-1">Disabled</p>
            <p className="text-3xl font-bold text-gray-500">{disabledCount}</p>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-white border-orange-200">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-1">With Guards</p>
            <p className="text-3xl font-bold text-orange-600">
              {editedTools.filter(t => t.guards && Object.keys(t.guards).length > 0).length}
            </p>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search tools by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                filterType === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('enabled')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                filterType === 'enabled'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Enabled
            </button>
            <button
              onClick={() => setFilterType('disabled')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                filterType === 'disabled'
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Disabled
            </button>
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Showing {filteredTools.length} of {editedTools.length} tools
        </p>
        <div className="flex gap-2">
          <Button onClick={() => toggleAll(true)} variant="secondary" size="sm">
            Enable All
          </Button>
          <Button onClick={() => toggleAll(false)} variant="secondary" size="sm">
            Disable All
          </Button>
          <Button
            onClick={loadTools}
            loading={loading}
            icon={<RefreshCw size={14} />}
            variant="secondary"
            size="sm"
          >
            Refresh
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {filteredTools.length === 0 ? (
          <Card>
            <div className="text-center py-8">
              <p className="text-gray-500">No tools found matching your criteria</p>
            </div>
          </Card>
        ) : (
          <>
            {groupSections.map(group => {
              if (group.visibleTools.length === 0) return null;
              const isExpanded = expandedGroups.has(group.id);
              return (
                <div key={group.id} className={`border rounded-lg overflow-hidden ${group.headerClass}`}>
                  <div className={`flex items-center justify-between px-4 py-3 ${group.headerClass}`}>
                    <button
                      onClick={() => toggleGroupExpanded(group.id)}
                      className="flex items-center gap-2 flex-1 text-left min-w-0"
                    >
                      {isExpanded
                        ? <ChevronDown size={16} className="flex-shrink-0 text-gray-600" />
                        : <ChevronRight size={16} className="flex-shrink-0 text-gray-600" />}
                      <span className="font-semibold text-gray-900">{group.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${group.badgeClass}`}>
                        {group.enabledInGroup}/{group.allGroupTools.length} enabled
                      </span>
                    </button>
                    <div className="flex gap-2 ml-3 flex-shrink-0">
                      <button
                        onClick={() => toggleGroup(group.id, true)}
                        className={`text-xs px-2.5 py-1 border rounded font-medium transition-colors ${group.enableBtnClass}`}
                      >
                        Enable
                      </button>
                      <button
                        onClick={() => toggleGroup(group.id, false)}
                        className="text-xs px-2.5 py-1 border border-gray-300 rounded font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        Disable
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-3 space-y-2 bg-white">
                      {group.visibleTools.map(tool => (
                        <ToolDetail
                          key={tool.name}
                          tool={tool}
                          enabled={isToolEnabled(tool)}
                          onToggle={async (enabled) => await toggleTool(tool.name, enabled)}
                          onToggleGuard={async (guardKey, enabled) => await toggleGuard(tool.name, guardKey, enabled)}
                          availableGuards={AVAILABLE_GUARDS}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {otherTools.length > 0 && (
              <div className="border rounded-lg overflow-hidden bg-gray-50 border-gray-200">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-gray-200">
                  <button
                    onClick={() => toggleGroupExpanded('other')}
                    className="flex items-center gap-2 flex-1 text-left min-w-0"
                  >
                    {expandedGroups.has('other')
                      ? <ChevronDown size={16} className="flex-shrink-0 text-gray-600" />
                      : <ChevronRight size={16} className="flex-shrink-0 text-gray-600" />}
                    <span className="font-semibold text-gray-900">Other</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-200 text-gray-700">
                      {enabledOtherCount}/{allOtherTools.length} enabled
                    </span>
                  </button>
                  <div className="flex gap-2 ml-3 flex-shrink-0">
                    <button
                      onClick={() => toggleGroup('other', true)}
                      className="text-xs px-2.5 py-1 border border-gray-300 rounded font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      Enable
                    </button>
                    <button
                      onClick={() => toggleGroup('other', false)}
                      className="text-xs px-2.5 py-1 border border-gray-300 rounded font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      Disable
                    </button>
                  </div>
                </div>

                {expandedGroups.has('other') && (
                  <div className="p-3 space-y-2 bg-white">
                    {otherTools.map(tool => (
                      <ToolDetail
                        key={tool.name}
                        tool={tool}
                        enabled={isToolEnabled(tool)}
                        onToggle={async (enabled) => await toggleTool(tool.name, enabled)}
                        onToggleGuard={async (guardKey, enabled) => await toggleGuard(tool.name, guardKey, enabled)}
                        availableGuards={AVAILABLE_GUARDS}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
