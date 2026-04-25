import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstancesTab } from '../components/tabs/InstancesTab';
import { useConfig } from '../hooks/useConfig';
import type { InstanceConfig, ToolConfig } from '../types';

vi.mock('../hooks/useConfig', () => ({
  useConfig: vi.fn(),
}));

const mockedUseConfig = vi.mocked(useConfig);

const instancesFixture: InstanceConfig = {
  alpha: {
    url: 'https://alpha.example.com',
    db: 'alpha',
    apiKey: 'alpha-key',
    tags: ['prod', 'kdkmp'],
  },
  beta: {
    url: 'https://beta.example.com',
    db: 'finance',
    apiKey: 'beta-key',
    version: '19',
    tags: ['finance'],
  },
  gamma: {
    url: 'https://gamma.example.com',
    db: 'legacy_db',
    username: 'admin',
    password: 'secret',
    version: '18',
  },
};

const toolsFixture: ToolConfig[] = [
  { name: 'odoo_search_read', description: 'Search and read records' },
  { name: 'odoo_create', description: 'Create records' },
];

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

function getInstanceCard(name: string): HTMLElement {
  return screen.getByTestId(`instance-card-${name}`);
}

function queryInstanceCard(name: string): HTMLElement | null {
  return screen.queryByTestId(`instance-card-${name}`);
}

async function renderInstancesTab(instances: InstanceConfig = instancesFixture) {
  const setup = setupUseConfig(instances);
  render(<InstancesTab />);
  await screen.findByText(`Configured Instances (${Object.keys(instances).length})`);
  return setup;
}

describe('InstancesTab', () => {
  beforeEach(() => {
    resetStorage();
    vi.clearAllMocks();
    globalThis.fetch = vi.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        latency_ms: 42,
      })
    ) as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps env sync/source information off the Odoo Instances page', async () => {
    await renderInstancesTab();

    expect(screen.queryByRole('button', { name: /sync to env/i })).toBeNull();
    expect(screen.queryByRole('group', { name: /active source/i })).toBeNull();
    expect(screen.queryByRole('group', { name: /env sync summary/i })).toBeNull();
    expect(screen.queryByText('Runtime & Env Snapshot')).toBeNull();
  });

  it('shows connection metadata and manual tags in the refreshed instance cards', async () => {
    await renderInstancesTab();

    const alphaCard = getInstanceCard('alpha');
    expect(within(alphaCard).getByText('https://alpha.example.com')).toBeTruthy();
    expect(within(alphaCard).getByText('API Key')).toBeTruthy();
    expect(within(alphaCard).getAllByText('alpha').length).toBeGreaterThan(0);
    expect(within(alphaCard).getByText('2/2 enabled')).toBeTruthy();
    expect(within(alphaCard).getByText('prod')).toBeTruthy();
    expect(within(alphaCard).getByText('kdkmp')).toBeTruthy();
  });

  it('filters instances by name, URL, DB, auth mode, version, and tags', async () => {
    await renderInstancesTab();
    const user = userEvent.setup();
    const searchInput = screen.getByRole('searchbox', { name: /search odoo instances/i });

    await user.type(searchInput, 'alpha.example');
    expect(queryInstanceCard('alpha')).toBeTruthy();
    expect(queryInstanceCard('beta')).toBeNull();
    expect(queryInstanceCard('gamma')).toBeNull();
    expect(screen.getByText('Showing 1 of 3')).toBeTruthy();

    await user.clear(searchInput);
    await user.type(searchInput, 'finance');
    expect(queryInstanceCard('alpha')).toBeNull();
    expect(queryInstanceCard('beta')).toBeTruthy();
    expect(queryInstanceCard('gamma')).toBeNull();

    await user.clear(searchInput);
    await user.type(searchInput, 'username');
    expect(queryInstanceCard('alpha')).toBeNull();
    expect(queryInstanceCard('beta')).toBeNull();
    expect(queryInstanceCard('gamma')).toBeTruthy();

    await user.clear(searchInput);
    await user.type(searchInput, '19');
    expect(queryInstanceCard('alpha')).toBeNull();
    expect(queryInstanceCard('beta')).toBeTruthy();
    expect(queryInstanceCard('gamma')).toBeNull();

    await user.clear(searchInput);
    await user.type(searchInput, 'kdkmp');
    expect(queryInstanceCard('alpha')).toBeTruthy();
    expect(queryInstanceCard('beta')).toBeNull();
    expect(queryInstanceCard('gamma')).toBeNull();
  });

  it('filters with tag chips and can clear filters', async () => {
    await renderInstancesTab();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'kdkmp' }));

    expect(queryInstanceCard('alpha')).toBeTruthy();
    expect(queryInstanceCard('beta')).toBeNull();
    expect(queryInstanceCard('gamma')).toBeNull();
    expect(screen.getByText('Showing 1 of 3')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /clear filters/i }));

    expect(queryInstanceCard('alpha')).toBeTruthy();
    expect(queryInstanceCard('beta')).toBeTruthy();
    expect(queryInstanceCard('gamma')).toBeTruthy();
    expect(screen.getByText('Showing 3 of 3')).toBeTruthy();
  });

  it('shows a clean empty filter state', async () => {
    await renderInstancesTab();
    const user = userEvent.setup();

    await user.type(
      screen.getByRole('searchbox', { name: /search odoo instances/i }),
      'nothing matches this'
    );

    expect(await screen.findByText('No instances match your filters')).toBeTruthy();
    expect(queryInstanceCard('alpha')).toBeNull();
    expect(screen.getAllByRole('button', { name: /clear filters/i })).toHaveLength(2);
  });

  it('keeps test connection actions working from the cleaned cards', async () => {
    await renderInstancesTab();
    const user = userEvent.setup();

    await user.click(within(getInstanceCard('alpha')).getByRole('button', { name: 'Test' }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/config/instances/alpha/test',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
    expect(within(getInstanceCard('alpha')).getByText('Healthy 42ms')).toBeTruthy();
  });
});
