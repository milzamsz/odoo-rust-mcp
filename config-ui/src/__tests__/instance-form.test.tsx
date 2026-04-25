import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InstanceForm } from '../components/InstanceForm';
import type { InstanceDetails } from '../types';

describe('InstanceForm', () => {
  it('does not render an aliases field anymore', () => {
    render(
      <InstanceForm
        instanceName={null}
        instanceData={null}
        existingNames={[]}
        availableTools={[]}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.queryByLabelText('Aliases')).toBeNull();
    expect(screen.queryByText('Aliases')).toBeNull();
  });

  it('allows API key instances to omit the database name', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();

    render(
      <InstanceForm
        instanceName={null}
        instanceData={null}
        existingNames={[]}
        availableTools={[]}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );

    await user.type(
      screen.getByPlaceholderText('e.g., production, local, staging'),
      'erp-kdkmp'
    );
    await user.type(
      screen.getByPlaceholderText('e.g., https://odoo.example.com'),
      'https://erp.kdkmpindonesia.co.id'
    );
    await user.click(screen.getByRole('radio', { name: /API Key/i }));
    await user.type(screen.getByPlaceholderText('Enter API key'), 'secret-api-key');
    await user.click(screen.getByRole('button', { name: 'Add Instance' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const [, savedConfig] = onSave.mock.calls[0];
    expect(savedConfig).toMatchObject({
      url: 'https://erp.kdkmpindonesia.co.id',
      apiKey: 'secret-api-key',
    });
    expect(savedConfig.db).toBeUndefined();
  });

  it('keeps the database name required for username/password instances', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();

    render(
      <InstanceForm
        instanceName={null}
        instanceData={null}
        existingNames={[]}
        availableTools={[]}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );

    await user.type(
      screen.getByPlaceholderText('e.g., production, local, staging'),
      'legacy-instance'
    );
    await user.type(
      screen.getByPlaceholderText('e.g., https://odoo.example.com'),
      'https://legacy.example.com'
    );
    await user.type(screen.getByPlaceholderText('e.g., admin@example.com'), 'admin');
    await user.type(screen.getByPlaceholderText('Enter password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Add Instance' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(
      screen.getByText('Database name is required when using username/password authentication')
    ).toBeTruthy();
  });

  it('drops legacy alias data when editing an existing instance', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();

    render(
      <InstanceForm
        instanceName="erp-kdkmp"
        instanceData={
          {
            url: 'https://erp.kdkmpindonesia.co.id',
            apiKey: 'secret-api-key',
            aliases: ['legacy-name'],
          } as InstanceDetails & { aliases: string[] }
        }
        existingNames={['erp-kdkmp']}
        availableTools={[]}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Update Instance' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const [, savedConfig] = onSave.mock.calls[0];
    expect(savedConfig.aliases).toBeUndefined();
  });

  it('loads and saves normalized manual tags', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();

    render(
      <InstanceForm
        instanceName="erp-kdkmp"
        instanceData={{
          url: 'https://erp.kdkmpindonesia.co.id',
          apiKey: 'secret-api-key',
          tags: ['prod', 'KDKMP'],
        }}
        existingNames={['erp-kdkmp']}
        availableTools={[]}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );

    const tagsInput = screen.getByLabelText('Tags') as HTMLTextAreaElement;
    expect(tagsInput.value).toBe('prod, KDKMP');

    await user.clear(tagsInput);
    await user.type(tagsInput, 'prod, finance\nPROD, kdkmp, Finance');
    await user.click(screen.getByRole('button', { name: 'Update Instance' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const [, savedConfig] = onSave.mock.calls[0];
    expect(savedConfig.tags).toEqual(['prod', 'finance', 'kdkmp']);
  });

  it('omits manual tags when the tag field is blank', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();

    render(
      <InstanceForm
        instanceName="erp-kdkmp"
        instanceData={{
          url: 'https://erp.kdkmpindonesia.co.id',
          apiKey: 'secret-api-key',
          tags: ['prod'],
        }}
        existingNames={['erp-kdkmp']}
        availableTools={[]}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );

    await user.clear(screen.getByLabelText('Tags'));
    await user.click(screen.getByRole('button', { name: 'Update Instance' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const [, savedConfig] = onSave.mock.calls[0];
    expect(savedConfig.tags).toBeUndefined();
  });
});
