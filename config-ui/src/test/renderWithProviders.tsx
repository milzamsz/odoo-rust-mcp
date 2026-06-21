import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { DirtyStateProvider } from '../components/DirtyState';
import { appTheme } from '../theme';

export function renderWithProviders(ui: ReactElement, options?: { initialEntries?: string[] }) {
  return render(
    <MemoryRouter initialEntries={options?.initialEntries}>
      <MantineProvider theme={appTheme} defaultColorScheme="auto">
        <ModalsProvider>
          <Notifications />
          <DirtyStateProvider>{ui}</DirtyStateProvider>
        </ModalsProvider>
      </MantineProvider>
    </MemoryRouter>
  );
}
