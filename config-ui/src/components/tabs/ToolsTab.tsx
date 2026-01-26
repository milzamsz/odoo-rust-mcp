import React, { useEffect, useState } from 'react';
import { Save, RefreshCw, Edit3, Trash2, Eye } from 'lucide-react';
import { useConfig } from '../../hooks/useConfig';
import { Card } from '../Card';
import { Button } from '../Button';
import { StatusMessage } from '../StatusMessage';
import { JsonEditor } from '../JsonEditor';
import type { ToolConfig, ToolCategory } from '../../types';

const TOOL_CATEGORIES: ToolCategory[] = [
  {
    name: 'Write Operations',
    description: 'Tools that modify data in Odoo',
    icon: 'Edit3',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    envVar: 'ODOO_ENABLE_WRITE_TOOLS',
    tools: ['odoo_create', 'odoo_update', 'odoo_delete', 'odoo_execute', 'odoo_workflow_action', 'odoo_copy', 'odoo_create_batch'],
  },
  {
    name: 'Destructive Cleanup',
    description: 'Dangerous operations that clean up data',
    icon: 'Trash2',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    envVar: 'ODOO_ENABLE_CLEANUP_TOOLS',
    tools: ['odoo_database_cleanup', 'odoo_deep_cleanup'],
  },
];

export function ToolsTab() {
  const { load, save, status, loading } = useConfig('tools');
  const [tools, setTools] = useState<ToolConfig[]>([]);
  const [editedTools, setEditedTools] = useState<ToolConfig[]>([]);

  useEffect(() => {
    loadTools();
  }, []);

  const loadTools = async () => {
    try {
      const data = await load() as ToolConfig[];
      setTools(data);
      setEditedTools(data);
    } catch (error) {
      console.error('Failed to load tools:', error);
    }
  };

  const handleSave = async () => {
    try {
      await save(editedTools);
      await loadTools();
    } catch (error) {
      console.error('Failed to save tools:', error);
    }
  };

  const toggleCategory = (category: ToolCategory, enabled: boolean) => {
    const updatedTools = editedTools.map(tool => {
      if (category.tools.includes(tool.name)) {
        const newTool = { ...tool };
        if (enabled) {
          newTool.guards = {
            ...newTool.guards,
            requiresEnvTrue: category.envVar,
          };
        } else {
          if (newTool.guards) {
            delete newTool.guards.requiresEnvTrue;
            if (Object.keys(newTool.guards).length === 0) {
              delete newTool.guards;
            }
          }
        }
        return newTool;
      }
      return tool;
    });
    setEditedTools(updatedTools);
  };

  const isCategoryEnabled = (category: ToolCategory): boolean => {
    return category.tools.some(toolName => {
      const tool = editedTools.find(t => t.name === toolName);
      return tool?.guards?.requiresEnvTrue === category.envVar;
    });
  };

  const categorizedTools = TOOL_CATEGORIES.map(category => ({
    category,
    tools: editedTools.filter(t => category.tools.includes(t.name)),
  }));

  const readOnlyTools = editedTools.filter(
    tool => !TOOL_CATEGORIES.some(cat => cat.tools.includes(tool.name))
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">MCP Tools</h2>
        <p className="mt-2 text-gray-600">
          Enable or disable tools and manage tool categories with environment-based guards.
        </p>
      </div>

      {status && (
        <StatusMessage
          status={status}
          onDismiss={status.type === 'error' ? () => {} : undefined}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card title="Tools Configuration Editor">
            <JsonEditor value={editedTools} onChange={setEditedTools} />
            <div className="flex gap-3 mt-4">
              <Button
                onClick={handleSave}
                loading={loading}
                icon={<Save size={16} />}
                variant="primary"
              >
                Save Configuration
              </Button>
              <Button
                onClick={loadTools}
                loading={loading}
                icon={<RefreshCw size={16} />}
                variant="secondary"
              >
                Refresh
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Tool Categories">
            <div className="space-y-4">
              {categorizedTools.map(({ category, tools: categoryTools }) => {
                const enabled = isCategoryEnabled(category);
                const IconComponent = category.icon === 'Edit3' ? Edit3 : Trash2;

                return (
                  <div key={category.name} className={`p-4 rounded-lg border ${enabled ? 'border-gray-300' : 'border-gray-200'} ${category.bgColor}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-2">
                        <IconComponent className={category.color} size={18} />
                        <div>
                          <h4 className="font-semibold text-gray-900 text-sm">{category.name}</h4>
                          <p className="text-xs text-gray-600 mt-0.5">{category.description}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleCategory(category, !enabled)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          enabled ? 'bg-blue-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            enabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    <div className="text-xs">
                      <p className="text-gray-600 mb-1">{categoryTools.length} tools</p>
                      <code className="text-gray-500 font-mono text-[10px]">{category.envVar}</code>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="Tool Status" description={`${editedTools.length} total tools`}>
            <div className="space-y-2">
              {readOnlyTools.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye size={14} className="text-gray-500" />
                    <span className="text-xs font-medium text-gray-700">Read-Only Tools</span>
                  </div>
                  <div className="space-y-1">
                    {readOnlyTools.map(tool => (
                      <div key={tool.name} className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded border border-green-200">
                        {tool.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {categorizedTools.map(({ category, tools: categoryTools }) => {
                const enabled = isCategoryEnabled(category);
                return categoryTools.length > 0 && (
                  <div key={category.name} className="mb-3">
                    <p className="text-xs font-medium text-gray-700 mb-1">{category.name}</p>
                    <div className="space-y-1">
                      {categoryTools.map(tool => (
                        <div
                          key={tool.name}
                          className={`text-xs px-2 py-1 rounded border ${
                            enabled
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-gray-50 text-gray-600 border-gray-200'
                          }`}
                        >
                          {tool.name}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
