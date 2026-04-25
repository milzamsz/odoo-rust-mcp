import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServerTab } from '../components/tabs/ServerTab';
import { useConfig } from '../hooks/useConfig';
import type { InstancesSyncStatusResponse } from '../types';

vi.mock('../hooks/useConfig', () => ({
  useConfig: vi.fn(),
}));

const mockedUseConfig = vi.mocked(useConfig);

function mockResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    text: vi.fn().mockResolvedValue(typeof data === 'string' ? data : JSON.stringify(data)),
    json: vi.fn().mockResolvedValue(data),
  } as unknown as Response;
}

describe('ServerTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseConfig.mockReturnValue({
      load: vi.fn().mockResolvedValue({
        serverName: 'Odoo MCP Server',
        instructions: 'Use Odoo safely.',
      }),
      save: vi.fn(),
      status: null,
      loading: false,
    });
    globalThis.fetch = vi.fn().mockResolvedValue(
      mockResponse({
        configured: true,
        synced_count: 1,
        total_count: 1,
        instances: {
          prod: 'synced',
        },
        extra_env_instances: [],
        runtime_source_kind: 'instances_json',
        instances_source_path: 'C:\\Users\\MILZAM\\.config\\odoo-rust-mcp\\instances.json',
        env_file_path: 'C:\\Users\\MILZAM\\.config\\odoo-rust-mcp\\env',
        alternate_sources: [],
      } satisfies InstancesSyncStatusResponse)
    ) as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('includes runtime and env snapshot information on Server Configuration', async () => {
    render(<ServerTab />);

    expect(await screen.findByText('Runtime & Env Snapshot')).toBeTruthy();
    expect(screen.getByRole('group', { name: /active source/i })).toBeTruthy();
    expect(screen.getByRole('group', { name: /env sync summary/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /sync to env/i })).toBeTruthy();
  });
});
