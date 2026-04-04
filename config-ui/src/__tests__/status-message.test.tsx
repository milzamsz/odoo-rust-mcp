import { render, screen } from '@testing-library/react';
import { AlertTriangle } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { StatusMessage } from '../components/StatusMessage';

describe('StatusMessage', () => {
  it('renders the default error icon when no override is provided', () => {
    const { container } = render(
      <StatusMessage
        status={{
          message: 'Something went wrong',
          type: 'error',
        }}
      />
    );

    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(container.querySelector('.lucide-circle-alert')).not.toBeNull();
  });

  it('renders an override icon when one is provided', () => {
    const { container } = render(
      <StatusMessage
        status={{
          message: 'Sync to Env failed.',
          type: 'error',
        }}
        iconOverride={AlertTriangle}
      />
    );

    expect(screen.getByText('Sync to Env failed.')).toBeTruthy();
    expect(container.querySelector('.lucide-triangle-alert')).not.toBeNull();
    expect(container.querySelector('.lucide-circle-alert')).toBeNull();
  });
});
