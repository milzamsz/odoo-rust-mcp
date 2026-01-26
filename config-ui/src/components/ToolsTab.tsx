import React, { useState, useEffect } from 'react';
import { JsonEditor } from './JsonEditor';
import { StatusMessage } from './StatusMessage';
import { Card } from './Card';
import { Button } from './Button';
import { useConfig } from '../hooks/useConfig';
import type { ToolConfig, ToolCategory } from '../types';

const TOOL_CATEGORIES: Record<string, ToolCategory> = {
  'ODOO_ENABLE_WRITE_TOOLS': {
    name: 'Write Operations',
    description: 'Create, update, delete, and modify records',
    icon: '✏️',
    color: '#ef4444',
    bgColor: '#fef2f2',
    tools: ['odoo_create', 'odoo_update', 'odoo_delete', 'odoo_execute', 'odoo_workflow_action', 'odoo_copy', 'odoo_create_batch'],
    envVar: 'ODOO_ENABLE_WRITE_TOOLS',
  },
  'ODOO_ENABLE_CLEANUP_TOOLS': {
    name: 'Destructive Cleanup',
    description: 'Database cleanup and deep cleanup operations',
    icon: '🗑️',
    color: '#dc2626',
    bgColor: '#fee2e2',
    tools: ['odoo_database_cleanup', 'odoo_deep_cleanup'],
    envVar: 'ODOO_ENABLE_CLEANUP_TOOLS',
  },
};

export const ToolsTab: React.FC = () => {
  const { load, save, status, loading } = useConfig('tools');
  const [config, setConfig] = useState<ToolConfig[]>([]);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const data = await load();
      setConfig(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load tools:', error);
    }
  };

  const handleSave = async () => {
    try {
      await save(config);
      await loadConfig(); // Reload to update UI
    } catch (error) {
      console.error('Failed to save tools:', error);
    }
  };

  const handleRefresh = () => {
    loadConfig();
  };

  const updateToolsGuards = async (envVar: string, enabled: boolean) => {
    const updatedConfig = [...config];
    
    const category = TOOL_CATEGORIES[envVar];
    if (!category) return;

    updatedConfig.forEach((tool) => {
      if (category.tools.includes(tool.name)) {
        if (enabled) {
          tool.guards = tool.guards || {};
          tool.guards.requiresEnvTrue = envVar;
        } else {
          if (tool.guards) {
            delete tool.guards.requiresEnvTrue;
            if (Object.keys(tool.guards).length === 0) {
              delete tool.guards;
            }
          }
        }
      }
    });

    setConfig(updatedConfig);
    
    try {
      await save(updatedConfig);
      await loadConfig(); // Reload to update UI
    } catch (error) {
      console.error('Failed to update tool guards:', error);
    }
  };

  const getCategoryStatus = (envVar: string): boolean => {
    const category = TOOL_CATEGORIES[envVar];
    if (!category) return false;

    const categoryTools = config.filter((tool) => category.tools.includes(tool.name));
    return categoryTools.length > 0 && categoryTools.some((tool) => {
      return tool.guards && tool.guards.requiresEnvTrue === envVar;
    });
  };

  const getAllCategoryTools = (): Set<string> => {
    const allTools = new Set<string>();
    Object.values(TOOL_CATEGORIES).forEach((cat) => {
      cat.tools.forEach((toolName) => allTools.add(toolName));
    });
    return allTools;
  };

  const getReadOnlyTools = (): ToolConfig[] => {
    const allCategoryTools = getAllCategoryTools();
    return config.filter((tool) => {
      const hasGuard = tool.guards && tool.guards.requiresEnvTrue;
      const isInCategory = allCategoryTools.has(tool.name);
      return !hasGuard && !isInCategory;
    });
  };

  return (
    <div className="space-y-6">
      <Card 
        title="Tools Configuration"
        description="Define available tools that clients can call. Enable/disable tools by category for better security control."
      >
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-200 mb-3">
              Configuration (JSON Array)
            </label>
            <JsonEditor value={config} onChange={setConfig} />
          </div>
          
          {status && <StatusMessage status={status} />}
          
          <div className="flex gap-3 flex-wrap pt-2">
            <Button
              onClick={handleSave}
              disabled={loading}
              icon="💾"
              size="md"
            >
              Save Tools
            </Button>
            <Button
              onClick={handleRefresh}
              disabled={loading}
              variant="secondary"
              icon="🔄"
              size="md"
            >
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        {Object.entries(TOOL_CATEGORIES).map(([envVar, category]) => {
          const isEnabled = getCategoryStatus(envVar);
          const categoryTools = config.filter((tool) => category.tools.includes(tool.name));

          return (
            <Card key={envVar}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <span className="text-3xl flex-shrink-0">{category.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-bold text-slate-100">{category.name}</h4>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold tracking-wide transition-all ${isEnabled ? 'bg-green-500/30 text-green-300 border border-green-500/50' : 'bg-slate-700/50 text-slate-400 border border-slate-600/50'}`}>
                        {isEnabled ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 mb-4">{category.description}</p>
                    
                    {categoryTools.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {categoryTools.map((t) => (
                          <span key={t.name} className="bg-slate-700/40 text-slate-300 px-2.5 py-1.5 rounded text-xs font-mono border border-slate-600/50 transition-all hover:border-slate-500">
                            {t.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <label className="flex items-center flex-shrink-0 mt-1 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={(e) => updateToolsGuards(envVar, e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`h-6 w-11 rounded-full transition-all duration-200 ${isEnabled ? 'bg-green-500/40 border border-green-500/50' : 'bg-slate-700/40 border border-slate-600/50'}`} />
                    <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white/90 shadow-md transition-all duration-200 transform ${isEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                </label>
              </div>
            </Card>
          );
        })}

        {getReadOnlyTools().length > 0 && (
          <Card>
            <div className="flex items-start gap-3 mb-4">
              <span className="text-2xl">📖</span>
              <div>
                <h4 className="font-semibold text-slate-100">Read-Only Tools</h4>
                <p className="text-slate-400 text-sm">Always enabled • Safe read-only operations</p>
              </div>
            </div>
            
            <div>
              <p className="text-slate-400 text-xs mb-2">Tools ({getReadOnlyTools().length}):</p>
              <div className="flex flex-wrap gap-2">
                {getReadOnlyTools().map((t) => (
                  <span key={t.name} className="bg-slate-700 text-slate-200 px-2 py-1 rounded text-xs">
                    {t.name}
                  </span>
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
