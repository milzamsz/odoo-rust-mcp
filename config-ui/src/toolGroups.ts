import type { ToolConfig } from './types';

export interface ToolGroupDefinition {
  id: string;
  label: string;
  headerClass: string;
  badgeClass: string;
  enableBtnClass: string;
  tools: string[];
}

export const TOOL_GROUPS: ToolGroupDefinition[] = [
  {
    id: 'read',
    label: 'Read Operations',
    headerClass: 'bg-blue-50 border-blue-200',
    badgeClass: 'bg-blue-100 text-blue-800',
    enableBtnClass: 'text-blue-700 border-blue-300 hover:bg-blue-100',
    tools: [
      'odoo_search',
      'odoo_search_read',
      'odoo_read',
      'odoo_count',
      'odoo_read_group',
      'odoo_name_search',
      'odoo_name_get',
      'odoo_default_get',
      'odoo_get_model_metadata',
      'odoo_list_models',
      'odoo_check_access',
      'odoo_onchange',
    ],
  },
  {
    id: 'write',
    label: 'Write Operations',
    headerClass: 'bg-yellow-50 border-yellow-200',
    badgeClass: 'bg-yellow-100 text-yellow-800',
    enableBtnClass: 'text-yellow-700 border-yellow-300 hover:bg-yellow-100',
    tools: [
      'odoo_create',
      'odoo_update',
      'odoo_delete',
      'odoo_execute',
      'odoo_workflow_action',
      'odoo_generate_report',
      'odoo_copy',
      'odoo_create_batch',
    ],
  },
  {
    id: 'cleanup',
    label: 'Cleanup Operations',
    headerClass: 'bg-red-50 border-red-200',
    badgeClass: 'bg-red-100 text-red-800',
    enableBtnClass: 'text-red-700 border-red-300 hover:bg-red-100',
    tools: ['odoo_database_cleanup', 'odoo_deep_cleanup'],
  },
];

export const OTHER_TOOL_GROUP = {
  id: 'other',
  label: 'Other',
  headerClass: 'bg-gray-50 border-gray-200',
  badgeClass: 'bg-gray-200 text-gray-700',
  enableBtnClass: 'text-gray-700 border-gray-300 hover:bg-gray-100',
};

export const ALL_GROUPED_TOOL_NAMES = new Set<string>(TOOL_GROUPS.flatMap((group) => group.tools));

export function countEnabledToolsForInstance(
  availableTools: ToolConfig[],
  disabledTools: string[] = []
): number {
  const disabledToolSet = new Set(disabledTools);
  return availableTools.reduce(
    (count, tool) => count + (disabledToolSet.has(tool.name) ? 0 : 1),
    0
  );
}

export function filterKnownDisabledTools(
  availableTools: ToolConfig[],
  disabledTools: string[] = []
): string[] {
  const knownToolNames = new Set(availableTools.map((tool) => tool.name));
  return disabledTools.filter((toolName) => knownToolNames.has(toolName));
}
