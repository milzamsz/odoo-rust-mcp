import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InstanceForm } from '../components/InstanceForm';
import type { InstanceDetails, ToolConfig } from '../types';

const availableTools: ToolConfig[] = [
  { name: 'odoo_search_read', description: 'Search and read records' },
  { name: 'odoo_read', description: 'Read a record' },
  { name: 'odoo_create', description: 'Create a record' },
  { name: 'odoo_database_cleanup', description: 'Cleanup a database' },
  { name: 'custom_tool', description: 'Custom operation' },
];

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText(/production, local, staging/i), 'school-prod');
  await user.type(
    screen.getByPlaceholderText(/https:\/\/odoo\.example\.com/i),
    'https://odoo.example.com'
  );
  await user.type(screen.getByPlaceholderText(/production_db/i), 'school');
  await user.type(screen.getByPlaceholderText(/admin@example\.com/i), 'admin');
  await user.type(screen.getByPlaceholderText(/enter password/i), 'secret');
}

describe('InstanceForm tool access', () => {
  it('loads existing disabled tools and shows enabled count summary', () => {
    const instanceData: InstanceDetails = {
      url: 'https://odoo.example.com',
      db: 'school',
      apiKey: 'secret',
      version: '19',
      toolConfig: {
        disabledTools: ['odoo_create'],
        defaults: {
          odoo_search_read: {
            limit: 10,
          },
        },
      },
    };

    render(
      <InstanceForm
        instanceName="school-prod"
        instanceData={instanceData}
        existingNames={['school-prod']}
        availableTools={availableTools}
        onSave={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByText('4/5 enabled')).not.toBeNull();
    expect(
      (screen.getByRole('checkbox', { name: /enable odoo_create/i }) as HTMLInputElement).checked
    ).toBe(false);
    expect(screen.queryByRole('button', { name: /add default/i })).toBeNull();
  });

  it('disables every tool in a group when using the group action', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <InstanceForm
        instanceName={null}
        instanceData={null}
        existingNames={[]}
        availableTools={availableTools}
        onSave={onSave}
        onCancel={() => {}}
      />
    );

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /disable read operations/i }));
    await user.click(screen.getByRole('button', { name: /add instance/i }));

    const [, data] = onSave.mock.calls[0] as [string, InstanceDetails];
    expect(data.toolConfig).toEqual({
      disabledTools: ['odoo_read', 'odoo_search_read'],
    });
  });

  it('re-enables every tool in a group when using the group action', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const instanceData: InstanceDetails = {
      url: 'https://odoo.example.com',
      db: 'school',
      username: 'admin',
      password: 'secret',
      toolConfig: {
        disabledTools: ['odoo_read', 'odoo_search_read'],
        defaults: {
          odoo_search_read: {
            limit: 10,
          },
        },
      },
    };

    render(
      <InstanceForm
        instanceName="school-prod"
        instanceData={instanceData}
        existingNames={['school-prod']}
        availableTools={availableTools}
        onSave={onSave}
        onCancel={() => {}}
      />
    );

    await user.click(screen.getByRole('button', { name: /enable read operations/i }));
    await user.click(screen.getByRole('button', { name: /update instance/i }));

    const [, data] = onSave.mock.calls[0] as [string, InstanceDetails];
    expect(data.toolConfig).toBeUndefined();
  });

  it('saves individual tool toggles and clears legacy defaults from the payload', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const instanceData: InstanceDetails = {
      url: 'https://odoo.example.com',
      db: 'school',
      username: 'admin',
      password: 'secret',
      toolConfig: {
        defaults: {
          odoo_search_read: {
            limit: 20,
          },
        },
      },
    };

    render(
      <InstanceForm
        instanceName="school-prod"
        instanceData={instanceData}
        existingNames={['school-prod']}
        availableTools={availableTools}
        onSave={onSave}
        onCancel={() => {}}
      />
    );

    await user.click(screen.getByRole('checkbox', { name: /enable odoo_create/i }));
    expect(screen.getByText('4/5 enabled')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: /update instance/i }));

    const [, data] = onSave.mock.calls[0] as [string, InstanceDetails];
    expect(data.toolConfig).toEqual({
      disabledTools: ['odoo_create'],
    });
  });
});
