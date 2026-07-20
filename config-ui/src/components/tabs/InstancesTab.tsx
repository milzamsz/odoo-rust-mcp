import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  Loader,
  Modal,
  Pill,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalStorage, useMediaQuery } from '@mantine/hooks';
import {
  ArrowClockwise,
  ArrowsDownUp,
  Database,
  DownloadSimple,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Tag,
  Trash,
  UploadSimple,
  WifiHigh,
} from '@phosphor-icons/react';
import {
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type FilterFn,
} from '@tanstack/react-table';
import { useConfig } from '../../hooks/useConfig';
import { fetchJson, getAuthHeaders } from '../../lib/api';
import { getInstanceTags } from '../../instanceTags';
import { countEnabledToolsForInstance } from '../../toolGroups';
import { InstanceForm } from '../InstanceForm';
import { SectionTitle } from '../SectionTitle';
import { NameChip } from '../NameChip';
import type { InstanceConfig, InstanceDetails, ToolConfig } from '../../types';
import { useSearchParams } from 'react-router-dom';

type ConnStatus =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'ok'; latency: number }
  | { status: 'error'; error: string };

interface ModuleSnapshot {
  edition: string;
  modules: string[];
  refreshedAt: string;
  stale: boolean;
  lastError?: string;
}

type CapStatus =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; snapshot: ModuleSnapshot }
  | { status: 'error'; error: string };

type ImportMode = 'merge' | 'replace';
type InstanceViewMode = 'card' | 'table';

interface ImportPreview {
  incoming: InstanceConfig;
  conflicts: string[];
  newNames: string[];
  mode: ImportMode;
}

interface InstanceRow {
  name: string;
  instance: InstanceDetails;
  tags: string[];
  searchableText: string;
  dbLabel: string;
  authLabel: string;
  authFilterValue: 'api-key' | 'username-password';
  versionLabel: string;
  versionFilterValue: string;
  toolsLabel: string;
  toolsFilterValue: 'full' | 'limited' | 'none' | 'unknown';
  toolsEnabledCount: number;
  toolsTotalCount: number;
  connectionStatus: ConnStatus;
  statusFilterValue: 'idle' | 'checking' | 'healthy' | 'error';
}

const INSTANCE_VIEW_STORAGE_KEY = 'mcp_instances_view';

const textIncludesFilter: FilterFn<InstanceRow> = (row, columnId, filterValue) => {
  const value = String(row.getValue(columnId) ?? '').toLowerCase();
  const needle = String(filterValue ?? '').trim().toLowerCase();
  return needle.length === 0 || value.includes(needle);
};

const exactFilter: FilterFn<InstanceRow> = (row, columnId, filterValue) => {
  const needle = String(filterValue ?? '');
  return !needle || String(row.getValue(columnId) ?? '') === needle;
};

function buildInstanceRow(
  name: string,
  instance: InstanceDetails,
  availableTools: ToolConfig[],
  connStatuses: Record<string, ConnStatus>
): InstanceRow {
  const tags = getInstanceTags(instance);
  const authLabel = instance.apiKey ? 'API Key' : 'Username/Password';
  const toolsTotalCount = availableTools.length;
  const toolsEnabledCount = countEnabledToolsForInstance(
    availableTools,
    instance.toolConfig?.disabledTools ?? []
  );
  const toolsFilterValue =
    toolsTotalCount === 0
      ? 'unknown'
      : toolsEnabledCount === 0
        ? 'none'
        : toolsEnabledCount === toolsTotalCount
          ? 'full'
          : 'limited';
  const status = connStatuses[name] ?? { status: 'idle' };

  return {
    name,
    instance,
    tags,
    searchableText: [name, instance.url, instance.db ?? '', authLabel, instance.version ?? '', ...tags]
      .join(' ')
      .toLowerCase(),
    dbLabel: instance.db || 'Optional / unset',
    authLabel,
    authFilterValue: instance.apiKey ? 'api-key' : 'username-password',
    versionLabel: instance.version ? `v${instance.version}` : 'Auto',
    versionFilterValue: instance.version ? String(instance.version) : 'auto',
    toolsLabel: toolsTotalCount > 0 ? `${toolsEnabledCount}/${toolsTotalCount} enabled` : 'Catalog unavailable',
    toolsFilterValue,
    toolsEnabledCount,
    toolsTotalCount,
    connectionStatus: status,
    statusFilterValue:
      status.status === 'ok' ? 'healthy' : status.status === 'error' ? 'error' : status.status,
  };
}

function getStatusLabel(status: ConnStatus) {
  if (status.status === 'idle') return 'Not checked';
  if (status.status === 'checking') return 'Checking';
  if (status.status === 'ok') return `Healthy ${status.latency}ms`;
  return 'Error';
}

export function InstancesTab() {
  const { load, save, loading } = useConfig('instances');
  const { load: loadTools, loading: toolsLoading } = useConfig('tools');
  const [searchParams, setSearchParams] = useSearchParams();
  const [config, setConfig] = useState<InstanceConfig>({});
  const [availableTools, setAvailableTools] = useState<ToolConfig[]>([]);
  const [connStatuses, setConnStatuses] = useState<Record<string, ConnStatus>>({});
  const [capStatuses, setCapStatuses] = useState<Record<string, CapStatus>>({});
  const [showForm, setShowForm] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [preferredView, setPreferredView] = useLocalStorage<InstanceViewMode>({
    key: INSTANCE_VIEW_STORAGE_KEY,
    defaultValue: 'table',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isCompact = useMediaQuery('(max-width: 64em)');
  const deferredSearch = useDeferredValue(searchQuery);
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<Set<string>>(new Set());

  const loadInstances = useCallback(async () => {
    try {
      setConfig((await load()) as InstanceConfig);
      setConnStatuses({});
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Load failed',
        message: error instanceof Error ? error.message : 'Failed to load instances',
      });
    }
  }, [load]);

  const loadAvailableTools = useCallback(async () => {
    try {
      setAvailableTools((await loadTools()) as ToolConfig[]);
    } catch {
      setAvailableTools([]);
    }
  }, [loadTools]);

  useEffect(() => {
    void Promise.all([loadInstances(), loadAvailableTools()]);
  }, [loadAvailableTools, loadInstances]);

  useEffect(() => {
    if (searchParams.get('action') !== 'new') {
      return;
    }

    setEditingName(null);
    setShowForm(true);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('action');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const effectiveView = isCompact ? 'card' : preferredView;
  const instanceRows = useMemo(
    () => Object.entries(config).map(([name, instance]) => buildInstanceRow(name, instance, availableTools, connStatuses)),
    [availableTools, config, connStatuses]
  );

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const row of instanceRows) {
      row.tags.forEach((tag) => tags.add(tag));
    }
    return [...tags].sort((left, right) => left.localeCompare(right));
  }, [instanceRows]);

  const externallyFilteredRows = useMemo(() => {
    const needle = deferredSearch.trim().toLowerCase();
    return instanceRows.filter((row) => {
      if (selectedTag && !row.tags.some((tag) => tag.toLowerCase() === selectedTag.toLowerCase())) {
        return false;
      }
      if (needle && !row.searchableText.includes(needle)) {
        return false;
      }
      return true;
    });
  }, [deferredSearch, instanceRows, selectedTag]);

  const handleExport = () => {
    const json = JSON.stringify(config, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `odoo-instances-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    setImportError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    event.target.value = '';
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const parsed = JSON.parse(loadEvent.target?.result as string);
        if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
          setImportError('Expected a JSON object that maps instance names to configs.');
          return;
        }

        const incoming = parsed as InstanceConfig;
        const existingNames = new Set(Object.keys(config));
        const conflicts = Object.keys(incoming).filter((name) => existingNames.has(name));
        const newNames = Object.keys(incoming).filter((name) => !existingNames.has(name));
        setImportPreview({ incoming, conflicts, newNames, mode: 'merge' });
      } catch {
        setImportError('Invalid JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const handleImportConfirm = async () => {
    if (!importPreview) {
      return;
    }

    const merged = importPreview.mode === 'replace' ? importPreview.incoming : { ...config, ...importPreview.incoming };
    try {
      await save(merged);
      notifications.show({ color: 'green', title: 'Instances imported', message: 'The instance catalog has been updated.' });
      setImportPreview(null);
      await loadInstances();
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Import failed',
        message: error instanceof Error ? error.message : 'Failed to import instances',
      });
    }
  };

  const testConnection = useCallback(async (name: string) => {
    setConnStatuses((current) => ({ ...current, [name]: { status: 'checking' } }));

    try {
      const response = await fetchJson<{ ok: boolean; latency_ms?: number; error?: string }>(
        `/api/config/instances/${encodeURIComponent(name)}/test`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
        }
      );

      setConnStatuses((current) => ({
        ...current,
        [name]: response.ok
          ? { status: 'ok', latency: response.latency_ms ?? 0 }
          : { status: 'error', error: response.error ?? 'Connection failed' },
      }));
    } catch (error) {
      setConnStatuses((current) => ({
        ...current,
        [name]: { status: 'error', error: error instanceof Error ? error.message : 'Network error' },
      }));
    }
  }, []);

  const testAll = useCallback(async () => {
    await Promise.all(Object.keys(config).map((name) => testConnection(name)));
  }, [config, testConnection]);

  const refreshCapabilities = useCallback(async (name: string) => {
    setCapStatuses((current) => ({ ...current, [name]: { status: 'loading' } }));
    try {
      const snapshot = await fetchJson<ModuleSnapshot>(
        `/api/config/instances/${encodeURIComponent(name)}/capabilities?refresh=true`,
        { headers: getAuthHeaders() }
      );
      setCapStatuses((current) => ({ ...current, [name]: { status: 'ready', snapshot } }));
    } catch (error) {
      setCapStatuses((current) => ({
        ...current,
        [name]: { status: 'error', error: error instanceof Error ? error.message : 'Network error' },
      }));
    }
  }, []);

  const handleEdit = useCallback((name: string) => {
    setEditingName(name);
    setShowForm(true);
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedInstanceIds.size === externallyFilteredRows.length) {
      setSelectedInstanceIds(new Set());
    } else {
      setSelectedInstanceIds(new Set(externallyFilteredRows.map((row) => row.name)));
    }
  }, [selectedInstanceIds.size, externallyFilteredRows]);

  const handleSelectRow = useCallback((instanceId: string, checked: boolean) => {
    setSelectedInstanceIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(instanceId);
      } else {
        next.delete(instanceId);
      }
      return next;
    });
  }, []);

  const handleBulkDelete = useCallback(async () => {
    if (selectedInstanceIds.size === 0) return;
    const candidates = Array.from(selectedInstanceIds);
    modals.open({
      title: `Delete ${candidates.length} instance(s)?`,
      children: <DismissibleDeleteModal
        candidates={candidates}
        confirmLabel="Delete instances"
        confirmColor="red"
        onCancel={() => modals.closeAll()}
        onConfirm={async (toDelete) => {
          const updated = { ...config };
          toDelete.forEach((name) => delete updated[name]);
          try {
            await save(updated);
            notifications.show({
              color: 'green',
              title: 'Instances deleted',
              message: `${toDelete.length} instance(s) were removed.`,
            });
            setSelectedInstanceIds(new Set());
            await Promise.all([loadInstances(), testAll()]);
          } catch (error) {
            notifications.show({
              color: 'red',
              title: 'Delete failed',
              message: error instanceof Error ? error.message : 'Failed to delete instances',
            });
          }
          modals.closeAll();
        }}
      />,
    });
  }, [selectedInstanceIds, config, save, loadInstances, testAll]);

  const getErrorInstanceIds = useCallback(() => {
    return externallyFilteredRows.filter((row) => row.connectionStatus.status === 'error').map((row) => row.name);
  }, [externallyFilteredRows]);

  const handleRemoveErrorInstances = useCallback(async () => {
    const errorIds = getErrorInstanceIds();
    if (errorIds.length === 0) return;
    modals.open({
      title: `Remove ${errorIds.length} error instance(s)?`,
      children: <DismissibleDeleteModal
        candidates={errorIds}
        confirmLabel="Remove error instances"
        confirmColor="red"
        onCancel={() => modals.closeAll()}
        onConfirm={async (toDelete) => {
          const updated = { ...config };
          toDelete.forEach((name) => delete updated[name]);
          try {
            await save(updated);
            notifications.show({
              color: 'green',
              title: 'Error instances removed',
              message: `${toDelete.length} error instance(s) were removed.`,
            });
            await Promise.all([loadInstances(), testAll()]);
          } catch (error) {
            notifications.show({
              color: 'red',
              title: 'Remove failed',
              message: error instanceof Error ? error.message : 'Failed to remove error instances',
            });
          }
          modals.closeAll();
        }}
      />,
    });
  }, [config, save, loadInstances, testAll, getErrorInstanceIds]);

  const handleDelete = useCallback(async (name: string) => {
    modals.openConfirmModal({
      title: `Delete ${name}?`,
      children: (
        <Text size="sm" c="dimmed">
          This removes the instance from the live runtime config after save.
        </Text>
      ),
      labels: { confirm: 'Delete instance', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        const updated = { ...config };
        delete updated[name];
        try {
          await save(updated);
          notifications.show({ color: 'green', title: 'Instance deleted', message: `${name} was removed.` });
          await loadInstances();
        } catch (error) {
          notifications.show({
            color: 'red',
            title: 'Delete failed',
            message: error instanceof Error ? error.message : 'Failed to delete instance',
          });
        }
      },
    });
  }, [config, loadInstances, save]);

  const handleSaveInstance = async (name: string, data: InstanceDetails) => {
    const updated = { ...config };
    if (editingName && editingName !== name) {
      delete updated[editingName];
    }
    updated[name] = data;

    try {
      await save(updated);
      notifications.show({
        color: 'green',
        title: editingName ? 'Instance updated' : 'Instance added',
        message: `${name} is now available to the runtime config.`,
      });
      setShowForm(false);
      setEditingName(null);
      await loadInstances();
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Save failed',
        message: error instanceof Error ? error.message : 'Failed to save instance',
      });
    }
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedTag(null);
    setColumnFilters([]);
  };

  const columns = useMemo<ColumnDef<InstanceRow>[]>(
    () => [
      {
        id: 'select',
        header: () => (
          <Checkbox
            aria-label="Select all rows"
            checked={selectedInstanceIds.size > 0 && selectedInstanceIds.size === rows.length}
            indeterminate={selectedInstanceIds.size > 0 && selectedInstanceIds.size < rows.length}
            onChange={handleSelectAll}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={`Select ${row.original.name}`}
            checked={selectedInstanceIds.has(row.original.name)}
            onChange={(event) => handleSelectRow(row.original.name, event.currentTarget.checked)}
          />
        ),
        enableSorting: false,
        enableColumnFilter: false,
        size: 50,
      },
      {
        accessorKey: 'name',
        header: 'Name',
        filterFn: textIncludesFilter,
        sortingFn: 'alphanumeric',
        size: 280,
        cell: ({ row }) => (
          <Group gap="sm" wrap="nowrap">
            <ActionIcon variant="light" color="blue" radius="xl" style={{ flexShrink: 0 }}>
              <Database size={16} weight="duotone" />
            </ActionIcon>
            <div style={{ minWidth: 0 }}>
              <NameChip>{row.original.name}</NameChip>
              <Text size="sm" c="dimmed" mt={4} style={{ wordBreak: 'break-all' }}>
                {row.original.instance.url}
              </Text>
            </div>
          </Group>
        ),
      },
      {
        accessorKey: 'dbLabel',
        header: 'Database',
        filterFn: textIncludesFilter,
      },
      {
        accessorKey: 'authFilterValue',
        header: 'Authentication',
        filterFn: exactFilter,
        cell: ({ row }) => row.original.authLabel,
      },
      {
        accessorKey: 'versionFilterValue',
        header: 'Version',
        filterFn: exactFilter,
        cell: ({ row }) => row.original.versionLabel,
      },
      {
        accessorKey: 'tags',
        header: 'Tags',
        filterFn: (row, columnId, filterValue) => {
          const tags = (row.getValue(columnId) as string[]).join(' ').toLowerCase();
          const needle = String(filterValue ?? '').trim().toLowerCase();
          return !needle || tags.includes(needle);
        },
        cell: ({ row }) => (
          <Group gap={6}>
            {row.original.tags.length > 0 ? row.original.tags.map((tag) => <Badge key={tag} variant="light">{tag}</Badge>) : <Text size="sm" c="dimmed">No tags</Text>}
          </Group>
        ),
      },
      {
        accessorKey: 'toolsFilterValue',
        header: 'Tools',
        filterFn: exactFilter,
        cell: ({ row }) => row.original.toolsLabel,
      },
      {
        accessorKey: 'statusFilterValue',
        header: 'Status',
        filterFn: exactFilter,
        cell: ({ row }) => <StatusBadge status={row.original.connectionStatus} />,
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <Group gap="xs" justify="flex-end" wrap="nowrap">
            <Button
              variant="light"
              size="compact-sm"
              leftSection={row.original.connectionStatus.status === 'checking' ? <Loader size={12} /> : <WifiHigh size={12} />}
              onClick={() => void testConnection(row.original.name)}
            >
              Test
            </Button>
            <ActionIcon variant="light" color="blue" onClick={() => handleEdit(row.original.name)}>
              <PencilSimple size={16} />
            </ActionIcon>
            <ActionIcon variant="light" color="red" onClick={() => void handleDelete(row.original.name)}>
              <Trash size={16} />
            </ActionIcon>
          </Group>
        ),
      },
    ],
    [handleDelete, handleEdit, testConnection, selectedInstanceIds, externallyFilteredRows.length, handleSelectAll, handleSelectRow]
  );

  const table = useReactTable({
    data: externallyFilteredRows,
    columns,
    state: {
      columnFilters,
      sorting,
    },
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const currentInstance = editingName ? config[editingName] : null;

  const activeFilterCount = columnFilters.length + (selectedTag ? 1 : 0) + (searchQuery.trim() ? 1 : 0);

  return (
    <Stack gap="xl">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <div>
          <Title order={1} fw={500}>
            Odoo instances
          </Title>
          <Text className="page-lead" mt={4}>
            Search, test, filter, and edit connection records from one quiet workspace. Desktop can
            switch between cards and a denser table, while smaller screens stay readable.
          </Text>
        </div>
        <Group>
          <Button variant="default" leftSection={<UploadSimple size={16} />} onClick={handleImportClick}>
            Import
          </Button>
          <Button variant="default" leftSection={<DownloadSimple size={16} />} onClick={handleExport}>
            Export
          </Button>
          <Button leftSection={<Plus size={16} />} onClick={() => { setEditingName(null); setShowForm(true); }}>
            Add instance
          </Button>
        </Group>
      </Group>

      <input ref={fileInputRef} type="file" accept=".json,application/json" hidden onChange={handleFileChange} />

      {importError ? (
        <Alert color="red" radius="xl">
          {importError}
        </Alert>
      ) : null}

      <Card p="lg" className="surface-panel">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start" wrap="wrap">
            <SectionTitle
              title={`Configured instances (${Object.keys(config).length})`}
              subtitle={`Showing ${rows.length} of ${instanceRows.length}. Filters stack across search, tag chips, and column filters.`}
            />
            <Group>
              {selectedInstanceIds.size > 0 ? (
                <>
                  <Badge variant="light" color="blue">
                    {selectedInstanceIds.size} selected
                  </Badge>
                  <Button
                    variant="default"
                    color="red"
                    leftSection={<Trash size={16} />}
                    onClick={() => void handleBulkDelete()}
                  >
                    Delete selected
                  </Button>
                </>
              ) : null}
              {effectiveView === 'table' && getErrorInstanceIds().length > 0 ? (
                <Button
                  variant="default"
                  color="red"
                  leftSection={<Trash size={16} />}
                  onClick={() => void handleRemoveErrorInstances()}
                >
                  Remove error instances
                </Button>
              ) : null}
              <Button variant="default" leftSection={<WifiHigh size={16} />} onClick={() => void testAll()}>
                Test all
              </Button>
              <Button variant="default" leftSection={<ArrowClockwise size={16} />} loading={loading || toolsLoading} onClick={() => void Promise.all([loadInstances(), loadAvailableTools()])}>
                Refresh
              </Button>
            </Group>
          </Group>

          <Group wrap="wrap" align="flex-end">
            <TextInput
              leftSection={<MagnifyingGlass size={16} />}
              placeholder="Search name, URL, database, auth, version, or tags"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.currentTarget.value)}
              data-global-search="true"
              style={{ flex: 1, minWidth: 260 }}
            />
            {!isCompact ? (
              <SegmentedControl
                value={preferredView}
                onChange={(value) => setPreferredView(value as InstanceViewMode)}
                data={[
                  { label: 'Cards', value: 'card' },
                  { label: 'Table', value: 'table' },
                ]}
              />
            ) : null}
          </Group>

          {allTags.length > 0 ? (
            <Group gap="xs">
              {allTags.map((tag) => (
                <Pill
                  key={tag}
                  withRemoveButton={selectedTag === tag}
                  onRemove={() => setSelectedTag(null)}
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                >
                  {tag}
                </Pill>
              ))}
            </Group>
          ) : null}

          <Group gap="xs">
            {searchQuery.trim() ? <Badge variant="light">Search: {searchQuery.trim()}</Badge> : null}
            {selectedTag ? <Badge variant="light">Tag: {selectedTag}</Badge> : null}
            {columnFilters.map((filter) => (
              <Badge key={filter.id} variant="light">
                {filter.id}: {String(filter.value)}
              </Badge>
            ))}
            {activeFilterCount > 0 ? (
              <Button variant="subtle" size="compact-sm" onClick={clearAllFilters}>
                Clear all
              </Button>
            ) : null}
          </Group>

          {effectiveView === 'table' ? (
            <Card p={0} className="surface-panel">
              <ScrollArea>
                <Table miw={1120} verticalSpacing="md" striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      {table.getHeaderGroups()[0].headers.map((header) => (
                        <Table.Th key={header.id} w={header.column.columnDef.size}>
                          {header.isPlaceholder ? null : header.column.getCanSort() ? (
                            <Group gap={6} wrap="nowrap" style={{ cursor: 'pointer' }} onClick={header.column.getToggleSortingHandler()}>
                              <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                              <ArrowsDownUp size={14} />
                            </Group>
                          ) : (
                            flexRender(header.column.columnDef.header, header.getContext())
                          )}
                        </Table.Th>
                      ))}
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Th w={50} />
                      <Table.Th>
                        <TextInput
                          className="table-filter-input"
                          placeholder="Search name"
                          value={String(table.getColumn('name')?.getFilterValue() ?? '')}
                          onChange={(event) => table.getColumn('name')?.setFilterValue(event.currentTarget.value)}
                        />
                      </Table.Th>
                      <Table.Th>
                        <TextInput
                          className="table-filter-input"
                          placeholder="Search DB"
                          value={String(table.getColumn('dbLabel')?.getFilterValue() ?? '')}
                          onChange={(event) => table.getColumn('dbLabel')?.setFilterValue(event.currentTarget.value)}
                        />
                      </Table.Th>
                      <Table.Th>
                        <Select
                          className="table-filter-input"
                          placeholder="All auth"
                          clearable
                          data={[
                            { label: 'API Key', value: 'api-key' },
                            { label: 'Username/Password', value: 'username-password' },
                          ]}
                          value={(table.getColumn('authFilterValue')?.getFilterValue() as string | null) ?? null}
                          onChange={(value) => table.getColumn('authFilterValue')?.setFilterValue(value ?? undefined)}
                        />
                      </Table.Th>
                      <Table.Th>
                        <Select
                          className="table-filter-input"
                          placeholder="All versions"
                          clearable
                          data={[...new Set(instanceRows.map((row) => row.versionFilterValue))].map((value) => ({
                            value,
                            label: value === 'auto' ? 'Auto' : `v${value}`,
                          }))}
                          value={(table.getColumn('versionFilterValue')?.getFilterValue() as string | null) ?? null}
                          onChange={(value) => table.getColumn('versionFilterValue')?.setFilterValue(value ?? undefined)}
                        />
                      </Table.Th>
                      <Table.Th>
                        <TextInput
                          className="table-filter-input"
                          placeholder="Search tags"
                          value={String(table.getColumn('tags')?.getFilterValue() ?? '')}
                          onChange={(event) => table.getColumn('tags')?.setFilterValue(event.currentTarget.value)}
                        />
                      </Table.Th>
                      <Table.Th>
                        <Select
                          className="table-filter-input"
                          placeholder="All tools"
                          clearable
                          data={[
                            { value: 'full', label: 'All enabled' },
                            { value: 'limited', label: 'Partially enabled' },
                            { value: 'none', label: 'No tools enabled' },
                            { value: 'unknown', label: 'Catalog unavailable' },
                          ]}
                          value={(table.getColumn('toolsFilterValue')?.getFilterValue() as string | null) ?? null}
                          onChange={(value) => table.getColumn('toolsFilterValue')?.setFilterValue(value ?? undefined)}
                        />
                      </Table.Th>
                      <Table.Th>
                        <Select
                          className="table-filter-input"
                          placeholder="All status"
                          clearable
                          data={[
                            { value: 'idle', label: 'Not checked' },
                            { value: 'checking', label: 'Checking' },
                            { value: 'healthy', label: 'Healthy' },
                            { value: 'error', label: 'Error' },
                          ]}
                          value={(table.getColumn('statusFilterValue')?.getFilterValue() as string | null) ?? null}
                          onChange={(value) => table.getColumn('statusFilterValue')?.setFilterValue(value ?? undefined)}
                        />
                      </Table.Th>
                      <Table.Th />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {rows.map((row) => (
                      <Table.Tr key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <Table.Td key={cell.id}>
                            {cell.column.columnDef.cell
                              ? flexRender(cell.column.columnDef.cell, cell.getContext())
                              : String(cell.getValue() ?? '')}
                          </Table.Td>
                        ))}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Card>
          ) : (
            <SimpleGrid cols={{ base: 1, xl: 2 }}>
              {rows.map((row) => (
                <Card key={row.original.name} p="lg" className="surface-panel">
                  <Stack gap="md">
                    <Group justify="space-between" align="flex-start">
                      <Group align="flex-start">
                        <ActionIcon variant="light" color="blue" radius="xl" size="lg">
                          <Database size={18} weight="duotone" />
                        </ActionIcon>
                        <div>
                          <Group gap="xs">
                            <NameChip>{row.original.name}</NameChip>
                            <StatusBadge status={row.original.connectionStatus} />
                          </Group>
                          <Text c="blue.4" size="sm" mt={6}>
                            {row.original.instance.url}
                          </Text>
                        </div>
                      </Group>
                      <Group gap="xs">
                        <Button variant="default" size="compact-sm" leftSection={<WifiHigh size={12} />} onClick={() => void testConnection(row.original.name)}>
                          Test
                        </Button>
                        <ActionIcon variant="light" color="blue" onClick={() => handleEdit(row.original.name)}>
                          <PencilSimple size={16} />
                        </ActionIcon>
                        <ActionIcon variant="light" color="red" onClick={() => void handleDelete(row.original.name)}>
                          <Trash size={16} />
                        </ActionIcon>
                      </Group>
                    </Group>

                    <SimpleGrid cols={{ base: 1, sm: 2 }}>
                      <MetaBlock label="Database" value={row.original.dbLabel} />
                      <MetaBlock label="Authentication" value={row.original.authLabel} />
                      <MetaBlock label="Version" value={row.original.versionLabel} />
                      <MetaBlock label="Tools" value={row.original.toolsLabel} />
                    </SimpleGrid>

                    {row.original.tags.length > 0 ? (
                      <>
                        <Divider />
                        <Group gap="xs">
                          {row.original.tags.map((tag) => (
                            <Badge key={tag} variant="light" leftSection={<Tag size={10} />}>
                              {tag}
                            </Badge>
                          ))}
                        </Group>
                      </>
                    ) : null}

                    <Divider />
                    <Group justify="space-between" align="center">
                      <CapabilitySummary status={capStatuses[row.original.name] ?? { status: 'idle' }} />
                      <Button
                        variant="subtle"
                        size="compact-xs"
                        leftSection={<ArrowClockwise size={12} />}
                        loading={capStatuses[row.original.name]?.status === 'loading'}
                        onClick={() => void refreshCapabilities(row.original.name)}
                      >
                        Capabilities
                      </Button>
                    </Group>
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>
          )}
        </Stack>
      </Card>

      {showForm ? (
        <InstanceForm
          instanceName={editingName}
          instanceData={currentInstance}
          existingNames={Object.keys(config)}
          availableTools={availableTools}
          onSave={(name, data) => void handleSaveInstance(name, data)}
          onCancel={() => {
            setShowForm(false);
            setEditingName(null);
          }}
        />
      ) : null}

      {importPreview ? (
        <ImportConfirmDialog
          preview={importPreview}
          onModeChange={(mode) => setImportPreview((current) => (current ? { ...current, mode } : current))}
          onConfirm={() => void handleImportConfirm()}
          onCancel={() => setImportPreview(null)}
          loading={loading}
        />
      ) : null}
    </Stack>
  );
}

function MetaBlock({ label, value }: { label: string; value: string }) {
  return (
    <Card p="sm" bg="var(--app-panel-muted)">
      <Text size="xs" tt="uppercase" fw={500} c="dimmed" style={{ letterSpacing: '0.08em' }}>
        {label}
      </Text>
      <Text mt={6}>{value}</Text>
    </Card>
  );
}

function CapabilitySummary({ status }: { status: CapStatus }) {
  if (status.status === 'idle') {
    return (
      <Text size="xs" c="dimmed">
        Capability snapshot not loaded
      </Text>
    );
  }
  if (status.status === 'loading') {
    return (
      <Text size="xs" c="dimmed">
        Scanning installed modules…
      </Text>
    );
  }
  if (status.status === 'error') {
    return (
      <Text size="xs" c="red">
        {status.error}
      </Text>
    );
  }

  const { snapshot } = status;
  const refreshed = new Date(snapshot.refreshedAt);
  const refreshedLabel = Number.isNaN(refreshed.getTime()) ? 'unknown' : refreshed.toLocaleString();
  return (
    <Group gap="xs">
      <Badge variant="light" color="teal" size="sm">
        {snapshot.modules.length} modules
      </Badge>
      <Badge variant="light" color="grape" size="sm">
        {snapshot.edition}
      </Badge>
      {snapshot.stale ? (
        <Badge variant="light" color="orange" size="sm">
          stale
        </Badge>
      ) : null}
      <Text size="xs" c="dimmed">
        {snapshot.lastError ? snapshot.lastError : `refreshed ${refreshedLabel}`}
      </Text>
    </Group>
  );
}

function StatusBadge({ status }: { status: ConnStatus }) {
  const color =
    status.status === 'ok' ? 'green' : status.status === 'error' ? 'red' : status.status === 'checking' ? 'yellow' : 'gray';

  return (
    <Badge color={color} className="app-table-status">
      {getStatusLabel(status)}
    </Badge>
  );
}

function DismissibleDeleteModal({
  candidates,
  confirmLabel,
  confirmColor,
  onCancel,
  onConfirm,
}: {
  candidates: string[];
  confirmLabel: string;
  confirmColor: 'red' | 'blue';
  onCancel: () => void;
  onConfirm: (toDelete: string[]) => void;
}) {
  const [toDelete, setToDelete] = useState<Set<string>>(new Set(candidates));

  const toggleInstance = (id: string) => {
    setToDelete((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Click any item to exclude it from deletion:
      </Text>
      <Group gap="xs" wrap="wrap">
        {candidates.map((id) => (
          <Pill
            key={id}
            withRemoveButton={toDelete.has(id)}
            onRemove={() => toggleInstance(id)}
            onClick={() => toggleInstance(id)}
            style={{ opacity: toDelete.has(id) ? 1 : 0.4, cursor: 'pointer' }}
          >
            {id}
          </Pill>
        ))}
      </Group>
      <Text size="sm" c="dimmed">
        {candidates.length - toDelete.size} of {candidates.length} excluded. This action cannot be undone.
      </Text>

      <Group justify="flex-end">
        <Button variant="default" onClick={onCancel}>
          Cancel
        </Button>
        <Button color={confirmColor} onClick={() => onConfirm(Array.from(toDelete))} disabled={toDelete.size === 0}>
          {confirmLabel}
        </Button>
      </Group>
    </Stack>
  );
}

function ImportConfirmDialog({
  preview,
  onModeChange,
  onConfirm,
  onCancel,
  loading,
}: {
  preview: ImportPreview;
  onModeChange: (mode: ImportMode) => void;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <Modal opened onClose={onCancel} title="Import instances" centered withinPortal={false} transitionProps={{ duration: 0 }}>
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {Object.keys(preview.incoming).length} instances found in the selected file.
        </Text>
        <Group>
          <Badge color="green" variant="light">
            {preview.newNames.length} new
          </Badge>
          <Badge color={preview.conflicts.length > 0 ? 'yellow' : 'gray'} variant="light">
            {preview.conflicts.length} conflicts
          </Badge>
        </Group>

        <SegmentedControl
          value={preview.mode}
          onChange={(value) => onModeChange(value as ImportMode)}
          data={[
            { label: 'Merge', value: 'merge' },
            { label: 'Replace all', value: 'replace' },
          ]}
        />

        {preview.conflicts.length > 0 ? (
          <Alert color="yellow" radius="lg">
            Existing names that will be overwritten: {preview.conflicts.join(', ')}
          </Alert>
        ) : null}

        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel}>
            Cancel
          </Button>
          <Button color={preview.mode === 'replace' ? 'red' : 'blue'} loading={loading} onClick={onConfirm}>
            {preview.mode === 'replace' ? 'Replace all' : 'Import instances'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
