import {
  Button,
  Card,
  Grid,
  Group,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ArrowClockwise, FloppyDisk, Plus, Trash } from '@phosphor-icons/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RuntimeEnvSnapshotCard } from '../RuntimeEnvSnapshotCard';
import { SectionTitle } from '../SectionTitle';
import { useConfig } from '../../hooks/useConfig';
import type { ServerConfig } from '../../types';

interface CustomField {
  key: string;
  value: string;
}

export function ServerTab() {
  const { load, save, loading } = useConfig('server');
  const [serverName, setServerName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [protocolVersionDefault, setProtocolVersionDefault] = useState('');
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  const loadServer = useCallback(async () => {
    try {
      const data = (await load()) as ServerConfig;
      setServerName(data.serverName || '');
      setInstructions(data.instructions || '');
      setProtocolVersionDefault(data.protocolVersionDefault || '');
      setCustomFields(
        Object.entries(data)
          .filter(([key]) => !['serverName', 'instructions', 'protocolVersionDefault'].includes(key))
          .map(([key, value]) => ({ key, value: String(value) }))
      );
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Load failed',
        message: error instanceof Error ? error.message : 'Failed to load server config',
      });
    }
  }, [load]);

  useEffect(() => {
    void loadServer();
  }, [loadServer]);

  const dirtyCount = useMemo(
    () =>
      [serverName, instructions, protocolVersionDefault, ...customFields.flatMap((field) => [field.key, field.value])]
        .filter((value) => value.trim()).length,
    [customFields, instructions, protocolVersionDefault, serverName]
  );

  const handleSave = async () => {
    const nextConfig: ServerConfig = {};

    if (serverName.trim()) {
      nextConfig.serverName = serverName.trim();
    }

    if (instructions.trim()) {
      nextConfig.instructions = instructions.trim();
    }

    if (protocolVersionDefault.trim()) {
      nextConfig.protocolVersionDefault = protocolVersionDefault.trim();
    }

    for (const field of customFields) {
      if (field.key.trim()) {
        nextConfig[field.key.trim()] = field.value;
      }
    }

    try {
      await save(nextConfig);
      notifications.show({
        color: 'green',
        title: 'Server config saved',
        message: 'Runtime metadata was updated and hot reloaded.',
      });
      await loadServer();
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Save failed',
        message: error instanceof Error ? error.message : 'Failed to save server config',
      });
    }
  };

  return (
    <Stack gap="xl">
      <div>
        <Title order={1}>Server configuration</Title>
        <Text className="page-lead" mt={4}>
          Adjust the metadata that MCP clients see, alongside the runtime source signals that help
          explain where instance data is really coming from.
        </Text>
      </div>

      <RuntimeEnvSnapshotCard />

      <Grid>
        <Grid.Col span={{ base: 12, xl: 8 }}>
          <Card p="lg" className="surface-panel">
            <Stack gap="lg">
              <Group justify="space-between">
                <SectionTitle
                  title="Editable fields"
                  subtitle="Save applies immediately to the live config manager."
                />
                <Text size="sm" c="dimmed">
                  {dirtyCount} populated field{dirtyCount === 1 ? '' : 's'}
                </Text>
              </Group>

              <TextInput
                label="Server name"
                placeholder="e.g. Odoo MCP Server"
                value={serverName}
                onChange={(event) => setServerName(event.currentTarget.value)}
              />

              <Textarea
                label="Instructions"
                placeholder="System instructions shown to clients..."
                value={instructions}
                onChange={(event) => setInstructions(event.currentTarget.value)}
                minRows={20}
                resize="vertical"
                styles={{ input: { minHeight: 400 } }}
              />

              <TextInput
                label="Protocol version default"
                placeholder="e.g. 2024-11-05"
                value={protocolVersionDefault}
                onChange={(event) => setProtocolVersionDefault(event.currentTarget.value)}
              />

              <Stack gap="sm">
                <Group justify="space-between">
                  <Title order={4}>Custom fields</Title>
                  <Button
                    variant="default"
                    leftSection={<Plus size={16} />}
                    onClick={() => setCustomFields((current) => [...current, { key: '', value: '' }])}
                  >
                    Add field
                  </Button>
                </Group>

                {customFields.map((field, index) => (
                  <Group key={`${field.key}-${index}`} align="end">
                    <TextInput
                      label="Key"
                      placeholder="fieldName"
                      value={field.key}
                      onChange={(event) =>
                        setCustomFields((current) =>
                          current.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, key: event.currentTarget.value } : entry
                          )
                        )
                      }
                      style={{ flex: 1 }}
                    />
                    <TextInput
                      label="Value"
                      placeholder="Value"
                      value={field.value}
                      onChange={(event) =>
                        setCustomFields((current) =>
                          current.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, value: event.currentTarget.value } : entry
                          )
                        )
                      }
                      style={{ flex: 1 }}
                    />
                    <Button
                      color="red"
                      variant="light"
                      onClick={() =>
                        setCustomFields((current) => current.filter((_, entryIndex) => entryIndex !== index))
                      }
                    >
                      <Trash size={16} />
                    </Button>
                  </Group>
                ))}
              </Stack>

              <Group>
                <Button leftSection={<FloppyDisk size={16} />} loading={loading} onClick={() => void handleSave()}>
                  Save configuration
                </Button>
                <Button variant="default" leftSection={<ArrowClockwise size={16} />} onClick={() => void loadServer()}>
                  Refresh
                </Button>
              </Group>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, xl: 4 }}>
          <Card p="lg" className="surface-panel">
            <Title order={4} mb="md">
              Reference
            </Title>
            <Stack gap="sm">
              <Text size="sm">
                <code>serverName</code> is the display name exposed to MCP clients during initialize.
              </Text>
              <Text size="sm">
                <code>instructions</code> should stay concise and aligned with the checked-in server JSON.
              </Text>
              <Text size="sm">
                <code>protocolVersionDefault</code> sets the fallback protocol for clients that do not specify one.
              </Text>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
