import React, { useState, useEffect } from 'react';
import { Shield, Key, Lock, Copy, Check, AlertTriangle, Loader2, Eye, EyeOff, ToggleLeft, ToggleRight, RefreshCw } from 'lucide-react';
import { useAuth } from '../AuthProvider';
import { useSecurityActions } from '../../hooks/useAuth';

export function SecurityTab() {
  const { username, authEnabled } = useAuth();
  const { changePassword, getMcpAuthStatus, setMcpAuthEnabled, generateMcpToken, loading } = useSecurityActions();

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // MCP Auth state
  const [mcpAuthEnabled, setMcpAuthEnabledState] = useState(false);
  const [mcpTokenConfigured, setMcpTokenConfigured] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [mcpError, setMcpError] = useState<string | null>(null);
  const [mcpLoading, setMcpLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);

  // Load MCP auth status on mount
  useEffect(() => {
    getMcpAuthStatus()
      .then((status) => {
        setMcpAuthEnabledState(status.enabled);
        setMcpTokenConfigured(status.token_configured);
      })
      .catch(console.error);
  }, [getMcpAuthStatus]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword.length < 4) {
      setPasswordError('Password must be at least 4 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    try {
      await changePassword(newPassword);
      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password');
    }
  };

  const handleToggleMcpAuth = async () => {
    setToggleLoading(true);
    setMcpError(null);

    try {
      const newValue = !mcpAuthEnabled;
      await setMcpAuthEnabled(newValue);
      setMcpAuthEnabledState(newValue);
    } catch (err) {
      setMcpError(err instanceof Error ? err.message : 'Failed to update setting');
    } finally {
      setToggleLoading(false);
    }
  };

  const handleGenerateToken = async () => {
    setMcpError(null);
    setGeneratedToken(null);
    setMcpLoading(true);

    try {
      const token = await generateMcpToken();
      setGeneratedToken(token);
      setMcpTokenConfigured(true);
    } catch (err) {
      setMcpError(err instanceof Error ? err.message : 'Failed to generate token');
    } finally {
      setMcpLoading(false);
    }
  };

  const copyToken = async () => {
    if (generatedToken) {
      await navigator.clipboard.writeText(generatedToken);
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    }
  };

  const closeTokenModal = () => {
    setGeneratedToken(null);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Shield className="w-7 h-7 text-purple-600" />
          Security Settings
        </h2>
        <p className="text-gray-600 mt-2">
          Manage authentication credentials and security tokens
        </p>
      </div>

      {/* Change Password Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Lock className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Config UI Password</h3>
            <p className="text-sm text-gray-500">
              {authEnabled
                ? `Logged in as: ${username}`
                : 'Authentication is disabled (no credentials configured)'}
            </p>
          </div>
        </div>

        {authEnabled ? (
          <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Enter new password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Confirm new password"
                disabled={loading}
              />
            </div>

            {passwordError && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertTriangle className="w-4 h-4" />
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <Check className="w-4 h-4" />
                Password changed successfully
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !newPassword || !confirmPassword}
              className="px-4 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Change Password'
              )}
            </button>
          </form>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800 text-sm">
            <p>
              To enable authentication, set <code className="bg-yellow-100 px-1 rounded">CONFIG_UI_USERNAME</code> and{' '}
              <code className="bg-yellow-100 px-1 rounded">CONFIG_UI_PASSWORD</code> environment variables.
            </p>
          </div>
        )}
      </div>

      {/* MCP HTTP Transport Authentication Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Key className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">MCP HTTP Transport Authentication</h3>
            <p className="text-sm text-gray-500">
              Require Bearer token for HTTP transport requests
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">HTTP Authentication</p>
              <p className="text-sm text-gray-500">
                {mcpAuthEnabled
                  ? 'Clients must include Authorization header'
                  : 'No authentication required for HTTP requests'}
              </p>
            </div>
            <button
              onClick={handleToggleMcpAuth}
              disabled={toggleLoading}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                mcpAuthEnabled
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              {toggleLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : mcpAuthEnabled ? (
                <ToggleRight className="w-5 h-5" />
              ) : (
                <ToggleLeft className="w-5 h-5" />
              )}
              {mcpAuthEnabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {/* Token Status */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Token Status:</span>
            {mcpTokenConfigured ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                <Check className="w-4 h-4" />
                Configured
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-medium">
                Not Configured
              </span>
            )}
          </div>

          {mcpError && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertTriangle className="w-4 h-4" />
              {mcpError}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerateToken}
              disabled={mcpLoading}
              className="px-4 py-2.5 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:bg-purple-300 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {mcpLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  {mcpTokenConfigured ? 'Regenerate Token' : 'Generate Token'}
                </>
              )}
            </button>
          </div>

          {mcpAuthEnabled && !mcpTokenConfigured && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800 text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p>
                  Authentication is enabled but no token is configured. Generate a token to allow clients to authenticate.
                </p>
              </div>
            </div>
          )}

          <p className="text-sm text-gray-500">
            {mcpTokenConfigured
              ? 'Generating a new token will replace the existing one. The server needs to restart for changes to take effect.'
              : 'Generate a token to enable authentication for HTTP transport.'}
          </p>
        </div>
      </div>

      {/* Token Generated Modal */}
      {generatedToken && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 rounded-full">
                <Check className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Token Generated</h3>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-800">
                  <strong>Important:</strong> This token will only be shown once. Copy it now and store it securely. 
                  Restart the server for changes to take effect.
                </p>
              </div>
            </div>

            <div className="bg-gray-900 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between gap-3">
                <code className="text-green-400 font-mono text-sm break-all">
                  {generatedToken}
                </code>
                <button
                  onClick={copyToken}
                  className="flex-shrink-0 p-2 hover:bg-gray-700 rounded-lg transition-colors"
                  title="Copy to clipboard"
                >
                  {tokenCopied ? (
                    <Check className="w-5 h-5 text-green-400" />
                  ) : (
                    <Copy className="w-5 h-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 mb-6 text-sm text-gray-600">
              <p className="font-medium mb-1">Use this token in your HTTP requests:</p>
              <code className="text-xs bg-gray-200 px-2 py-1 rounded block mt-1">
                Authorization: Bearer {generatedToken.substring(0, 8)}...
              </code>
            </div>

            <div className="flex justify-end">
              <button
                onClick={closeTokenModal}
                className="px-4 py-2 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
