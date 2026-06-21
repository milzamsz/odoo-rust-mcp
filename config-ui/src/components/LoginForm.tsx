import {
  Alert,
  Box,
  Button,
  Card,
  Center,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useState, type FormEvent } from 'react';
import { LockKey, WarningCircle, User } from '@phosphor-icons/react';
import { useAuth } from '../hooks/useAuth';
import { AppMark } from './AppMark';
import packageJson from '../../package.json';

export function LoginForm() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(username, password);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Center mih="100vh" p="md">
      <Card
        maw={460}
        w="100%"
        p="xl"
        className="surface-panel"
        style={{
          borderRadius: 16,
        }}
      >
        <Stack gap="lg">
          <Box ta="center">
            <Center mb="md">
              <AppMark size={58} />
            </Center>
            <Text className="page-eyebrow">
              Config UI
            </Text>
            <Title order={1} mt="xs">
              Sign in to configuration
            </Title>
            <Text c="dimmed" size="xs" mt="sm">
              Version {packageJson.version}
            </Text>
          </Box>

          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              {error ? (
                <Alert color="red" radius="md" icon={<WarningCircle size={16} />} title="Authentication failed">
                  {error}
                </Alert>
              ) : null}

              <TextInput
                label="Username"
                placeholder="Enter username"
                value={username}
                onChange={(event) => setUsername(event.currentTarget.value)}
                leftSection={<User size={16} />}
                disabled={loading}
                required
              />

              <PasswordInput
                label="Password"
                placeholder="Enter password"
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
                leftSection={<LockKey size={16} />}
                disabled={loading}
                required
              />

              <Button type="submit" size="md" loading={loading}>
                Sign in
              </Button>
              <Text size="xs" c="dimmed" ta="center">
                Default: admin / changeme
              </Text>
            </Stack>
          </form>
        </Stack>
      </Card>
    </Center>
  );
}
