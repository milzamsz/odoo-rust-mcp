import { createContext } from 'react';
import type { AuthContextType } from '../types';

export const AuthContext = createContext<AuthContextType | null>(null);
export const TOKEN_STORAGE_KEY = 'mcp_config_token';
