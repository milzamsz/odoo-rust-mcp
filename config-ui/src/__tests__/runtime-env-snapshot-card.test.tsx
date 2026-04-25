import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RuntimeEnvSnapshotCard } from '../components/RuntimeEnvSnapshotCard';
import type { InstancesSyncStatusResponse, SyncInstancesEnvResponse } from '../types';

const initialSyncStatus: InstancesSyncStatusResponse = {
  configured: true,
  synced_count: 1,
  total_count: 3,
  instances: {
    alpha: 'synced',
    beta: 'out_of_sync',
    gamma: 'not_synced',
  },
  extra_env_instances: ['legacy'],
  runtime_source_kind: 'instances_json',
  instances_source_path: 'C:\\Users\\MILZAM\\.config\\odoo-rust-mcp\\instances.json',
  env_file_path: 'C:\\Users\\MILZAM\\.config\\odoo-rust-mcp\\env',
  alternate_sources: [
    {
      path: 'C:\\Projects\\MCP\\odoo-rust-mcp\\instances.json',
      status: 'stale',
    },
  ],
};

function resetStorage() {
  if (typeof localStorage.clear === 'function') {
    localStorage.clear();
    return;
  }

  localStorage.removeItem('mcp_config_token');
}

function mockResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    text: vi.fn().mockResolvedValue(typeof data === 'string' ? data : JSON.stringify(data)),
    json: vi.fn().mockResolvedValue(data),
  } as unknown as Response;
}

describe('RuntimeEnvSnapshotCard', () => {
  beforeEach(() => {
    resetStorage();
    vi.clearAllMocks();
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(initialSyncStatus)) as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders runtime source, env snapshot summary, and alternate source details', async () => {
    render(<RuntimeEnvSnapshotCard />);

    const sourcePanel = await screen.findByRole('group', { name: /active source/i });
    const summaryPanel = screen.getByRole('group', { name: /env sync summary/i });

    expect(screen.getByText('Runtime & Env Snapshot')).toBeTruthy();
    expect(within(sourcePanel).getByText('Instances JSON')).toBeTruthy();
    expect(
      within(sourcePanel).getByText('C:\\Projects\\MCP\\odoo-rust-mcp\\instances.json')
    ).toBeTruthy();
    expect(
      within(sourcePanel).getByText(/At least one alternate `instances\.json` disagrees/i)
    ).toBeTruthy();
    expect(within(summaryPanel).getByText('Env Snapshot')).toBeTruthy();
    expect(within(summaryPanel).getByText('1/3')).toBeTruthy();
    expect(within(summaryPanel).getByLabelText('Synced: 1')).toBeTruthy();
    expect(within(summaryPanel).getByLabelText('Out of sync: 1')).toBeTruthy();
    expect(within(summaryPanel).getByLabelText('Not synced: 1')).toBeTruthy();
    expect(within(summaryPanel).getByText('Env-only instances: legacy')).toBeTruthy();
    expect(screen.getByRole('button', { name: /sync to env/i })).toBeTruthy();
  });

  it('confirms and syncs instances into the env snapshot from Server Configuration', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockResponse({
          configured: false,
          synced_count: 0,
          total_count: 2,
          instances: {
            alpha: 'not_synced',
            beta: 'not_synced',
          },
          extra_env_instances: [],
          runtime_source_kind: 'instances_json',
          instances_source_path: 'C:\\Users\\MILZAM\\.config\\odoo-rust-mcp\\instances.json',
          env_file_path: 'C:\\Users\\MILZAM\\.config\\odoo-rust-mcp\\env',
          alternate_sources: [],
        } satisfies InstancesSyncStatusResponse)
      )
      .mockResolvedValueOnce(
        mockResponse({
          status: 'synced',
          message:
            'Synced 2 instance(s) to ODOO_INSTANCES in the env file. Env-based launches may require a restart to pick up the snapshot.',
          restart_required: true,
          instances_synced: 2,
          configured: true,
          synced_count: 2,
          total_count: 2,
          instances: {
            alpha: 'synced',
            beta: 'synced',
          },
          extra_env_instances: [],
          runtime_source_kind: 'instances_json',
          instances_source_path: 'C:\\Users\\MILZAM\\.config\\odoo-rust-mcp\\instances.json',
          env_file_path: 'C:\\Users\\MILZAM\\.config\\odoo-rust-mcp\\env',
          alternate_sources: [],
        } satisfies SyncInstancesEnvResponse)
      );
    globalThis.fetch = fetchMock as typeof fetch;

    render(<RuntimeEnvSnapshotCard />);

    await screen.findByText('0/2');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /sync to env/i }));

    await screen.findByText('Sync Instances to Env');
    const dialogRoot = screen.getByRole('dialog');
    await user.click(within(dialogRoot).getByRole('button', { name: /^sync to env$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        '/api/config/instances/sync-env',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    expect(await screen.findByText('2/2')).toBeTruthy();
    expect(
      screen.getByText(
        'Synced 2 instance(s) to ODOO_INSTANCES in the env file. Env-based launches may require a restart to pick up the snapshot.'
      )
    ).toBeTruthy();
  });

  it('shows an updated-server hint when the running backend is missing sync support', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockResponse({
          configured: false,
          synced_count: 0,
          total_count: 1,
          instances: {
            alpha: 'not_synced',
          },
          extra_env_instances: [],
          runtime_source_kind: 'instances_json',
          instances_source_path: 'C:\\Users\\MILZAM\\.config\\odoo-rust-mcp\\instances.json',
          env_file_path: 'C:\\Users\\MILZAM\\.config\\odoo-rust-mcp\\env',
          alternate_sources: [],
        } satisfies InstancesSyncStatusResponse)
      )
      .mockResolvedValueOnce(mockResponse('<!doctype html><html>Not found</html>', false, 404));
    globalThis.fetch = fetchMock as typeof fetch;

    render(<RuntimeEnvSnapshotCard />);

    await screen.findByText('0/1');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /sync to env/i }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^sync to env$/i }));

    expect(
      await screen.findByText(
        'Sync to Env is not available in the running server build. Restart using the updated MCP server.'
      )
    ).toBeTruthy();
  });
});
