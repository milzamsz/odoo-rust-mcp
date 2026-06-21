import {
  ActionIcon,
  Button,
  Card,
  Group,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { ArrowClockwise, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PromptForm } from '../PromptForm';
import { NameChip } from '../NameChip';
import { useConfig } from '../../hooks/useConfig';
import type { PromptConfig } from '../../types';

export function PromptsTab() {
  const { load, save, loading } = useConfig('prompts');
  const [searchParams, setSearchParams] = useSearchParams();
  const [prompts, setPrompts] = useState<PromptConfig[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<PromptConfig | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const loadPrompts = useCallback(async () => {
    try {
      setPrompts((await load()) as PromptConfig[]);
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Load failed',
        message: error instanceof Error ? error.message : 'Failed to load prompts',
      });
    }
  }, [load]);

  useEffect(() => {
    void loadPrompts();
  }, [loadPrompts]);

  useEffect(() => {
    if (searchParams.get('action') !== 'new') {
      return;
    }

    setEditingPrompt(null);
    setEditingIndex(null);
    setShowForm(true);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('action');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleDelete = async (index: number) => {
    modals.openConfirmModal({
      title: 'Delete this prompt?',
      children: (
        <Text size="sm" c="dimmed">
          This removes the prompt from the live prompt catalog immediately after save.
        </Text>
      ),
      labels: { confirm: 'Delete prompt', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await save(prompts.filter((_, promptIndex) => promptIndex !== index));
          notifications.show({
            color: 'green',
            title: 'Prompt deleted',
            message: 'The prompt catalog was updated.',
          });
          await loadPrompts();
        } catch (error) {
          notifications.show({
            color: 'red',
            title: 'Delete failed',
            message: error instanceof Error ? error.message : 'Failed to delete prompt',
          });
        }
      },
    });
  };

  const handleSavePrompt = async (prompt: PromptConfig) => {
    const exists = prompts.some((entry, index) => entry.name === prompt.name && index !== editingIndex);
    if (exists) {
      notifications.show({
        color: 'yellow',
        title: 'Duplicate prompt name',
        message: 'Use a different prompt name before saving.',
      });
      return;
    }

    const nextPrompts =
      editingIndex !== null
        ? prompts.map((entry, index) => (index === editingIndex ? prompt : entry))
        : [...prompts, prompt];

    try {
      await save(nextPrompts);
      notifications.show({
        color: 'green',
        title: editingIndex !== null ? 'Prompt updated' : 'Prompt added',
        message: 'The live prompt catalog has been refreshed.',
      });
      await loadPrompts();
      setShowForm(false);
      setEditingPrompt(null);
      setEditingIndex(null);
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Save failed',
        message: error instanceof Error ? error.message : 'Failed to save prompt',
      });
    }
  };

  return (
    <Stack gap="xl">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={1}>System prompts</Title>
          <Text className="page-lead" mt={4}>
            Maintain the shared prompt catalog that ships to MCP clients without dropping into raw JSON files.
          </Text>
        </div>
        <Group>
          <Button variant="default" leftSection={<ArrowClockwise size={16} />} loading={loading} onClick={() => void loadPrompts()}>
            Refresh
          </Button>
          <Button
            leftSection={<Plus size={16} />}
            onClick={() => {
              setEditingPrompt(null);
              setEditingIndex(null);
              setShowForm(true);
            }}
          >
            Add prompt
          </Button>
        </Group>
      </Group>

      <Card p="lg" className="surface-panel">
        <Table.ScrollContainer minWidth={720}>
          <Table verticalSpacing="md" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Description</Table.Th>
                <Table.Th>Content preview</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {prompts.map((prompt, index) => (
                <Table.Tr key={`${prompt.name}-${index}`}>
                  <Table.Td>
                    <NameChip>{prompt.name}</NameChip>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {prompt.description || 'No description'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed" lineClamp={2}>
                      {prompt.content}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" justify="flex-end">
                      <ActionIcon
                        variant="light"
                        color="blue"
                        onClick={() => {
                          setEditingPrompt(prompt);
                          setEditingIndex(index);
                          setShowForm(true);
                        }}
                      >
                        <PencilSimple size={16} />
                      </ActionIcon>
                      <ActionIcon variant="light" color="red" onClick={() => void handleDelete(index)}>
                        <Trash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>

      {showForm ? (
        <PromptForm
          prompt={editingPrompt}
          onSave={(prompt) => void handleSavePrompt(prompt)}
          onCancel={() => {
            setShowForm(false);
            setEditingPrompt(null);
            setEditingIndex(null);
          }}
        />
      ) : null}
    </Stack>
  );
}
