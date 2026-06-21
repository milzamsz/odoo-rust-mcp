import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Code,
  CopyButton,
  Group,
  Loader,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  Database,
  SquaresFour,
  ChatCircleText,
  WarningCircle,
  CirclesThree,
  Check,
  Copy,
  ArrowClockwise,
} from '@phosphor-icons/react';
import { notifications } from '@mantine/notifications';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSecurityActions } from '../../hooks/useAuth';
import { useConfig } from '../../hooks/useConfig';
import { fetchJson, getAuthHeaders } from '../../lib/api';
import type { InstanceConfig, InstancesSyncStatusResponse, PromptConfig, ToolConfig, McpAuthStatus, SyncInstancesEnvResponse } from '../../types';

interface OverviewState {
  instances: InstanceConfig;
  tools: ToolConfig[];
  prompts: PromptConfig[];
  runtime: InstancesSyncStatusResponse | null;
}

function OverviewMetric({
  label,
  value,
  detail,
  icon: Icon,
  onClick,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Database;
  onClick?: () => void;
}) {
  return (
    <Card
      p="lg"
      className="surface-panel"
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : undefined,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap" style={{ width: '100%', height: '100%' }}>
        <Stack gap={4} style={{ flex: 1 }}>
          <Text className="page-eyebrow">{label}</Text>
          <Title order={2}>{value}</Title>
          <Text size="sm" c="dimmed">
            {detail}
          </Text>
        </Stack>
        <ThemeIcon size={42} radius="md" variant="light" color="blue" style={{ flexShrink: 0 }}>
          <Icon size={20} weight="duotone" />
        </ThemeIcon>
      </Group>
    </Card>
  );
}

export function OverviewTab() {
  const { load: loadInstances } = useConfig('instances');
  const { load: loadTools } = useConfig('tools');
  const { load: loadPrompts } = useConfig('prompts');
  const { getMcpAuthStatus } = useSecurityActions();
  const navigate = useNavigate();
  const [state, setState] = useState<OverviewState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mcpAuthStatus, setMcpAuthStatus] = useState<McpAuthStatus | null>(null);
  const [connectionType, setConnectionType] = useState<'http' | 'stdio'>('http');
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await fetchJson<SyncInstancesEnvResponse>('/api/config/instances/sync-env', {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      setState((current) => {
        if (!current) return null;
        return {
          ...current,
          runtime: response,
        };
      });

      notifications.show({
        color: 'green',
        title: 'Sync successful',
        message: response.message || 'Synced instances to environment.',
      });
    } catch (err) {
      notifications.show({
        color: 'red',
        title: 'Sync failed',
        message: err instanceof Error ? err.message : 'Failed to sync instances to environment.',
      });
    } finally {
      setSyncing(false);
    }
  };

  const httpSnippet = JSON.stringify(
    {
      mcpServers: {
        'odoo-rust-mcp': {
          url: 'http://127.0.0.1:8787/mcp',
          ...(mcpAuthStatus?.enabled
            ? {
                headers: {
                  Authorization: 'Bearer <YOUR_MCP_AUTH_TOKEN>',
                },
              }
            : {}),
        },
      },
    },
    null,
    2
  );

  const exePath = mcpAuthStatus?.exe_path || 'C:\\path\\to\\rust-mcp.exe';
  const stdioSnippet = JSON.stringify(
    {
      mcpServers: {
        'odoo-rust-mcp': {
          command: exePath,
          args: ['--transport', 'stdio'],
        },
      },
    },
    null,
    2
  );

  useEffect(() => {
    let active = true;

    const loadAll = async () => {
      try {
        const [instances, tools, prompts, runtime, mcpStatus] = await Promise.all([
          loadInstances() as Promise<InstanceConfig>,
          loadTools() as Promise<ToolConfig[]>,
          loadPrompts() as Promise<PromptConfig[]>,
          fetchJson<InstancesSyncStatusResponse>('/api/config/instances/sync-status', {
            headers: getAuthHeaders(),
          }).catch(() => null),
          getMcpAuthStatus().catch(() => null),
        ]);

        if (!active) {
          return;
        }

        setState({ instances, tools, prompts, runtime });
        setMcpAuthStatus(mcpStatus);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : 'Failed to load overview');
      }
    };

    void loadAll();

    return () => {
      active = false;
    };
  }, [loadInstances, loadPrompts, loadTools, getMcpAuthStatus]);

  if (!state && !error) {
    return (
      <Group justify="center" py={80}>
        <Loader color="blue" />
      </Group>
    );
  }

  const instanceEntries = Object.entries(state?.instances ?? {});
  const toolCount = state?.tools.length ?? 0;
  const guardedTools = state?.tools.filter((tool) => tool.guards?.requiresEnvTrue).length ?? 0;
  const promptCount = state?.prompts.length ?? 0;
  const runtime = state?.runtime;
  const runtimeMode = runtime?.instances_source_path ? 'file-backed runtime' : 'env-backed runtime';

  return (
    <Stack gap="xl">
      <div>
        <Title order={1}>Configuration at a glance</Title>
        <Text className="page-lead" mt={4}>
          This workspace is tuned for day-to-day operational work: connection visibility, fast
          edits, and enough runtime context to catch drift early.
        </Text>
      </div>

      {error ? (
        <Alert color="red" icon={<WarningCircle size={16} />} radius="md" title="Overview failed to load">
          {error}
        </Alert>
      ) : null}

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
        <OverviewMetric
          label="Instances"
          value={String(instanceEntries.length)}
          detail="Configured Odoo targets available to tools and prompts."
          icon={Database}
          onClick={() => navigate('/instances')}
        />
        <OverviewMetric
          label="Tool catalog"
          value={String(toolCount)}
          detail={`${guardedTools} tools are gated by runtime environment flags.`}
          icon={SquaresFour}
          onClick={() => navigate('/tools')}
        />
        <OverviewMetric
          label="Prompts"
          value={String(promptCount)}
          detail="Prompt definitions served directly from live config."
          icon={ChatCircleText}
          onClick={() => navigate('/prompts')}
        />
      </SimpleGrid>

      <Card p="lg" className="surface-panel">
        <Group justify="space-between" mb="md" wrap="nowrap">
          <div>
            <Text className="page-eyebrow">Runtime posture</Text>
            <Title order={3} mt={6}>
              Current config source
            </Title>
          </div>
          <Group gap="sm" align="center" wrap="nowrap">
            {runtime && (
              <Button
                variant="light"
                color="blue"
                size="xs"
                loading={syncing}
                onClick={handleSync}
                leftSection={<ArrowClockwise size={16} />}
              >
                Sync to env
              </Button>
            )}
            <ThemeIcon size={42} radius="md" variant="light" color="blue">
              <CirclesThree size={20} weight="duotone" />
            </ThemeIcon>
          </Group>
        </Group>

        {runtime ? (
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
            <Stack gap="md">
              <Group gap="sm">
                <Badge color="blue" variant="light">
                  {runtimeMode}
                </Badge>
                <Badge color={runtime.configured ? 'green' : 'gray'} variant="light">
                  {runtime.configured ? 'env snapshot configured' : 'env snapshot missing'}
                </Badge>
              </Group>
              <Text c="dimmed" size="sm">
                Sync coverage: {runtime.synced_count} of {runtime.total_count} instance entries match the env snapshot.
              </Text>
            </Stack>
            <Stack gap="md">
              <Text c="dimmed" size="sm">
                Runtime source: <Anchor inherit>{runtime.instances_source_path ?? 'ODOO_INSTANCES or single-instance env'}</Anchor>
              </Text>
              {runtime.alternate_sources.length > 0 ? (
                <Alert color="yellow" radius="lg" title="Nearby alternate sources">
                  {runtime.alternate_sources.length} alternate `instances.json` source
                  {runtime.alternate_sources.length === 1 ? '' : 's'} detected. Review them from the
                  server page if operators may confuse repo fixtures with live runtime config.
                </Alert>
              ) : null}
            </Stack>
          </SimpleGrid>
        ) : (
          <Text c="dimmed" size="sm">
            Runtime sync metadata is unavailable right now, but the main configuration endpoints are reachable.
          </Text>
        )}
      </Card>

      <Card p="lg" className="surface-panel">
        <Group justify="space-between" mb="md">
          <div>
            <Text className="page-eyebrow">MCP Connection</Text>
            <Title order={3} mt={6}>
              Connect external AI tools
            </Title>
          </div>
        </Group>
        
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            You can connect your desktop AI agents (Cursor, Claude Desktop, Antigravity, etc.) directly to the Odoo MCP server.
          </Text>

          <SegmentedControl
            value={connectionType}
            onChange={(value) => setConnectionType(value as 'http' | 'stdio')}
            data={[
              { label: 'HTTP / SSE', value: 'http' },
              { label: 'Stdio', value: 'stdio' },
            ]}
            style={{ maxWidth: 350 }}
          />

          {connectionType === 'http' ? (
            <Stack gap="sm">
              <Text size="sm" c="dimmed">
                Use the following JSON configuration for HTTP-compatible clients (like VS Code, Codex, or Antigravity). Make sure the desktop app is running in the background.
              </Text>
              <Group justify="space-between" align="center" wrap="nowrap">
                <Code block style={{ flex: 1, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
                  {httpSnippet}
                </Code>
                <CopyButton value={httpSnippet}>
                  {({ copied, copy }) => (
                    <Button
                      variant="light"
                      color={copied ? 'green' : 'blue'}
                      leftSection={copied ? <Check size={16} /> : <Copy size={16} />}
                      onClick={copy}
                    >
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                  )}
                </CopyButton>
              </Group>
              {mcpAuthStatus?.enabled ? (
                <Alert color="yellow" radius="md">
                  HTTP auth is enabled. Replace <code>&lt;YOUR_MCP_AUTH_TOKEN&gt;</code> with your actual MCP token generated in the Security tab.
                </Alert>
              ) : null}
            </Stack>
          ) : (
            <Stack gap="sm">
              <Text size="sm" c="dimmed">
                For clients that run their own MCP subprocesses (like Cursor, Claude Desktop, or Claude Code), configure them to launch the standalone binary:
              </Text>
              <Group justify="space-between" align="center" wrap="nowrap">
                <Code block style={{ flex: 1, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
                  {stdioSnippet}
                </Code>
                <CopyButton value={stdioSnippet}>
                  {({ copied, copy }) => (
                    <Button
                      variant="light"
                      color={copied ? 'green' : 'blue'}
                      leftSection={copied ? <Check size={16} /> : <Copy size={16} />}
                      onClick={copy}
                    >
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                  )}
                </CopyButton>
              </Group>
              {mcpAuthStatus?.exe_path ? (
                <Alert color="green" radius="md">
                  Detected installed application path. The snippet above contains the actual absolute path to the binary.
                </Alert>
              ) : (
                <Alert color="blue" radius="md">
                  Make sure to replace <code>C:\\path\\to\\rust-mcp.exe</code> with the actual absolute path to your downloaded binary.
                </Alert>
              )}
            </Stack>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
