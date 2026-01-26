import React, { useEffect, useState } from 'react';
import { Save, RefreshCw, Info } from 'lucide-react';
import { useConfig } from '../../hooks/useConfig';
import { Card } from '../Card';
import { Button } from '../Button';
import { StatusMessage } from '../StatusMessage';
import { JsonEditor } from '../JsonEditor';
import type { ServerConfig } from '../../types';

export function ServerTab() {
  const { load, save, status, loading } = useConfig('server');
  const [config, setConfig] = useState<ServerConfig>({});
  const [editedConfig, setEditedConfig] = useState<ServerConfig>({});

  useEffect(() => {
    loadServer();
  }, []);

  const loadServer = async () => {
    try {
      const data = await load() as ServerConfig;
      setConfig(data);
      setEditedConfig(data);
    } catch (error) {
      console.error('Failed to load server config:', error);
    }
  };

  const handleSave = async () => {
    try {
      await save(editedConfig);
      await loadServer();
    } catch (error) {
      console.error('Failed to save server config:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Server Configuration</h2>
        <p className="mt-2 text-gray-600">
          Configure server metadata and system settings for the MCP server.
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
          <Card title="Server Settings Editor">
            <JsonEditor value={editedConfig} onChange={setEditedConfig} />
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
                onClick={loadServer}
                loading={loading}
                icon={<RefreshCw size={16} />}
                variant="secondary"
              >
                Refresh
              </Button>
            </div>
          </Card>
        </div>

        <div>
          <Card title="Configuration Reference">
            <div className="space-y-4">
              <div className="flex items-start gap-2">
                <Info size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Common Fields</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Standard configuration options
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <code className="text-blue-600 font-mono text-xs">serverName</code>
                  <p className="text-gray-600 mt-1 text-xs">
                    Display name shown to MCP clients
                  </p>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg">
                  <code className="text-blue-600 font-mono text-xs">instructions</code>
                  <p className="text-gray-600 mt-1 text-xs">
                    System instructions for the AI assistant
                  </p>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg">
                  <code className="text-blue-600 font-mono text-xs">protocolVersionDefault</code>
                  <p className="text-gray-600 mt-1 text-xs">
                    Default MCP protocol version (e.g., "2024-11-05")
                  </p>
                </div>
              </div>

              {config.serverName && (
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-500 mb-2">Current Server</p>
                  <p className="font-semibold text-gray-900">{config.serverName}</p>
                  {config.protocolVersionDefault && (
                    <p className="text-xs text-gray-600 mt-1">
                      Protocol: {config.protocolVersionDefault}
                    </p>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
