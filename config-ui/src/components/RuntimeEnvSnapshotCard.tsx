import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Progress,
  Stack,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ArrowClockwise, CirclesThree, WarningCircle } from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';
import { fetchJson, getAuthHeaders } from '../lib/api';
import { SectionTitle } from './SectionTitle';
import type { InstancesSyncStatusResponse, SyncInstancesEnvResponse } from '../types';

export function RuntimeEnvSnapshotCard() {
  const [syncStatus, setSyncStatus] = useState<InstancesSyncStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchJson<InstancesSyncStatusResponse>('/api/config/instances/sync-status', {
        headers: getAuthHeaders(),
      });
      setSyncStatus(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load runtime sync status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleSync = async () => {
    setSyncing(true);

    try {
      const response = await fetchJson<SyncInstancesEnvResponse>('/api/config/instances/sync-env', {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      setSyncStatus(response);
      notifications.show({
        color: response.restart_required ? 'yellow' : 'green',
        title: response.restart_required ? 'Synced with restart note' : 'Instances synced',
        message: response.message,
      });
    } catch (syncError) {
      notifications.show({
        color: 'red',
        title: 'Sync failed',
        message: syncError instanceof Error ? syncError.message : 'Failed to sync instances to env',
      });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <Card p="lg" className="surface-panel">
        <Group justify="center" py="lg">
          <Loader size="sm" />
        </Group>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert color="red" radius="md" icon={<WarningCircle size={16} />} title="Runtime sync status unavailable">
        {error}
      </Alert>
    );
  }

  if (!syncStatus) {
    return null;
  }

  const completion = syncStatus.total_count > 0
    ? Math.round((syncStatus.synced_count / syncStatus.total_count) * 100)
    : 0;

  return (
    <Card p="lg" className="surface-panel">
      <Group justify="space-between" align="flex-start" mb="md">
        <div>
          <Text className="page-eyebrow" mb={4}>
            Runtime sync
          </Text>
          <SectionTitle
            title="Env snapshot posture"
            subtitle="See how the live runtime source relates to the current Config UI instance list."
          />
        </div>

        <Button
          variant="default"
          leftSection={<ArrowClockwise size={16} />}
          onClick={() => void handleSync()}
          loading={syncing}
        >
          Sync to env
        </Button>
      </Group>

      <Stack gap="md">
        <Group gap="sm">
          <Badge color={syncStatus.instances_source_path ? 'blue' : 'gray'} variant="light">
            {syncStatus.instances_source_path ? 'file-backed runtime' : 'env-backed runtime'}
          </Badge>
          <Badge color={syncStatus.configured ? 'green' : 'yellow'} variant="light">
            {syncStatus.configured ? 'snapshot configured' : 'snapshot missing'}
          </Badge>
        </Group>

        <Card p="md" bg="var(--app-panel-muted)">
          <Group justify="space-between">
            <div>
              <Text>Current runtime source</Text>
              <Text size="sm" c="dimmed">
                {syncStatus.instances_source_path ?? 'ODOO_INSTANCES or single-instance env'}
              </Text>
            </div>
            <CirclesThree size={18} weight="duotone" />
          </Group>
        </Card>

        <div>
          <Group justify="space-between" mb={6}>
            <Text size="sm">Sync coverage</Text>
            <Text size="sm" c="dimmed">
              {syncStatus.synced_count}/{syncStatus.total_count}
            </Text>
          </Group>
          <Progress value={completion} radius="xl" size="lg" />
        </div>

        {syncStatus.extra_env_instances.length > 0 ? (
          <Alert color="yellow" radius="lg" title="Extra env entries">
            {syncStatus.extra_env_instances.join(', ')}
          </Alert>
        ) : null}

        {syncStatus.alternate_sources.length > 0 ? (
          <Alert color="blue" radius="lg" title="Alternate sources nearby">
            {syncStatus.alternate_sources.map((source) => source.path).join(' • ')}
          </Alert>
        ) : null}
      </Stack>
    </Card>
  );
}
