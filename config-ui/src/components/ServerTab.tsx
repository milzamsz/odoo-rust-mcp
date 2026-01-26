import React, { useState, useEffect } from 'react';
import { JsonEditor } from './JsonEditor';
import { StatusMessage } from './StatusMessage';
import { Card } from './Card';
import { Button } from './Button';
import { useConfig } from '../hooks/useConfig';
import type { ServerConfig } from '../types';

export const ServerTab: React.FC = () => {
  const { load, save, status, loading } = useConfig('server');
  const [config, setConfig] = useState<ServerConfig>({});

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const data = await load();
      setConfig(data || {});
    } catch (error) {
      console.error('Failed to load server config:', error);
    }
  };

  const handleSave = async () => {
    try {
      await save(config);
    } catch (error) {
      console.error('Failed to save server config:', error);
    }
  };

  const handleRefresh = () => {
    loadConfig();
  };

  return (
    <div className="space-y-6">
      <Card 
        title="Server Configuration"
        description="Configure server metadata and behavior settings that affect how the MCP server is presented to clients."
      >
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-200 mb-3">
              Configuration (JSON)
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
              Save Configuration
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

      <Card 
        title="Configuration Fields"
        description="Reference for common server configuration options"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <code className="bg-slate-700/50 text-blue-300 px-2.5 py-1.5 rounded font-mono text-xs">serverName</code>
            </div>
            <p className="text-sm text-slate-400">Name shown to MCP clients</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <code className="bg-slate-700/50 text-blue-300 px-2.5 py-1.5 rounded font-mono text-xs">instructions</code>
            </div>
            <p className="text-sm text-slate-400">System instructions for the AI</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <code className="bg-slate-700/50 text-blue-300 px-2.5 py-1.5 rounded font-mono text-xs">protocolVersionDefault</code>
            </div>
            <p className="text-sm text-slate-400">Default MCP protocol version</p>
          </div>
        </div>
      </Card>
    </div>
  );
};
