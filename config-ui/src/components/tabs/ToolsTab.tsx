import {
  Accordion,
  Badge,
  Button,
  Card,
  Group,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ArrowClockwise, MagnifyingGlass } from '@phosphor-icons/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ToolDetail } from '../ToolDetail';
import { useConfig } from '../../hooks/useConfig';
import type { ToolConfig } from '../../types';
import { ALL_GROUPED_TOOL_NAMES, OTHER_TOOL_GROUP, TOOL_GROUPS } from '../../toolGroups';

const AVAILABLE_GUARDS = [
  {
    key: 'requiresEnvTrue',
    value: 'ODOO_ENABLE_WRITE_TOOLS',
    label: 'Write gate',
  },
  {
    key: 'requiresEnvTrue',
    value: 'ODOO_ENABLE_CLEANUP_TOOLS',
    label: 'Cleanup gate',
  },
] as const;

export function ToolsTab() {
  const { load, save, loading } = useConfig('tools');
  const [editedTools, setEditedTools] = useState<ToolConfig[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'enabled' | 'disabled'>('all');

  const loadTools = useCallback(async () => {
    try {
      const data = (await load()) as ToolConfig[];
      setEditedTools(data);
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Load failed',
        message: error instanceof Error ? error.message : 'Failed to load tools',
      });
    }
  }, [load]);

  useEffect(() => {
    void loadTools();
  }, [loadTools]);

  const isToolEnabled = useCallback((tool: ToolConfig) => !tool.guards?.requiresEnvTrue, []);

  const autoSave = useCallback(
    async (updatedTools: ToolConfig[]) => {
      await save(updatedTools);
      setEditedTools(updatedTools);
    },
    [save]
  );

  const applyToggle = useCallback((tools: ToolConfig[], names: Set<string>, enabled: boolean): ToolConfig[] => {
    return tools.map((tool) => {
      if (!names.has(tool.name)) {
        return tool;
      }

      if (enabled) {
        if (!tool.guards?.requiresEnvTrue) {
          return tool;
        }
        const { requiresEnvTrue, ...rest } = tool.guards;
        void requiresEnvTrue;
        return { ...tool, guards: Object.keys(rest).length ? rest : undefined };
      }

      return {
        ...tool,
        guards: {
          ...tool.guards,
          requiresEnvTrue: `ENABLE_${tool.name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`,
        },
      };
    });
  }, []);

  const toggleTool = async (toolName: string, enabled: boolean) => {
    try {
      await autoSave(applyToggle(editedTools, new Set([toolName]), enabled));
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Save failed',
        message: error instanceof Error ? error.message : 'Failed to update tool state',
      });
    }
  };

  const toggleGuard = async (toolName: string, guardKey: string, enabled: boolean) => {
    const updatedTools = editedTools.map((tool) => {
      if (tool.name !== toolName) {
        return tool;
      }

      const guard = AVAILABLE_GUARDS.find((entry) => entry.key === guardKey);
      if (!guard) {
        return tool;
      }

      if (enabled) {
        return {
          ...tool,
          guards: {
            ...tool.guards,
            [guard.key]: guard.value,
          },
        };
      }

      if (!tool.guards) {
        return tool;
      }

      const nextGuards = { ...tool.guards };
      delete nextGuards[guardKey];

      return { ...tool, guards: Object.keys(nextGuards).length ? nextGuards : undefined };
    });

    try {
      await autoSave(updatedTools);
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Save failed',
        message: error instanceof Error ? error.message : 'Failed to update guard',
      });
    }
  };

  const filteredTools = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return editedTools.filter((tool) => {
      const matchesSearch =
        !normalizedQuery ||
        tool.name.toLowerCase().includes(normalizedQuery) ||
        (tool.description ?? '').toLowerCase().includes(normalizedQuery);
      const enabled = isToolEnabled(tool);
      const matchesFilter =
        filterType === 'all' ||
        (filterType === 'enabled' && enabled) ||
        (filterType === 'disabled' && !enabled);

      return matchesSearch && matchesFilter;
    });
  }, [editedTools, filterType, isToolEnabled, searchQuery]);

  const enabledCount = editedTools.filter((tool) => isToolEnabled(tool)).length;
  const groupSections = TOOL_GROUPS.map((group) => {
    const groupTools = filteredTools.filter((tool) => group.tools.includes(tool.name));
    const totalTools = editedTools.filter((tool) => group.tools.includes(tool.name));
    return { group, groupTools, totalTools };
  });

  const otherTools = filteredTools.filter((tool) => !ALL_GROUPED_TOOL_NAMES.has(tool.name));

  return (
    <Stack gap="xl">
      <div>
        <Title order={1}>Manage the live MCP catalog</Title>
        <Text className="page-lead" mt={4}>
          Keep the catalog light where possible, and reserve environment-guarded tools for the cases
          where write or cleanup power is truly needed.
        </Text>
      </div>

      <SimpleGrid cols={{ base: 1, md: 3 }}>
        <Card p="lg" className="surface-panel">
          <Text className="page-eyebrow">Total tools</Text>
          <Title order={2} mt={8}>
            {editedTools.length}
          </Title>
        </Card>
        <Card p="lg" className="surface-panel">
          <Text className="page-eyebrow">Enabled</Text>
          <Title order={2} mt={8}>
            {enabledCount}
          </Title>
        </Card>
        <Card p="lg" className="surface-panel">
          <Text className="page-eyebrow">Guarded</Text>
          <Title order={2} mt={8}>
            {editedTools.filter((tool) => tool.guards?.requiresEnvTrue).length}
          </Title>
        </Card>
      </SimpleGrid>

      <Card p="lg" className="surface-panel">
        <Group justify="space-between" align="flex-end" wrap="wrap">
          <TextInput
            leftSection={<MagnifyingGlass size={16} />}
            placeholder="Search by tool name or description"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.currentTarget.value)}
            data-global-search="true"
            style={{ flex: 1, minWidth: 260 }}
          />
          <Group>
            <SegmentedControl
              value={filterType}
              onChange={(value) => setFilterType(value as typeof filterType)}
              data={[
                { label: 'All', value: 'all' },
                { label: 'Enabled', value: 'enabled' },
                { label: 'Disabled', value: 'disabled' },
              ]}
            />
            <Button variant="default" leftSection={<ArrowClockwise size={16} />} loading={loading} onClick={() => void loadTools()}>
              Refresh
            </Button>
          </Group>
        </Group>
      </Card>

      <Accordion variant="separated" radius="lg" defaultValue={TOOL_GROUPS[0]?.id}>
        {groupSections.map(({ group, groupTools, totalTools }) => {
          if (groupTools.length === 0) {
            return null;
          }

          const enabledInGroup = totalTools.filter((tool) => isToolEnabled(tool)).length;

          return (
            <Accordion.Item key={group.id} value={group.id}>
              <Accordion.Control>
                <Group justify="space-between">
                    <div>
                      <Text>{group.label}</Text>
                      <Text size="sm" c="dimmed">
                        Curated tool family for this area of the MCP catalog.
                      </Text>
                    </div>
                  <Badge variant="light" color="blue">
                    {enabledInGroup}/{totalTools.length} enabled
                  </Badge>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="sm">
                  {groupTools.map((tool) => (
                    <ToolDetail
                      key={tool.name}
                      tool={tool}
                      enabled={isToolEnabled(tool)}
                      onToggle={(enabled) => toggleTool(tool.name, enabled)}
                      onToggleGuard={(guardKey, enabled) => toggleGuard(tool.name, guardKey, enabled)}
                      availableGuards={[...AVAILABLE_GUARDS]}
                    />
                  ))}
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          );
        })}

        {otherTools.length > 0 ? (
          <Accordion.Item value="other">
            <Accordion.Control>
              <Group justify="space-between">
                <div>
                  <Text>{OTHER_TOOL_GROUP.label}</Text>
                  <Text size="sm" c="dimmed">
                    Tools outside the curated group catalog.
                  </Text>
                </div>
                <Badge variant="light" color="gray">
                  {otherTools.length} visible
                </Badge>
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="sm">
                {otherTools.map((tool) => (
                  <ToolDetail
                    key={tool.name}
                    tool={tool}
                    enabled={isToolEnabled(tool)}
                    onToggle={(enabled) => toggleTool(tool.name, enabled)}
                    onToggleGuard={(guardKey, enabled) => toggleGuard(tool.name, guardKey, enabled)}
                    availableGuards={[...AVAILABLE_GUARDS]}
                  />
                ))}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        ) : null}
      </Accordion>
    </Stack>
  );
}
