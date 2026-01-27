import { useState, useCallback } from 'react';
import { useAuth as useAuthContext } from '../components/AuthProvider';
import type { McpAuthStatus } from '../types';

export function useAuth() {
  return useAuthContext();
}

export function useSecurityActions() {
  const { token } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getHeaders = useCallback((): HeadersInit => {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, [token]);

  const changePassword = useCallback(async (newPassword: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ new_password: newPassword }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Failed to change password' }));
        throw new Error(data.error || 'Failed to change password');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to change password';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  const getMcpAuthStatus = useCallback(async (): Promise<McpAuthStatus> => {
    const response = await fetch('/api/auth/mcp-auth-status', {
      headers: getHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to get MCP auth status');
    }

    return response.json();
  }, [getHeaders]);

  const setMcpAuthEnabled = useCallback(async (enabled: boolean): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/mcp-auth-enabled', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ enabled }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Failed to update setting' }));
        throw new Error(data.error || 'Failed to update setting');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update setting';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  const generateMcpToken = useCallback(async (): Promise<string> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/generate-mcp-token', {
        method: 'POST',
        headers: getHeaders(),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Failed to generate token' }));
        throw new Error(data.error || 'Failed to generate token');
      }

      const data = await response.json();
      return data.token;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate token';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  return {
    changePassword,
    getMcpAuthStatus,
    setMcpAuthEnabled,
    generateMcpToken,
    loading,
    error,
    clearError: () => setError(null),
  };
}
