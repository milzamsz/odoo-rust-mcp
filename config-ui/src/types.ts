export interface InstanceToolConfig {
  disabledTools?: string[];
  defaults?: Record<string, Record<string, any>>;
}

export interface InstanceDetails {
  url: string;
  db: string;
  apiKey?: string;
  username?: string;
  password?: string;
  version?: number | string;
  toolConfig?: InstanceToolConfig;
  [key: string]: any;
}

export interface InstanceConfig {
  [key: string]: InstanceDetails;
}

export interface ToolConfig {
  name: string;
  description?: string;
  guards?: {
    requiresEnvTrue?: string;
  };
  [key: string]: any;
}

export interface PromptConfig {
  name: string;
  description?: string;
  content: string;
  [key: string]: any;
}

export interface ServerConfig {
  serverName?: string;
  instructions?: string;
  protocolVersionDefault?: string;
  [key: string]: any;
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
}
