import { Badge, Card, Group, Stack, Switch, Text } from '@mantine/core';
import type { ToolConfig } from '../types';
import { NameChip } from './NameChip';

interface AvailableGuard {
  key: string;
  value: string;
  label: string;
}

interface ToolDetailProps {
  tool: ToolConfig;
  enabled: boolean;
  onToggle: (enabled: boolean) => Promise<void>;
  onToggleGuard: (guardKey: string, enabled: boolean) => Promise<void>;
  availableGuards: AvailableGuard[];
}

export function ToolDetail({
  tool,
  enabled,
  onToggle,
  onToggleGuard,
  availableGuards,
}: ToolDetailProps) {
  return (
    <Card p="md" bg="var(--app-panel-muted)">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start">
          <div>
            <NameChip>{tool.name}</NameChip>
            <Text size="sm" c="dimmed" mt={4}>
              {tool.description || 'No description provided.'}
            </Text>
          </div>
          <Switch checked={enabled} onChange={(event) => void onToggle(event.currentTarget.checked)} />
        </Group>

        {(tool.pack || (tool.requiredModules?.length ?? 0) > 0) && (
          <Group gap="xs">
            {tool.pack && (
              <Badge variant="outline" color="grape" size="sm">
                pack: {tool.pack}
              </Badge>
            )}
            {tool.requiredModules?.map((mod) => (
              <Badge key={`${tool.name}-mod-${mod}`} variant="outline" color="teal" size="sm">
                needs: {mod}
              </Badge>
            ))}
          </Group>
        )}

        <Group gap="xs">
          {availableGuards.map((guard) => (
            <Badge
              key={`${tool.name}-${guard.value}`}
              variant={tool.guards?.[guard.key] === guard.value ? 'filled' : 'light'}
              color={tool.guards?.[guard.key] === guard.value ? 'blue' : 'gray'}
              style={{ cursor: 'pointer' }}
              onClick={() => void onToggleGuard(guard.key, tool.guards?.[guard.key] !== guard.value)}
            >
              {guard.label}
            </Badge>
          ))}
        </Group>
      </Stack>
    </Card>
  );
}
