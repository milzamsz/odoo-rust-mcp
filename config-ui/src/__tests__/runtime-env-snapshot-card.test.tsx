import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RuntimeEnvSnapshotCard } from '../components/RuntimeEnvSnapshotCard';
import { renderWithProviders } from '../test/renderWithProviders';

describe('RuntimeEnvSnapshotCard', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders runtime summary and alternate source details', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          configured: true,
          synced_count: 2,
          total_count: 3,
          instances: {},
          extra_env_instances: ['extra'],
          runtime_source_kind: 'instances_json',
          instances_source_path: '/tmp/instances.json',
          env_file_path: '/tmp/env',
          alternate_sources: [{ path: '/repo/instances.json', status: 'stale' }],
        }),
    });

    renderWithProviders(<RuntimeEnvSnapshotCard />);

    expect(await screen.findByText(/env snapshot posture/i)).toBeInTheDocument();
    expect(screen.getByText('/tmp/instances.json')).toBeInTheDocument();
    expect(screen.getByText(/extra env entries/i)).toBeInTheDocument();
    expect(screen.getByText(/alternate sources nearby/i)).toBeInTheDocument();
  });

  it('syncs instances to env from the card action', async () => {
    const user = userEvent.setup();

    fetchMock
      .mockResolvedValueOnce({
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
      .mockResolvedValueOnce({
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
            restart_required: false,
            message: 'Synced',
          }),
      });

    renderWithProviders(<RuntimeEnvSnapshotCard />);

    await screen.findByText(/env snapshot posture/i);
    await user.click(screen.getByRole('button', { name: /sync to env/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        '/api/config/instances/sync-env',
        expect.objectContaining({ method: 'POST' })
      )
    );
  });
});
