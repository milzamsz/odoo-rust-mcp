import React, { useEffect, useState } from 'react';
import { Save, RefreshCw, FileText } from 'lucide-react';
import { useConfig } from '../../hooks/useConfig';
import { Card } from '../Card';
import { Button } from '../Button';
import { StatusMessage } from '../StatusMessage';
import { JsonEditor } from '../JsonEditor';
import type { PromptConfig } from '../../types';

export function PromptsTab() {
  const { load, save, status, loading } = useConfig('prompts');
  const [prompts, setPrompts] = useState<PromptConfig[]>([]);
  const [editedPrompts, setEditedPrompts] = useState<PromptConfig[]>([]);

  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    try {
      const data = await load() as PromptConfig[];
      setPrompts(data);
      setEditedPrompts(data);
    } catch (error) {
      console.error('Failed to load prompts:', error);
    }
  };

  const handleSave = async () => {
    try {
      await save(editedPrompts);
      await loadPrompts();
    } catch (error) {
      console.error('Failed to save prompts:', error);
    }
  };

  const truncateContent = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">System Prompts</h2>
        <p className="mt-2 text-gray-600">
          Configure AI prompts and system instructions for the MCP server.
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
          <Card title="Prompts Configuration Editor">
            <JsonEditor value={editedPrompts} onChange={setEditedPrompts} />
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
                onClick={loadPrompts}
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
          <Card title="Configured Prompts" description={`${prompts.length} active`}>
            <div className="space-y-3">
              {prompts.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="mx-auto text-gray-400 mb-2" size={32} />
                  <p className="text-sm text-gray-500">No prompts configured</p>
                </div>
              ) : (
                prompts.map((prompt) => (
                  <div
                    key={prompt.name}
                    className="p-4 bg-gradient-to-br from-blue-50 to-white rounded-lg border border-blue-200 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <FileText size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 text-sm truncate">
                          {prompt.name}
                        </h4>
                        {prompt.description && (
                          <p className="text-xs text-gray-600 mt-0.5">
                            {prompt.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 p-2 bg-white rounded border border-gray-200">
                      <p className="text-xs text-gray-700 font-mono leading-relaxed">
                        {truncateContent(prompt.content, 120)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card title="Field Reference" className="mt-6">
            <div className="space-y-3 text-sm">
              <div className="p-3 bg-gray-50 rounded-lg">
                <code className="text-blue-600 font-mono text-xs">name</code>
                <p className="text-gray-600 mt-1 text-xs">
                  Unique identifier for the prompt
                </p>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg">
                <code className="text-blue-600 font-mono text-xs">description</code>
                <p className="text-gray-600 mt-1 text-xs">
                  Brief description of the prompt's purpose
                </p>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg">
                <code className="text-blue-600 font-mono text-xs">content</code>
                <p className="text-gray-600 mt-1 text-xs">
                  The actual prompt text content
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
