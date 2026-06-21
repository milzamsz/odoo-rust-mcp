import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { AppShellLayout } from '../components/AppShellLayout';
import { DirtyStateProvider } from '../components/DirtyState';
import { appTheme } from '../theme';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    username: 'admin',
    logout: vi.fn(),
  }),
}));

const getBoundingClientRectSpy = vi
  .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
  .mockImplementation(() => DOMRect.fromRect({ x: 0, y: 0, width: 160, height: 40 }));

afterEach(() => {
  getBoundingClientRectSpy.mockClear();
});

function renderLayout(initialPath = '/instances') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <MantineProvider theme={appTheme} defaultColorScheme="auto">
        <ModalsProvider>
          <Notifications />
          <DirtyStateProvider>
            <Routes>
              <Route element={<AppShellLayout />}>
                <Route path="/instances" element={<div>Instances screen</div>} />
                <Route path="/" element={<div>Overview screen</div>} />
              </Route>
            </Routes>
          </DirtyStateProvider>
        </ModalsProvider>
      </MantineProvider>
    </MemoryRouter>
  );
}

describe('AppShellLayout', () => {
  it('renders a documentation sidebar link with correct native attributes in browser', () => {
    renderLayout();
    const link = screen.getByRole('link', { name: 'Documentation (opens in a new tab)' });
    expect(link).toHaveAttribute('href', 'https://milzamsz.github.io/odoo-rust-mcp/');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('intercepts click and opens via Tauri API when in Tauri environment', async () => {
    const user = userEvent.setup();
    const invokeSpy = vi.fn().mockResolvedValue(null);
    (window as unknown as { __TAURI__?: Record<string, unknown> }).__TAURI__ = {
      core: {
        invoke: invokeSpy,
      },
    };
    renderLayout();

    await user.click(screen.getByRole('link', { name: 'Documentation (opens in a new tab)' }));

    expect(invokeSpy).toHaveBeenCalledWith('plugin:opener|open_url', {
      url: 'https://milzamsz.github.io/odoo-rust-mcp/',
    });

    delete (window as unknown as { __TAURI__?: Record<string, unknown> }).__TAURI__;
  });

  it('renders the shared Rust Hexagon application mark', () => {
    renderLayout();

    expect(screen.getByTestId('app-mark')).toBeInTheDocument();
  });

  it('offers light, dark, and auto theme modes', async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole('button', { name: /theme mode/i }));

    expect(await screen.findByRole('menuitem', { name: /^Light$/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^Dark$/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^Auto$/i })).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: /^Dark$/i }));
    expect(document.documentElement.getAttribute('data-mantine-color-scheme')).toBe('dark');

    await user.click(screen.getByRole('button', { name: /theme mode/i }));
    await user.click(screen.getByRole('menuitem', { name: /^Light$/i }));
    expect(document.documentElement.getAttribute('data-mantine-color-scheme')).toBe('light');
  }, 30000);
});
