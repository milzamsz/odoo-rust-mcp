import { describe, it, expect } from 'vitest';
import type {
  InstanceConfig,
  ToolConfig,
  ServerConfig,
  PromptConfig,
  StatusMessage,
  TabType,
} from '../types';

describe('Type Safety and Configuration', () => {
  describe('Instance Configuration Types', () => {
    it('should validate instance config structure', () => {
      const instance: InstanceConfig = {
        prod: {
          url: 'https://prod.example.com',
          db: 'prod_db',
          apiKey: 'prod_key_123',
          username: 'admin',
          password: 'secret',
          version: 14,
        },
      };

      expect(instance.prod.url).toMatch(/https:\/\//);
      expect(instance.prod.db).toBeTruthy();
      expect(instance.prod.apiKey).toBeTruthy();
    });

    it('should allow optional fields in instance', () => {
      const instance: InstanceConfig = {
        test: {
          url: 'http://localhost:8069',
          db: 'test_db',
          // apiKey is optional
          // username is optional
        },
      };

      expect(instance.test.url).toBeTruthy();
      expect(instance.test.apiKey).toBeUndefined();
    });

    it('should support multiple instances', () => {
      const config: InstanceConfig = {
        prod: {
          url: 'https://prod.example.com',
          db: 'prod_db',
        },
        test: {
          url: 'https://test.example.com',
          db: 'test_db',
        },
        local: {
          url: 'http://localhost:8069',
          db: 'local_db',
        },
      };

      expect(Object.keys(config).length).toBe(3);
      expect(config.prod).toBeDefined();
      expect(config.test).toBeDefined();
    });

    it('should handle auth variations', () => {
      const withApiKey: InstanceConfig = {
        instance1: {
          url: 'http://localhost',
          db: 'testdb',
          apiKey: 'key123',
        },
      };

      const withCredentials: InstanceConfig = {
        instance2: {
          url: 'http://localhost',
          db: 'testdb',
          username: 'user',
          password: 'pass',
        },
      };

      expect(withApiKey.instance1.apiKey).toBeTruthy();
      expect(withCredentials.instance2.username).toBeTruthy();
    });
  });

  describe('Tool Configuration Types', () => {
    it('should validate tool config structure', () => {
      const tool: ToolConfig = {
        name: 'process_invoice',
        description: 'Process invoices in Odoo',
        guards: {
          requiresEnvTrue: 'ENABLE_INVOICE_TOOL',
        },
      };

      expect(tool.name).toBe('process_invoice');
      expect(tool.guards?.requiresEnvTrue).toBeTruthy();
    });

    it('should allow tools without guards', () => {
      const tool: ToolConfig = {
        name: 'simple_tool',
        description: 'A simple tool',
      };

      expect(tool.name).toBeTruthy();
      expect(tool.guards).toBeUndefined();
    });

    it('should support flexible tool structure', () => {
      const tool: ToolConfig = {
        name: 'custom_tool',
        description: 'Custom tool',
        customField: 'custom_value',
      };

      expect(tool.name).toBe('custom_tool');
      expect((tool as any).customField).toBe('custom_value');
    });

    it('should validate multiple tools', () => {
      const tools: ToolConfig[] = [
        { name: 'tool1', description: 'Tool 1' },
        { name: 'tool2', description: 'Tool 2' },
        {
          name: 'tool3',
          description: 'Tool 3',
          guards: { requiresEnvTrue: 'ENABLE_TOOL3' },
        },
      ];

      expect(tools.length).toBe(3);
      expect(tools[2].guards).toBeDefined();
    });
  });

  describe('Server Configuration Types', () => {
    it('should validate server config', () => {
      const server: ServerConfig = {
        serverName: 'test-mcp',
        instructions: 'Test MCP server configuration',
      };

      expect(server.serverName).toBe('test-mcp');
      expect(server.instructions).toBeTruthy();
    });

    it('should support additional server fields', () => {
      const server: ServerConfig = {
        serverName: 'odoo-mcp',
        instructions: 'Odoo MCP server',
        version: '0.3.28',
      };

      expect(server.serverName).toBeTruthy();
      expect((server as any).version).toBe('0.3.28');
    });
  });

  describe('Prompt Configuration Types', () => {
    it('should validate prompt config', () => {
      const prompt: PromptConfig = {
        name: 'system_prompt',
        description: 'System prompt for MCP',
        content: 'You are an Odoo expert...',
      };

      expect(prompt.name).toBe('system_prompt');
      expect(prompt.content).toBeTruthy();
    });

    it('should support multiple prompts', () => {
      const prompts: Record<string, PromptConfig> = {
        system: {
          name: 'system',
          description: 'System prompt',
          content: 'System content',
        },
        context: {
          name: 'context',
          description: 'Context prompt',
          content: 'Context content',
        },
      };

      expect(Object.keys(prompts).length).toBe(2);
      expect(prompts.system.name).toBe('system');
    });
  });

  describe('Status Message Types', () => {
    it('should validate success status', () => {
      const status: StatusMessage = {
        message: 'Configuration saved',
        type: 'success',
      };

      expect(status.type).toBe('success');
      expect(status.message).toContain('saved');
    });

    it('should validate error status', () => {
      const status: StatusMessage = {
        message: 'Failed to save',
        type: 'error',
      };

      expect(status.type).toBe('error');
    });

    it('should validate warning status', () => {
      const status: StatusMessage = {
        message: 'Configuration not fully saved',
        type: 'warning',
      };

      expect(status.type).toBe('warning');
    });

    it('should validate info status', () => {
      const status: StatusMessage = {
        message: 'Loading configuration...',
        type: 'info',
      };

      expect(status.type).toBe('info');
    });

    it('should support all status types', () => {
      const types: StatusMessage['type'][] = ['success', 'error', 'warning', 'info'];

      expect(types).toContain('success');
      expect(types).toContain('error');
      expect(types).toContain('warning');
      expect(types).toContain('info');
    });
  });

  describe('Tab Types', () => {
    it('should validate tab type', () => {
      const tab: TabType = 'instances';
      expect(['instances', 'tools', 'prompts', 'server']).toContain(tab);
    });

    it('should support all tab types', () => {
      const tabs: TabType[] = ['instances', 'tools', 'prompts', 'server'];

      expect(tabs.length).toBe(4);
      expect(tabs).toContain('tools');
    });

    it('should switch between tabs', () => {
      let currentTab: TabType = 'instances';
      const validTabs: TabType[] = ['instances', 'tools', 'prompts', 'server'];

      const switchTab = (newTab: TabType) => {
        if (validTabs.includes(newTab)) {
          currentTab = newTab;
        }
      };

      switchTab('tools');
      expect(currentTab).toBe('tools');

      switchTab('prompts');
      expect(currentTab).toBe('prompts');
    });
  });

  describe('Configuration Integration', () => {
    it('should combine all configs', () => {
      const fullConfig = {
        instances: {
          prod: { url: 'https://prod.example.com', db: 'prod_db' },
        } as InstanceConfig,
        tools: [{ name: 'tool1', description: 'Tool 1' }] as ToolConfig[],
        server: {
          serverName: 'test-mcp',
          instructions: 'Test',
        } as ServerConfig,
      };

      expect(fullConfig.instances.prod).toBeDefined();
      expect(fullConfig.tools.length).toBe(1);
      expect(fullConfig.server.serverName).toBe('test-mcp');
    });

    it('should handle config updates', () => {
      let config: InstanceConfig = { prod: { url: 'http://old', db: 'old' } };

      config = {
        ...config,
        prod: { ...config.prod, url: 'http://new' },
      };

      expect(config.prod.url).toBe('http://new');
    });

    it('should add new instances', () => {
      let config: InstanceConfig = { prod: { url: 'http://prod', db: 'prod' } };

      config = {
        ...config,
        test: { url: 'http://test', db: 'test' },
      };

      expect(Object.keys(config).length).toBe(2);
      expect(config.test).toBeDefined();
    });
  });

  describe('Type Guards', () => {
    it('should validate instance config has required fields', () => {
      const data = { url: 'http://localhost', db: 'testdb' };

      const isValidInstance =
        'url' in data && 'db' in data;

      expect(isValidInstance).toBe(true);
    });

    it('should validate status message type', () => {
      const status = { message: 'Test', type: 'success' };

      const isValidStatus =
        'message' in status &&
        'type' in status &&
        ['success', 'error', 'warning', 'info'].includes(status.type as any);

      expect(isValidStatus).toBe(true);
    });
  });

  describe('Discriminated Unions', () => {
    it('should handle different message types', () => {
      const messages: StatusMessage[] = [
        { message: 'Success', type: 'success' },
        { message: 'Error occurred', type: 'error' },
        { message: 'Warning', type: 'warning' },
      ];

      messages.forEach(msg => {
        switch (msg.type) {
          case 'success':
            expect(msg.message).toContain('Success');
            break;
          case 'error':
            expect(msg.message).toContain('Error');
            break;
        }
      });
    });
  });
});
