import {
  Alert,
  Badge,
  Button,
  Card,
  Code,
  CopyButton,
  Group,
  PasswordInput,
  Stack,
  Switch,
  Text,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  ArrowClockwise,
  Check,
  Copy,
  ShieldCheck,
  WarningCircle,
} from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { useAuth, useSecurityActions } from '../../hooks/useAuth';
import { SectionTitle } from '../SectionTitle';

export function SecurityTab() {
  const { username, authEnabled } = useAuth();
  const { changePassword, getMcpAuthStatus, setMcpAuthEnabled, generateMcpToken, loading } = useSecurityActions();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mcpAuthEnabled, setMcpAuthEnabledState] = useState(false);
  const [mcpTokenConfigured, setMcpTokenConfigured] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    getMcpAuthStatus()
      .then((status) => {
        setMcpAuthEnabledState(status.enabled);
        setMcpTokenConfigured(status.token_configured);
      })
      .catch((error) => {
        setStatusError(error instanceof Error ? error.message : 'Failed to load MCP auth status');
      });
  }, [getMcpAuthStatus]);

  const handlePasswordChange = async () => {
    if (newPassword.length < 4) {
      notifications.show({ color: 'yellow', title: 'Password too short', message: 'Use at least 4 characters.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      notifications.show({ color: 'yellow', title: 'Passwords do not match', message: 'Please re-enter the same password.' });
      return;
    }

    try {
      await changePassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      notifications.show({
        color: 'green',
        title: 'Password updated',
        message: 'The Config UI password was changed and hot reloaded.',
      });
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Password change failed',
        message: error instanceof Error ? error.message : 'Failed to change password',
      });
    }
  };

  const handleToggleMcpAuth = async (enabled: boolean) => {
    try {
      await setMcpAuthEnabled(enabled);
      setMcpAuthEnabledState(enabled);
      notifications.show({
        color: 'green',
        title: 'HTTP auth updated',
        message: enabled ? 'Bearer auth is now required for HTTP transport.' : 'HTTP transport auth is now disabled.',
      });
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Toggle failed',
        message: error instanceof Error ? error.message : 'Failed to update HTTP auth',
      });
    }
  };

  const handleGenerateToken = async () => {
    try {
      const token = await generateMcpToken();
      setGeneratedToken(token);
      setMcpTokenConfigured(true);
      notifications.show({
        color: 'green',
        title: 'Token generated',
        message: 'Copy the new token now. It will not be shown again after you leave this page.',
      });
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Token generation failed',
        message: error instanceof Error ? error.message : 'Failed to generate token',
      });
    }
  };

  return (
    <Stack gap="xl">
      <div>
        <Title order={1}>Passwords and transport auth</Title>
        <Text className="page-lead" mt={4}>
          Keep the configuration UI credential flow simple, and only enable HTTP bearer auth when
          your deployment needs an exposed transport surface.
        </Text>
      </div>

      {statusError ? (
        <Alert color="red" radius="md" icon={<WarningCircle size={16} />} title="Security status unavailable">
          {statusError}
        </Alert>
      ) : null}

      <Card p="lg" className="surface-panel">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <SectionTitle
              title="Config UI password"
              subtitle={authEnabled ? `Authenticated as ${username ?? 'admin'}.` : 'UI authentication is disabled because no credentials are configured.'}
            />
            <Badge color={authEnabled ? 'green' : 'gray'} variant="light">
              {authEnabled ? 'Auth enabled' : 'Auth disabled'}
            </Badge>
          </Group>

          {authEnabled ? (
            <Stack gap="sm">
              <PasswordInput
                label="New password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.currentTarget.value)}
              />
              <PasswordInput
                label="Confirm password"
                placeholder="Repeat new password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.currentTarget.value)}
              />
              <Group justify="flex-end">
                <Button loading={loading} onClick={() => void handlePasswordChange()}>
                  Update password
                </Button>
              </Group>
            </Stack>
          ) : (
            <Alert color="yellow" radius="md">
              Set `CONFIG_UI_USERNAME` and `CONFIG_UI_PASSWORD` to enable login protection for the config UI.
            </Alert>
          )}
        </Stack>
      </Card>

      <Card p="lg" className="surface-panel">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <SectionTitle
              title="MCP HTTP auth"
              subtitle="Require a Bearer token for HTTP transport requests when the MCP endpoint is exposed."
            />
            <ShieldCheck size={18} weight="duotone" />
          </Group>

          <Group justify="space-between">
            <div>
              <Text>Bearer token requirement</Text>
              <Text size="sm" c="dimmed">
                {mcpAuthEnabled ? 'Clients must send Authorization headers.' : 'HTTP requests are currently unauthenticated.'}
              </Text>
            </div>
            <Switch checked={mcpAuthEnabled} onChange={(event) => void handleToggleMcpAuth(event.currentTarget.checked)} />
          </Group>

          <Group>
            <Badge color={mcpTokenConfigured ? 'green' : 'yellow'} variant="light">
              {mcpTokenConfigured ? 'Token configured' : 'Token missing'}
            </Badge>
            <Button
              variant="default"
              leftSection={<ArrowClockwise size={16} />}
              loading={loading}
              onClick={() => void handleGenerateToken()}
            >
              {mcpTokenConfigured ? 'Regenerate token' : 'Generate token'}
            </Button>
          </Group>

          {generatedToken ? (
            <Card p="md" bg="var(--app-panel-muted)">
              <Stack gap="sm">
                <Text>New token</Text>
                <Group justify="space-between" align="center" wrap="nowrap">
                  <Code block style={{ flex: 1, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
                    {generatedToken}
                  </Code>
                  <CopyButton value={generatedToken}>
                    {({ copied, copy }) => (
                      <Button
                        variant="light"
                        color={copied ? 'green' : 'blue'}
                        leftSection={copied ? <Check size={16} /> : <Copy size={16} />}
                        onClick={copy}
                      >
                        {copied ? 'Copied' : 'Copy'}
                      </Button>
                    )}
                  </CopyButton>
                </Group>
                <Alert color="yellow" radius="md">
                  Store this token now. Operators need to distribute it to HTTP clients manually.
                </Alert>
              </Stack>
            </Card>
          ) : null}
        </Stack>
      </Card>
    </Stack>
  );
}
