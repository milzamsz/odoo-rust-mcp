import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ServerTab } from '../components/tabs/ServerTab';
import { renderWithProviders } from '../test/renderWithProviders';

const loadMock = vi.fn();
const saveMock = vi.fn();

vi.mock('../hooks/useConfig', () => ({
  useConfig: (type: string) => {
    if (type === 'server') {
      return { load: loadMock, save: saveMock, loading: false };
    }
    return { load: vi.fn(), save: vi.fn(), loading: false };
  },
}));

describe('ServerTab', () => {
  beforeEach(() => {
    loadMock.mockReset();
    saveMock.mockReset();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            configured: true,
            synced_count: 1,
            total_count: 1,
            instances: {},
            extra_env_instances: [],
            runtime_source_kind: 'instances_json',
            instances_source_path: '/tmp/instances.json',
            env_file_path: '/tmp/env',
            alternate_sources: [],
          }),
      })
    );
  });

  it('shows editable server fields and runtime sync information', async () => {
    loadMock.mockResolvedValue({
      serverName: 'Odoo MCP',
      instructions: 'Hello world',
      protocolVersionDefault: '2024-11-05',
    });

    renderWithProviders(<ServerTab />);

    expect(await screen.findByDisplayValue('Odoo MCP')).toBeInTheDocument();
    expect(screen.getByText(/env snapshot posture/i)).toBeInTheDocument();
    expect(screen.getByText('/tmp/instances.json')).toBeInTheDocument();
  }, 15000);
});
