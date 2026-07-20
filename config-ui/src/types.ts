export interface ExecuteAllowlistEntry {
  model: string;
  methods: string[];
}

export interface InstanceToolConfig {
  disabledTools?: string[];
  defaults?: Record<string, Record<string, unknown>>;
  /** Reviewed model/method pairs for odoo_execute. Empty/absent denies execute. */
  executeAllowlist?: ExecuteAllowlistEntry[];
}

export interface InstanceDetails {
  url: string;
  db?: string;
  apiKey?: string;
  username?: string;
  password?: string;
  version?: number | string;
  tags?: string[];
  /** When true, mutating tools are denied for this instance even if write env is set. */
  readOnly?: boolean;
  toolConfig?: InstanceToolConfig;
  [key: string]: unknown;
}

export interface InstanceConfig {
  [key: string]: InstanceDetails;
}

export type InstanceEnvSyncState = 'synced' | 'out_of_sync' | 'not_synced';
export type RuntimeSourceKind = 'instances_json' | 'inline_env' | 'single_instance';
export type AlternateSourceState = 'matches_runtime' | 'stale' | 'unreadable';

export interface AlternateInstancesSource {
  path: string;
  status: AlternateSourceState;
}

export interface InstancesSyncStatusResponse {
  configured: boolean;
  synced_count: number;
  total_count: number;
  instances: Record<string, InstanceEnvSyncState>;
  extra_env_instances: string[];
  runtime_source_kind: RuntimeSourceKind;
  instances_source_path: string | null;
  env_file_path: string;
  alternate_sources: AlternateInstancesSource[];
}

export interface SyncInstancesEnvResponse extends InstancesSyncStatusResponse {
  status: string;
  message: string;
  restart_required: boolean;
  instances_synced: number;
}

export interface ToolConfig {
  name: string;
  description?: string;
  guards?: {
    requiresEnvTrue?: string;
    [key: string]: string | undefined;
  };
  inputSchema?: {
    properties?: Record<string, ToolSchemaProperty>;
    required?: string[];
    [key: string]: unknown;
  };
  op?: {
    type?: string;
    map?: Record<string, unknown>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface ToolCatalogToolSummary {
  name: string;
  description?: string | null;
  guards?: Record<string, unknown> | null;
}

export interface ToolCatalogDrift {
  runtime_count: number;
  packaged_count: number;
  missing_count: number;
  missing_tools: ToolCatalogToolSummary[];
}

export interface ToolCatalogImportResult {
  imported_count: number;
  imported_tools: ToolCatalogToolSummary[];
  drift: ToolCatalogDrift;
}

export interface ToolSchemaProperty {
  type?: string;
  items?: {
    type?: string;
    [key: string]: unknown;
  };
  description?: string;
  enum?: string[];
  default?: unknown;
  [key: string]: unknown;
}

export interface PromptConfig {
  name: string;
  description?: string;
  content: string;
  [key: string]: unknown;
}

export interface ServerConfig {
  serverName?: string;
  instructions?: string;
  protocolVersionDefault?: string;
  [key: string]: unknown;
}

export type ConfigType = 'instances' | 'server' | 'tools' | 'prompts';

export interface StatusMessage {
  message: string;
  type: 'loading' | 'success' | 'error' | 'warning';
}

export interface ToolCategory {
  name: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  tools: string[];
  envVar: string;
}

export type TabType = 'instances' | 'server' | 'tools' | 'prompts' | 'security';

export interface AuthStatus {
  authenticated: boolean;
  auth_enabled: boolean;
  username: string | null;
}

export interface AuthContextType {
  isAuthenticated: boolean;
  authEnabled: boolean;
  username: string | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  loading: boolean;
}

export interface McpAuthStatus {
  enabled: boolean;
  token_configured: boolean;
  exe_path?: string | null;
}
