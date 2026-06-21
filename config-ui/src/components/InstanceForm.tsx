import {
  Accordion,
  Badge,
  Box,
  Button,
  Drawer,
  Grid,
  Group,
  Radio,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { useEffect, useMemo, useState } from 'react';
import { useRegisterDirtyState } from '../hooks/useDirtyState';
import { SectionTitle } from './SectionTitle';
import { NameChip } from './NameChip';
import { getInstanceTags, parseInstanceTagsInput } from '../instanceTags';
import type { InstanceDetails, ToolConfig } from '../types';
import {
  ALL_GROUPED_TOOL_NAMES,
  countEnabledToolsForInstance,
  filterKnownDisabledTools,
  TOOL_GROUPS,
} from '../toolGroups';

interface InstanceFormProps {
  instanceName: string | null;
  instanceData: InstanceDetails | null;
  existingNames: string[];
  availableTools: ToolConfig[];
  onSave: (name: string, data: InstanceDetails) => void;
  onCancel: () => void;
}

type AuthType = 'apiKey' | 'userPass';

function isEdited(existingName: string | null, name: string) {
  return Boolean(existingName && existingName === name);
}

export function InstanceForm({
  instanceName,
  instanceData,
  existingNames,
  availableTools,
  onSave,
  onCancel,
}: InstanceFormProps) {
  const isMobile = useMediaQuery('(max-width: 48em)');
  const disableFocusTrap = import.meta.env.MODE === 'test';
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [db, setDb] = useState('');
  const [authType, setAuthType] = useState<AuthType>('userPass');
  const [apiKey, setApiKey] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [version, setVersion] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [disabledTools, setDisabledTools] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (instanceName && instanceData) {
      setName(instanceName);
      setUrl(instanceData.url);
      setDb(instanceData.db || '');
      setVersion(instanceData.version ? String(instanceData.version) : '');
      setTagsInput(getInstanceTags(instanceData).join(', '));
      setAuthType(instanceData.apiKey ? 'apiKey' : 'userPass');
      setApiKey(instanceData.apiKey || '');
      setUsername(instanceData.username || '');
      setPassword(instanceData.password || '');
      setDisabledTools(filterKnownDisabledTools(availableTools, instanceData.toolConfig?.disabledTools || []));
    } else {
      setName('');
      setUrl('');
      setDb('');
      setVersion('');
      setTagsInput('');
      setAuthType('userPass');
      setApiKey('');
      setUsername('');
      setPassword('');
      setDisabledTools([]);
    }
    setErrors({});
  }, [availableTools, instanceData, instanceName]);

  const initialFingerprint = useMemo(
    () =>
      JSON.stringify({
        name: instanceName ?? '',
        url: instanceData?.url ?? '',
        db: instanceData?.db ?? '',
        authType: instanceData?.apiKey ? 'apiKey' : 'userPass',
        apiKey: instanceData?.apiKey ?? '',
        username: instanceData?.username ?? '',
        password: instanceData?.password ?? '',
        version: instanceData?.version ? String(instanceData.version) : '',
        tagsInput: instanceData ? getInstanceTags(instanceData).join(', ') : '',
        disabledTools: filterKnownDisabledTools(availableTools, instanceData?.toolConfig?.disabledTools || []),
      }),
    [availableTools, instanceData, instanceName]
  );

  const currentFingerprint = JSON.stringify({
    name,
    url,
    db,
    authType,
    apiKey,
    username,
    password,
    version,
    tagsInput,
    disabledTools,
  });

  const dirty = currentFingerprint !== initialFingerprint;

  useRegisterDirtyState('instance-form', dirty, 'You have unsaved instance changes.');

  const availableToolMap = useMemo(
    () => new Map(availableTools.map((tool) => [tool.name, tool])),
    [availableTools]
  );

  const groupedSections = useMemo(
    () =>
      TOOL_GROUPS.map((group) => ({
        ...group,
        tools: group.tools
          .map((toolName) => availableToolMap.get(toolName))
          .filter((tool): tool is ToolConfig => Boolean(tool)),
      })),
    [availableToolMap]
  );

  const otherTools = useMemo(
    () => availableTools.filter((tool) => !ALL_GROUPED_TOOL_NAMES.has(tool.name)),
    [availableTools]
  );

  const disabledToolSet = useMemo(() => new Set(disabledTools), [disabledTools]);
  const enabledToolCount = countEnabledToolsForInstance(availableTools, disabledTools);

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (!name.trim()) {
      nextErrors.name = 'Instance name is required';
    } else if (!isEdited(instanceName, name.trim()) && existingNames.includes(name.trim())) {
      nextErrors.name = 'Instance name already exists';
    }

    if (!url.trim()) {
      nextErrors.url = 'URL is required';
    }

    if (authType === 'userPass' && !db.trim()) {
      nextErrors.db = 'Database is required for username/password auth';
    }

    if (authType === 'apiKey' && !apiKey.trim()) {
      nextErrors.apiKey = 'API key is required';
    }

    if (authType === 'userPass' && !username.trim()) {
      nextErrors.username = 'Username is required';
    }

    if (authType === 'userPass' && !password.trim()) {
      nextErrors.password = 'Password is required';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) {
      return;
    }

    const data: InstanceDetails = {
      ...(instanceData ?? {}),
      url: url.trim(),
    };

    if (db.trim()) {
      data.db = db.trim();
    } else {
      delete data.db;
    }

    if (authType === 'apiKey') {
      data.apiKey = apiKey.trim();
      delete data.username;
      delete data.password;
    } else {
      data.username = username.trim();
      data.password = password.trim();
      delete data.apiKey;
    }

    if (version.trim()) {
      data.version = version.trim();
    } else {
      delete data.version;
    }

    const normalizedTags = parseInstanceTagsInput(tagsInput);
    if (normalizedTags.length > 0) {
      data.tags = normalizedTags;
    } else {
      delete data.tags;
    }

    delete data.aliases;

    const sanitizedDisabledTools = filterKnownDisabledTools(availableTools, disabledTools);
    if (sanitizedDisabledTools.length > 0) {
      data.toolConfig = { disabledTools: sanitizedDisabledTools };
    } else {
      delete data.toolConfig;
    }

    onSave(name.trim(), data);
  };

  const handleClose = () => {
    if (!dirty) {
      onCancel();
      return;
    }

    modals.openConfirmModal({
      title: 'Discard instance changes?',
      children: (
        <Text size="sm" c="dimmed">
          Your unsaved edits will be lost.
        </Text>
      ),
      labels: { confirm: 'Discard changes', cancel: 'Keep editing' },
      confirmProps: { color: 'red' },
      onConfirm: onCancel,
    });
  };

  const content = (
    <Stack gap="lg">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={3}>{instanceName ? 'Edit instance connection' : 'Create a new instance connection'}</Title>
            <Text c="dimmed" size="sm" mt={4}>
              Set the connection identity, pick the correct auth flow, and trim the shared tool catalog for this instance.
            </Text>
          </div>
          <Badge color="blue" variant="light">
            {enabledToolCount}/{availableTools.length} tools enabled
          </Badge>
        </Group>

        <Grid>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <TextInput
              label="Instance name"
              placeholder="production, staging, local"
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
              error={errors.name}
              disabled={Boolean(instanceName)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <TextInput
              label="URL"
              placeholder="https://odoo.example.com"
              value={url}
              onChange={(event) => setUrl(event.currentTarget.value)}
              error={errors.url}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <TextInput
              label="Database"
              placeholder="Optional for single-tenant Odoo 19"
              value={db}
              onChange={(event) => setDb(event.currentTarget.value)}
              error={errors.db}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <TextInput
              label="Version"
              placeholder="16, 17, 18, 19"
              value={version}
              onChange={(event) => setVersion(event.currentTarget.value)}
            />
          </Grid.Col>
          <Grid.Col span={12}>
            <Textarea
              label="Tags"
              placeholder="prod, finance, kdkmp"
              minRows={3}
              value={tagsInput}
              onChange={(event) => setTagsInput(event.currentTarget.value)}
            />
          </Grid.Col>
        </Grid>

        <SectionTitle order={4} title="Authentication" subtitle="Choose the auth stack that matches the target Odoo instance." />

        <Radio.Group value={authType} onChange={(value) => setAuthType(value as AuthType)}>
          <Group grow align="stretch">
            <Radio.Card value="apiKey" radius="xl" p="md">
              <Text>API Key</Text>
              <Text size="sm" c="dimmed">
                Best for Odoo 19 and JSON-2.
              </Text>
            </Radio.Card>
            <Radio.Card value="userPass" radius="xl" p="md">
              <Text>Username / Password</Text>
              <Text size="sm" c="dimmed">
                Use for older JSON-RPC deployments.
              </Text>
            </Radio.Card>
          </Group>
        </Radio.Group>

        <Grid>
          {authType === 'apiKey' ? (
            <Grid.Col span={12}>
              <TextInput
                label="API key"
                placeholder="Paste API key"
                value={apiKey}
                onChange={(event) => setApiKey(event.currentTarget.value)}
                error={errors.apiKey}
              />
            </Grid.Col>
          ) : (
            <>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <TextInput
                  label="Username"
                  placeholder="admin@example.com"
                  value={username}
                  onChange={(event) => setUsername(event.currentTarget.value)}
                  error={errors.username}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <TextInput
                  label="Password"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(event) => setPassword(event.currentTarget.value)}
                  error={errors.password}
                />
              </Grid.Col>
            </>
          )}
        </Grid>

        <SectionTitle order={4} title="Per-instance tool access" subtitle="Trim the shared tool catalog without touching the global config." />

        <Accordion variant="separated" radius="xl" multiple defaultValue={TOOL_GROUPS.slice(0, 2).map((group) => group.id)}>
          {groupedSections.map((group) =>
            group.tools.length > 0 ? (
              <Accordion.Item key={group.id} value={group.id}>
                <Accordion.Control>
                  <Group justify="space-between">
                    <div>
                      <Text>{group.label}</Text>
                        <Text size="sm" c="dimmed">
                          {group.label} tools for this specific instance.
                        </Text>
                    </div>
                    <Badge variant="light">
                      {group.tools.filter((tool) => !disabledToolSet.has(tool.name)).length}/{group.tools.length} enabled
                    </Badge>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        Batch toggle this tool group.
                      </Text>
                      <Group gap="xs">
                        <Button
                          variant="light"
                          size="xs"
                          onClick={() =>
                            setDisabledTools((current) => current.filter((toolName) => !group.tools.some((tool) => tool.name === toolName)))
                          }
                        >
                          Enable all
                        </Button>
                        <Button
                          variant="light"
                          color="red"
                          size="xs"
                          onClick={() =>
                            setDisabledTools((current) =>
                              [...new Set([...current, ...group.tools.map((tool) => tool.name)])].sort()
                            )
                          }
                        >
                          Disable all
                        </Button>
                      </Group>
                    </Group>
                    {group.tools.map((tool) => (
                      <Group key={tool.name} justify="space-between" align="flex-start">
                        <div>
                          <NameChip>{tool.name}</NameChip>
                          <Text size="sm" c="dimmed" mt={4}>
                            {tool.description || 'No description'}
                          </Text>
                        </div>
                        <Switch
                          checked={!disabledToolSet.has(tool.name)}
                          onChange={(event) =>
                            setDisabledTools((current) => {
                              const next = new Set(current);
                              if (event.currentTarget.checked) {
                                next.delete(tool.name);
                              } else {
                                next.add(tool.name);
                              }
                              return [...next].sort();
                            })
                          }
                        />
                      </Group>
                    ))}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            ) : null
          )}

          {otherTools.length > 0 ? (
            <Accordion.Item value="other">
              <Accordion.Control>Other tools</Accordion.Control>
              <Accordion.Panel>
                <Stack gap="sm">
                  {otherTools.map((tool) => (
                    <Group key={tool.name} justify="space-between" align="flex-start">
                      <div>
                        <NameChip>{tool.name}</NameChip>
                        <Text size="sm" c="dimmed" mt={4}>
                          {tool.description || 'No description'}
                        </Text>
                      </div>
                      <Switch
                        checked={!disabledToolSet.has(tool.name)}
                        onChange={(event) =>
                          setDisabledTools((current) => {
                            const next = new Set(current);
                            if (event.currentTarget.checked) {
                              next.delete(tool.name);
                            } else {
                              next.add(tool.name);
                            }
                            return [...next].sort();
                          })
                        }
                      />
                    </Group>
                  ))}
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          ) : null}
        </Accordion>

        <Box
          style={{
            position: 'sticky',
            bottom: 0,
            background: 'var(--app-surface-panel)',
            backdropFilter: 'blur(8px)',
            paddingTop: 12,
            borderTop: '1px solid var(--app-border)',
          }}
        >
          <Group justify="flex-end">
            <Button variant="default" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>{instanceName ? 'Update instance' : 'Add instance'}</Button>
          </Group>
        </Box>
      </Stack>
  );

  if (disableFocusTrap) {
    return <Box>{content}</Box>;
  }

  return (
    <Drawer
      opened
      onClose={handleClose}
      title={instanceName ? 'Edit instance' : 'Add instance'}
      position="right"
      size={isMobile ? '100%' : 880}
      radius={0}
      trapFocus
      returnFocus
      transitionProps={{ duration: 0 }}
    >
      {content}
    </Drawer>
  );
}
