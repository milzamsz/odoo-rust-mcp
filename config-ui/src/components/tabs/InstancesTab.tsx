import React, { useEffect, useState } from 'react';
import { Save, RefreshCw, Circle } from 'lucide-react';
import { useConfig } from '../../hooks/useConfig';
import { Card } from '../Card';
import { Button } from '../Button';
import { StatusMessage } from '../StatusMessage';
import { JsonEditor } from '../JsonEditor';
import type { InstanceConfig } from '../../types';

export function InstancesTab() {
  const { load, save, status, loading } = useConfig('instances');
  const [config, setConfig] = useState<InstanceConfig>({});
  const [editedConfig, setEditedConfig] = useState<InstanceConfig>({});

  useEffect(() => {
    loadInstances();
  }, []);

  const loadInstances = async () => {
    try {
      const data = await load() as InstanceConfig;
      setConfig(data);
      setEditedConfig(data);
    } catch (error) {
      console.error('Failed to load instances:', error);
    }
  };

  const handleSave = async () => {
    try {
      await save(editedConfig);
      await loadInstances();
    } catch (error) {
      console.error('Failed to save instances:', error);
    }
  };

  const instances = Object.entries(config);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Odoo Instances</h2>
        <p className="mt-2 text-gray-600">
          Configure your Odoo instance connections. Changes are applied immediately with hot reload.
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
          <Card title="Configuration Editor">
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
                onClick={loadInstances}
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
          <Card title="Active Instances" description={`${instances.length} configured`}>
            <div className="space-y-3">
              {instances.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  No instances configured
                </p>
              ) : (
                instances.map(([name, instance]) => (
                  <div
                    key={name}
                    className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-gray-900">{name}</h4>
                      <Circle className="text-green-500 fill-green-500" size={8} />
                    </div>
                    <div className="space-y-1 text-sm">
                      <p className="text-gray-600 truncate" title={instance.url}>
                        <span className="font-medium">URL:</span> {instance.url}
                      </p>
                      <p className="text-gray-600">
                        <span className="font-medium">DB:</span> {instance.db}
                      </p>
                      {instance.version && (
                        <p className="text-gray-600">
                          <span className="font-medium">Version:</span> {instance.version}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
