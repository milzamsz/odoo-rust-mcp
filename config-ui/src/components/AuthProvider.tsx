import { useState, useEffect, useCallback, type ReactNode } from 'react';
import type { AuthStatus } from '../types';
import packageJson from '../../package.json';
import { AuthContext, TOKEN_STORAGE_KEY } from './AuthContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authEnabled, setAuthEnabled] = useState(true);
  const [username, setUsername] = useState<string | null>(null);
  // Prefer the version reported by the running server (authoritative even if
  // this embedded UI bundle is stale); fall back to the build-time value.
  const [version, setVersion] = useState<string>(packageJson.version);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/auth/status', { headers });
      const data: AuthStatus = await response.json();

      setAuthEnabled(data.auth_enabled);
      setIsAuthenticated(data.authenticated);
      setUsername(data.username);
      if (data.version) {
        setVersion(data.version);
      }

      // If auth is disabled, we're always authenticated
      if (!data.auth_enabled) {
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Failed to check auth status:', error);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (username: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(data.error || 'Login failed');
    }

    const data = await response.json();
    setToken(data.token);
    setUsername(data.username);
    setIsAuthenticated(true);
    localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
  }, []);

  const logout = useCallback(async () => {
    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setToken(null);
      setUsername(null);
      setIsAuthenticated(false);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        authEnabled,
        username,
        version,
        token,
        login,
        logout,
        checkAuth,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
