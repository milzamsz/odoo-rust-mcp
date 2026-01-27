import { describe, it, expect } from 'vitest';
import * as Types from '../types';

describe('Source Code Imports', () => {
  it('should import and use ConfigType', () => {
    const configType: Types.ConfigType = 'instances';
    expect(configType).toBe('instances');
  });

  it('should import and validate InstanceConfig type', () => {
    const instance: Types.InstanceConfig = {
      url: 'https://demo.odoo.com',
      db: 'demo',
      username: 'admin',
      password: 'admin',
    };
    expect(instance.url).toBe('https://demo.odoo.com');
    expect(instance.db).toBe('demo');
  });

  it('should import and validate ToolConfig type', () => {
    const tool: Types.ToolConfig = {
      name: 'search_records',
      description: 'Search for records',
    };
    expect(tool.name).toBe('search_records');
  });

  it('should import and validate PromptConfig type', () => {
    const prompt: Types.PromptConfig = {
      name: 'help',
      description: 'Help prompt',
      content: 'How can I help you?',
    };
    expect(prompt.name).toBe('help');
  });

  it('should import and validate ServerConfig type', () => {
    const server: Types.ServerConfig = {
      name: 'Odoo MCP Server',
      version: '0.1.0',
    };
    expect(server.name).toBe('Odoo MCP Server');
  });

  it('should import and validate StatusMessage type', () => {
    const status: Types.StatusMessage = {
      message: 'Success',
      type: 'success',
    };
    expect(status.type).toBe('success');
  });

  it('should handle different status types', () => {
    const types: Types.StatusMessage['type'][] = ['success', 'error', 'loading', 'warning', 'info'];
    expect(types).toHaveLength(5);
  });

  it('should validate ToolCategory type', () => {
    const category: Types.ToolCategory = {
      name: 'General',
      tools: [],
    };
    expect(category.name).toBe('General');
    expect(Array.isArray(category.tools)).toBe(true);
  });
});
