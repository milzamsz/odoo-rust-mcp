import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstancesTab } from '../components/tabs/InstancesTab';
import { useConfig } from '../hooks/useConfig';
import type {
  InstanceConfig,
  InstancesSyncStatusResponse,
  SyncInstancesEnvResponse,
  ToolConfig,
} from '../types';

vi.mock('../hooks/useConfig', () => ({
  useConfig: vi.fn(),
}));

const mockedUseConfig = vi.mocked(useConfig);

const instancesFixture: InstanceConfig = {
  alpha: {
    url: 'https://alpha.example.com',
    db: 'alpha',
    apiKey: 'alpha-key',
  },
  beta: {
    url: 'https://beta.example.com',
    db: 'beta',
    apiKey: 'beta-key',
  },
  gamma: {
    url: 'https://gamma.example.com',
    db: 'gamma',
    username: 'admin',
    password: 'secret',
  },
};

const toolsFixture: ToolConfig[] = [
  { name: 'odoo_search_read', description: 'Search and read records' },
  { name: 'odoo_create', description: 'Create records' },
];

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

function setupUseConfig(instances: InstanceConfig) {
  const loadInstances = vi.fn().mockResolvedValue(instances);
  const saveInstances = vi.fn().mockResolvedValue(undefined);
  const loadTools = vi.fn().mockResolvedValue(toolsFixture);

  mockedUseConfig.mockImplementation((type) => {
    if (type === 'instances') {
      return {
        load: loadInstances,
        save: saveInstances,
        status: null,
        loading: false,
      };
    }

    if (type === 'tools') {
      return {
        load: loadTools,
        save: vi.fn(),
        status: null,
        loading: false,
      };
    }

    return {
      load: vi.fn(),
      save: vi.fn(),
      status: null,
      loading: false,
    };
  });

  return { loadInstances, saveInstances, loadTools };
}

function getInstanceRow(name: string): HTMLElement {
  const nameCell = screen
    .getAllByText(name)
    .find((element) => element.className.includes('font-medium'));

  if (!nameCell) {
    throw new Error(`Could not find instance row for ${name}`);
  }

  return nameCell.closest('tr') as HTMLElement;
}

describe('InstancesTab', () => {
  beforeEach(() => {
    resetStorage();
    vi.clearAllMocks();
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(initialSyncStatus)) as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the env sync summary and per-row sync badges', async () => {
    setupUseConfig(instancesFixture);

    render(<InstancesTab />);

    const summaryPanel = await screen.findByRole('group', { name: /env sync summary/i });
    expect(within(summaryPanel).getByText('Env Snapshot')).toBeTruthy();
    expect(within(summaryPanel).getByText('1/3')).toBeTruthy();
    expect(within(summaryPanel).getByText('1 Synced')).toBeTruthy();
    expect(within(summaryPanel).getByText('1 Out of sync')).toBeTruthy();
    expect(within(summaryPanel).getByText('1 Not synced')).toBeTruthy();
    expect(within(summaryPanel).getByText('Env-only instances: legacy')).toBeTruthy();

    const alphaRow = getInstanceRow('alpha');
    const betaRow = getInstanceRow('beta');
    const gammaRow = getInstanceRow('gamma');

    expect(within(alphaRow).getByText('Synced')).toBeTruthy();
    expect(within(betaRow).getByText('Out of sync')).toBeTruthy();
    expect(within(gammaRow).getByText('Not synced')).toBeTruthy();
  });

  it('disables the sync button when no instances are configured', async () => {
    setupUseConfig({});
    globalThis.fetch = vi.fn().mockResolvedValue(
      mockResponse({
        configured: false,
        synced_count: 0,
        total_count: 0,
        instances: {},
        extra_env_instances: [],
      } satisfies InstancesSyncStatusResponse)
    ) as typeof fetch;

    render(<InstancesTab />);

    await screen.findByText('Configured Instances (0)');
    const syncButton = screen.getByRole('button', { name: /sync to env/i }) as HTMLButtonElement;
    expect(syncButton.disabled).toBe(true);
  });

  it('confirms and syncs instances into the env snapshot', async () => {
    const { loadInstances } = setupUseConfig({
      alpha: instancesFixture.alpha,
      beta: instancesFixture.beta,
    });
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
        } satisfies InstancesSyncStatusResponse)
      )
      .mockResolvedValueOnce(
        mockResponse({
          status: 'synced',
          message:
            'Synced 2 instance(s) to ODOO_INSTANCES in the env file. Restart required to apply.',
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
        } satisfies SyncInstancesEnvResponse)
      );
    globalThis.fetch = fetchMock as typeof fetch;

    render(<InstancesTab />);

    const pageActions = await screen.findByRole('group', { name: /page actions/i });
    const tableActions = screen.getByRole('group', { name: /instance table actions/i });

    expect(within(pageActions).queryByRole('button', { name: /sync to env/i })).toBeNull();
    expect(
      within(tableActions)
        .getAllByRole('button')
        .map((button) => button.textContent?.trim())
    ).toEqual(['Sync to Env', 'Test All', 'Refresh']);

    await screen.findByText('0/2');

    expect(
      screen
        .getByRole('button', { name: /sync to env/i })
        .querySelector('.lucide-arrow-left-right')
    ).not.toBeNull();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /sync to env/i }));

    await screen.findByText('Sync Instances to Env');
    const dialogRoot = screen.getByRole('dialog');
    expect(
      within(dialogRoot)
        .getByRole('button', { name: /^sync to env$/i })
        .querySelector('.lucide-arrow-left-right')
    ).not.toBeNull();

    await user.click(
      within(dialogRoot).getByRole('button', { name: /^sync to env$/i })
    );

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
        'Synced 2 instance(s) to ODOO_INSTANCES in the env file. Restart required to apply.'
      )
    ).toBeTruthy();
    await waitFor(() => expect(loadInstances).toHaveBeenCalledTimes(2));
  });

  it('shows an updated-server hint when the running backend is missing sync support', async () => {
    setupUseConfig({
      alpha: instancesFixture.alpha,
    });
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
        } satisfies InstancesSyncStatusResponse)
      )
      .mockResolvedValueOnce(mockResponse('<!doctype html><html>Not found</html>', false, 404));
    globalThis.fetch = fetchMock as typeof fetch;

    render(<InstancesTab />);

    await screen.findByText('0/1');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /sync to env/i }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^sync to env$/i }));

    expect(
      await screen.findByText(
        'Sync to Env is not available in the running server build. Restart using the updated MCP server.'
      )
    ).toBeTruthy();
    expect(document.querySelector('.lucide-triangle-alert')).not.toBeNull();
  });

  it('shows an HTTP 500 message when sync fails without details', async () => {
    setupUseConfig({
      alpha: instancesFixture.alpha,
    });
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
        } satisfies InstancesSyncStatusResponse)
      )
      .mockResolvedValueOnce(mockResponse('', false, 500));
    globalThis.fetch = fetchMock as typeof fetch;

    render(<InstancesTab />);

    await screen.findByText('0/1');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /sync to env/i }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^sync to env$/i }));

    expect(
      await screen.findByText(
        'Sync to Env failed on the server (HTTP 500). Check the server logs and try again.'
      )
    ).toBeTruthy();
  });

  it('shows a connectivity-specific message for sync network failures', async () => {
    setupUseConfig({
      alpha: instancesFixture.alpha,
    });
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
        } satisfies InstancesSyncStatusResponse)
      )
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    globalThis.fetch = fetchMock as typeof fetch;

    render(<InstancesTab />);

    await screen.findByText('0/1');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /sync to env/i }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^sync to env$/i }));

    expect(
      await screen.findByText('Sync to Env failed. Could not reach the Config UI API.')
    ).toBeTruthy();
  });
});
