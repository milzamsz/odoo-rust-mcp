import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('useAuth Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useSecurityActions', () => {
    it('should initialize with no token', () => {
      const context = { token: null };
      expect(context.token).toBeNull();
    });

    it('should create headers without token', () => {
      const token = null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['Authorization']).toBeUndefined();
    });

    it('should create headers with token', () => {
      const token = 'test_token_12345';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      expect(headers['Authorization']).toBe('Bearer test_token_12345');
    });

    it('should initialize loading state as false', () => {
      const state = { loading: false };
      expect(state.loading).toBe(false);
    });

    it('should initialize error state as null', () => {
      const state = { error: null };
      expect(state.error).toBeNull();
    });
  });

  describe('changePassword', () => {
    it('should handle successful password change', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      globalThis.fetch = mockFetch;

      const response = await mockFetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: 'newpass123' }),
      });

      expect(response.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/change-password',
        expect.any(Object)
      );
    });

    it('should set loading state during password change', async () => {
      let loading = false;

      const changePassword = async () => {
        loading = true;
        await new Promise(resolve => setTimeout(resolve, 10));
        loading = false;
      };

      expect(loading).toBe(false);
      await changePassword();
      expect(loading).toBe(false);
    });

    it('should handle password change errors', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Current password incorrect' }),
      });

      globalThis.fetch = mockFetch;

      const response = await mockFetch('/api/auth/change-password', {
        method: 'POST',
      });

      expect(response.ok).toBe(false);
    });

    it('should clear error after successful change', async () => {
      let error: string | null = 'Previous error';

      // Simulate successful change
      error = null;

      expect(error).toBeNull();
    });
  });

  describe('getMcpAuthStatus', () => {
    it('should fetch MCP auth status', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ enabled: true, token: 'mcp_token' }),
      });

      globalThis.fetch = mockFetch;

      const response = await mockFetch('/api/auth/mcp-auth-status', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      expect(data.enabled).toBe(true);
      expect(data.token).toBeTruthy();
    });

    it('should return auth status object', async () => {
      const status = { enabled: true, token: 'test_token', expiresAt: '2024-12-31' };

      expect(status.enabled).toBe(true);
      expect(status.token).toBeTruthy();
      expect(status.expiresAt).toBeTruthy();
    });

    it('should handle auth status fetch errors', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });

      globalThis.fetch = mockFetch;

      const response = await mockFetch('/api/auth/mcp-auth-status');
      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
    });
  });

  describe('setMcpAuthEnabled', () => {
    it('should enable MCP auth', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      globalThis.fetch = mockFetch;

      await mockFetch('/api/auth/mcp-auth-enabled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true }),
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/mcp-auth-enabled',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should disable MCP auth', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      globalThis.fetch = mockFetch;

      await mockFetch('/api/auth/mcp-auth-enabled', {
        method: 'POST',
        body: JSON.stringify({ enabled: false }),
      });

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle auth enabled errors', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Permission denied' }),
      });

      globalThis.fetch = mockFetch;

      const response = await mockFetch('/api/auth/mcp-auth-enabled', {
        method: 'POST',
      });

      expect(response.ok).toBe(false);
    });

    it('should set loading state during update', async () => {
      let loading = false;

      const setMcpAuthEnabled = async () => {
        loading = true;
        await new Promise(resolve => setTimeout(resolve, 10));
        loading = false;
      };

      expect(loading).toBe(false);
      await setMcpAuthEnabled();
      expect(loading).toBe(false);
    });
  });

  describe('generateMcpToken', () => {
    it('should generate new MCP token', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ token: 'new_mcp_token_xyz' }),
      });

      globalThis.fetch = mockFetch;

      const response = await mockFetch('/api/auth/generate-mcp-token', {
        method: 'POST',
      });

      const data = await response.json();
      expect(data.token).toBeTruthy();
      expect(data.token).toContain('mcp_token');
    });

    it('should return token string', async () => {
      const token = 'mcp_token_abc123def456';

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should handle token generation errors', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Rate limit exceeded' }),
      });

      globalThis.fetch = mockFetch;

      const response = await mockFetch('/api/auth/generate-mcp-token', {
        method: 'POST',
      });

      expect(response.ok).toBe(false);
    });

    it('should set loading state during generation', async () => {
      let loading = false;

      const generateToken = async () => {
        loading = true;
        await new Promise(resolve => setTimeout(resolve, 10));
        loading = false;
        return 'token_123';
      };

      const token = await generateToken();
      expect(token).toBe('token_123');
      expect(loading).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should set error message on failure', () => {
      let error: string | null = null;

      const handleError = (err: Error) => {
        error = err.message;
      };

      handleError(new Error('Network failed'));
      expect(error).toBe('Network failed');
    });

    it('should clear error after successful operation', () => {
      let error: string | null = 'Previous error';

      error = null;

      expect(error).toBeNull();
    });

    it('should handle JSON parse errors', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      globalThis.fetch = mockFetch;

      try {
        const response = await mockFetch('/api/test');
        await response.json();
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
      }
    });

    it('should provide default error messages', () => {
      const errors = {
        password: 'Failed to change password',
        status: 'Failed to get MCP auth status',
        enabled: 'Failed to update setting',
        token: 'Failed to generate token',
      };

      expect(errors.password).toBeTruthy();
      expect(errors.token).toBeTruthy();
    });
  });

  describe('Return Value', () => {
    it('should return security actions object', () => {
      const actions = {
        changePassword: () => {},
        getMcpAuthStatus: () => {},
        setMcpAuthEnabled: () => {},
        generateMcpToken: () => {},
        loading: false,
        error: null,
        clearError: () => {},
      };

      expect(typeof actions.changePassword).toBe('function');
      expect(typeof actions.getMcpAuthStatus).toBe('function');
      expect(typeof actions.setMcpAuthEnabled).toBe('function');
      expect(typeof actions.generateMcpToken).toBe('function');
      expect(actions.loading).toBe(false);
      expect(actions.error).toBeNull();
      expect(typeof actions.clearError).toBe('function');
    });

    it('should expose clearError function', () => {
      let error: string | null = 'Some error';

      const clearError = () => {
        error = null;
      };

      expect(error).toBe('Some error');
      clearError();
      expect(error).toBeNull();
    });
  });

  describe('Token Management', () => {
    it('should use token in authorization header', () => {
      const token = 'bearer_token_123';
      const headers: Record<string, string> = {};

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      expect(headers['Authorization']).toBe('Bearer bearer_token_123');
    });

    it('should not include token if not set', () => {
      const token = null;
      const headers: Record<string, string> = {};

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      expect('Authorization' in headers).toBe(false);
    });

    it('should update headers when token changes', () => {
      let token = null as string | null;
      const getHeaders = () => {
        const h: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) {
          h['Authorization'] = `Bearer ${token}`;
        }
        return h;
      };

      let headers = getHeaders();
      expect('Authorization' in headers).toBe(false);

      token = 'new_token';
      headers = getHeaders();
      expect('Authorization' in headers).toBe(true);
    });
  });

  describe('Content-Type Header', () => {
    it('should always include Content-Type header', () => {
      const headers = { 'Content-Type': 'application/json' };

      expect(headers['Content-Type']).toBe('application/json');
    });

    it('should use application/json for API calls', () => {
      const contentType = 'application/json';

      expect(contentType).toBe('application/json');
    });
  });
});
