import {
  Alert,
  Anchor,
  Badge,
  Card,
  Grid,
  Group,
  Loader,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  Database,
  ShieldCheck,
  SquaresFour,
  ChatCircleText,
  WarningCircle,
  CirclesThree,
} from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useConfig } from '../../hooks/useConfig';
import { fetchJson, getAuthHeaders } from '../../lib/api';
import type { InstanceConfig, InstancesSyncStatusResponse, PromptConfig, ToolConfig } from '../../types';

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
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Database;
}) {
  return (
    <Card p="lg" className="surface-panel">
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Text className="page-eyebrow">{label}</Text>
          <Title order={2}>{value}</Title>
          <Text size="sm" c="dimmed">
            {detail}
          </Text>
        </Stack>
        <ThemeIcon size={42} radius="md" variant="light" color="blue">
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
  const { authEnabled, username } = useAuth();
  const [state, setState] = useState<OverviewState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadAll = async () => {
      try {
        const [instances, tools, prompts, runtime] = await Promise.all([
          loadInstances() as Promise<InstanceConfig>,
          loadTools() as Promise<ToolConfig[]>,
          loadPrompts() as Promise<PromptConfig[]>,
          fetchJson<InstancesSyncStatusResponse>('/api/config/instances/sync-status', {
            headers: getAuthHeaders(),
          }).catch(() => null),
        ]);

        if (!active) {
          return;
        }

        setState({ instances, tools, prompts, runtime });
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
  }, [loadInstances, loadPrompts, loadTools]);

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

      <Grid>
        <Grid.Col span={{ base: 12, md: 6, xl: 3 }}>
          <OverviewMetric
            label="Instances"
            value={String(instanceEntries.length)}
            detail="Configured Odoo targets available to tools and prompts."
            icon={Database}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6, xl: 3 }}>
          <OverviewMetric
            label="Tool catalog"
            value={String(toolCount)}
            detail={`${guardedTools} tools are gated by runtime environment flags.`}
            icon={SquaresFour}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6, xl: 3 }}>
          <OverviewMetric
            label="Prompts"
            value={String(promptCount)}
            detail="Prompt definitions served directly from live config."
            icon={ChatCircleText}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6, xl: 3 }}>
          <OverviewMetric
            label="UI auth"
            value={authEnabled ? 'Enabled' : 'Disabled'}
            detail={authEnabled ? `Signed in as ${username ?? 'admin'}.` : 'Open access mode.'}
            icon={ShieldCheck}
          />
        </Grid.Col>
      </Grid>

      <Grid>
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Card p="lg" className="surface-panel">
            <Group justify="space-between" mb="md">
              <div>
                <Text className="page-eyebrow">Runtime posture</Text>
                <Title order={3} mt={6}>
                  Current config source
                </Title>
              </div>
              <ThemeIcon size={42} radius="md" variant="light" color="blue">
                <CirclesThree size={20} weight="duotone" />
              </ThemeIcon>
            </Group>

            {runtime ? (
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
                  Runtime source: <Anchor inherit>{runtime.instances_source_path ?? 'ODOO_INSTANCES or single-instance env'}</Anchor>
                </Text>
                <Text c="dimmed" size="sm">
                  Sync coverage: {runtime.synced_count} of {runtime.total_count} instance entries match the env snapshot.
                </Text>
                {runtime.alternate_sources.length > 0 ? (
                  <Alert color="yellow" radius="lg" title="Nearby alternate sources">
                    {runtime.alternate_sources.length} alternate `instances.json` source
                    {runtime.alternate_sources.length === 1 ? '' : 's'} detected. Review them from the
                    server page if operators may confuse repo fixtures with live runtime config.
                  </Alert>
                ) : null}
              </Stack>
            ) : (
              <Text c="dimmed" size="sm">
                Runtime sync metadata is unavailable right now, but the main configuration endpoints are reachable.
              </Text>
            )}
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 5 }}>
          <Card p="lg" className="surface-panel">
            <Text className="page-eyebrow">Workspace notes</Text>
            <Title order={3} mt={6}>
              Shell priorities
            </Title>
            <Stack gap="sm" mt="md">
              <Text size="sm" c="dimmed">
                Hash-route navigation keeps deep links stable behind the embedded Rust static server.
              </Text>
              <Text size="sm" c="dimmed">
                The sidebar can collapse into an icon rail without losing route access.
              </Text>
              <Text size="sm" c="dimmed">
                Long editing flows now stay closer to the list context through right-side drawers.
              </Text>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
