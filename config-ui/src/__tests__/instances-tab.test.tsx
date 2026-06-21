import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InstancesTab } from '../components/tabs/InstancesTab';
import { renderWithProviders } from '../test/renderWithProviders';

const instancesLoadMock = vi.fn();
const toolsLoadMock = vi.fn();
const saveMock = vi.fn();
const fetchMock = vi.fn();

vi.mock('../hooks/useConfig', () => ({
  useConfig: (type: string) => {
    if (type === 'instances') {
      return { load: instancesLoadMock, save: saveMock, loading: false };
    }
    if (type === 'tools') {
      return { load: toolsLoadMock, save: vi.fn(), loading: false };
    }
    return { load: vi.fn(), save: vi.fn(), loading: false };
  },
}));

describe('InstancesTab', () => {
  beforeEach(() => {
    instancesLoadMock.mockReset();
    toolsLoadMock.mockReset();
    saveMock.mockReset();
    fetchMock.mockReset();
    localStorage.clear();
    vi.stubGlobal('fetch', fetchMock);

    instancesLoadMock.mockResolvedValue({
      production: {
        url: 'https://prod.example.com',
        apiKey: 'secret',
        tags: ['prod', 'finance'],
      },
      legacy: {
        url: 'https://legacy.example.com',
        db: 'legacy_db',
        username: 'admin',
        password: 'admin',
        version: '18',
        tags: ['legacy'],
      },
    });

    toolsLoadMock.mockResolvedValue([
      { name: 'odoo_search' },
      { name: 'odoo_create' },
    ]);
  });

  it('shows instance cards with metadata and tag filters', async () => {
    localStorage.setItem('mcp_instances_view', 'card');
    renderWithProviders(<InstancesTab />);

    expect(await screen.findByText(/configured instances \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText('production')).toBeInTheDocument();
    expect(screen.getAllByText('legacy').length).toBeGreaterThan(0);
    expect(screen.getAllByText('prod')[0]).toBeInTheDocument();
    expect(screen.getByText(/api key/i)).toBeInTheDocument();
  }, 30000);

  it('switches to table view and supports column search plus shared search', async () => {
    const user = userEvent.setup();
    localStorage.setItem('mcp_instances_view', 'table');
    renderWithProviders(<InstancesTab />);

    await screen.findByText(/configured instances/i);
    const searchInputs = await screen.findAllByRole('textbox');
    await user.type(searchInputs[0], 'legacy');

    await waitFor(() => {
      expect(screen.getAllByText('legacy').length).toBeGreaterThan(0);
      expect(screen.queryByText('production')).not.toBeInTheDocument();
    });
  }, 30000);

  it('tests an instance connection from the table view', async () => {
    const user = userEvent.setup();
    localStorage.setItem('mcp_instances_view', 'table');
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true, latency_ms: 123 }),
    });

    renderWithProviders(<InstancesTab />);
    await screen.findByText(/configured instances/i);

    const row = screen.getByText('production').closest('tr');
    expect(row).not.toBeNull();
    await user.click(within(row as HTMLElement).getByRole('button', { name: /test/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/config/instances/production/test',
        expect.objectContaining({ method: 'POST' })
      )
    );

    expect(await screen.findByText(/healthy 123ms/i)).toBeInTheDocument();
  }, 30000);
});
