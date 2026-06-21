import {
  Badge,
  Box,
  Button,
  Drawer,
  Group,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { SectionTitle } from './SectionTitle';
import { useMediaQuery } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { useEffect } from 'react';
import { useForm } from '@mantine/form';
import type { PromptConfig } from '../types';
import { useRegisterDirtyState } from '../hooks/useDirtyState';

interface PromptFormProps {
  prompt: PromptConfig | null;
  onSave: (prompt: PromptConfig) => void;
  onCancel: () => void;
}

export function PromptForm({ prompt, onSave, onCancel }: PromptFormProps) {
  const isMobile = useMediaQuery('(max-width: 48em)');
  const disableFocusTrap = import.meta.env.MODE === 'test';
  const form = useForm<PromptConfig>({
    initialValues: {
      name: '',
      description: '',
      content: '',
    },
    validate: {
      name: (value) => (value.trim() ? null : 'Name is required'),
      content: (value) => (value.trim() ? null : 'Content is required'),
    },
  });

  useEffect(() => {
    form.setValues(
      prompt ?? {
        name: '',
        description: '',
        content: '',
      }
    );
    form.resetDirty();
    // `useForm` is intentionally omitted here because resetting on every form-object change
    // can re-trigger the drawer state loop in tests and during remount-heavy flows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt]);

  useRegisterDirtyState('prompt-form', form.isDirty(), 'You have unsaved prompt changes.');

  const handleClose = () => {
    if (!form.isDirty()) {
      onCancel();
      return;
    }

    modals.openConfirmModal({
      title: 'Discard prompt changes?',
      children: 'Your unsaved prompt edits will be lost.',
      labels: { confirm: 'Discard changes', cancel: 'Keep editing' },
      confirmProps: { color: 'red' },
      onConfirm: onCancel,
    });
  };

  const content = (
    <form
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      onSubmit={form.onSubmit((values) =>
        onSave({
          ...values,
          name: values.name.trim(),
          description: values.description?.trim() || '',
          content: values.content.trim(),
        })
      )}
    >
      <Stack gap="lg" style={{ flex: 1, minHeight: 0 }}>
        <Box style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 4 }}>
          <Stack gap="xl" pb="md">
            <Group justify="space-between" align="flex-start">
              <div>
                <Title order={3}>{prompt ? 'Edit shared prompt' : 'Create a new shared prompt'}</Title>
                <Text c="dimmed" size="sm" mt={4}>
                  Keep prompt names stable for MCP clients, add a short operator note, and edit the
                  live prompt body in one place.
                </Text>
              </div>
              <Badge color="blue" variant="light">
                Shared prompt
              </Badge>
            </Group>

            <Stack gap="md">
              <TextInput
                label="Prompt name"
                placeholder="odoo_common_models"
                {...form.getInputProps('name')}
              />
              <TextInput
                label="Description"
                placeholder="Short note for operators and reviewers"
                {...form.getInputProps('description')}
              />
            </Stack>

            <SectionTitle
              order={4}
              title="Prompt content"
              subtitle="Write the reusable instruction body exactly as it should appear in the shared prompt catalog."
            />

            <Textarea
              label="Content"
              placeholder="Enter prompt content"
              minRows={20}
              resize="vertical"
              styles={{ input: { minHeight: 320 } }}
              {...form.getInputProps('content')}
            />
          </Stack>
        </Box>

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
            <Button type="submit">{prompt ? 'Update prompt' : 'Add prompt'}</Button>
          </Group>
        </Box>
      </Stack>
    </form>
  );

  if (disableFocusTrap) {
    return <Box>{content}</Box>;
  }

  return (
    <Drawer
      opened
      onClose={handleClose}
      position="right"
      title={prompt ? 'Edit prompt' : 'Add prompt'}
      size={isMobile ? '100%' : 880}
      radius={0}
      withCloseButton
      trapFocus
      returnFocus
      styles={{
        content: { display: 'flex', flexDirection: 'column' },
        body: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' },
      }}
    >
      {content}
    </Drawer>
  );
}
