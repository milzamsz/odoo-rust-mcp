import {
  Center,
  Loader,
  MantineProvider,
  ColorSchemeScript,
  Text,
} from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { lazy, Suspense } from 'react';
import { AuthProvider } from './components/AuthProvider';
import { useAuth } from './hooks/useAuth';
import { LoginForm } from './components/LoginForm';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { appTheme } from './theme';
import { DirtyStateProvider } from './components/DirtyState';

const AppShellLayout = lazy(() =>
  import('./components/AppShellLayout').then((module) => ({ default: module.AppShellLayout }))
);
const OverviewTab = lazy(() =>
  import('./components/tabs/OverviewTab').then((module) => ({ default: module.OverviewTab }))
);
const InstancesTab = lazy(() =>
  import('./components/tabs/InstancesTab').then((module) => ({ default: module.InstancesTab }))
);
const ToolsTab = lazy(() =>
  import('./components/tabs/ToolsTab').then((module) => ({ default: module.ToolsTab }))
);
const PromptsTab = lazy(() =>
  import('./components/tabs/PromptsTab').then((module) => ({ default: module.PromptsTab }))
);
const ServerTab = lazy(() =>
  import('./components/tabs/ServerTab').then((module) => ({ default: module.ServerTab }))
);
const SecurityTab = lazy(() =>
  import('./components/tabs/SecurityTab').then((module) => ({ default: module.SecurityTab }))
);

function LoadingScreen() {
  return (
    <Center mih="100vh">
      <div>
        <Center>
          <Loader color="blue" />
        </Center>
        <Text mt="md" c="dimmed">
          Loading configuration workspace...
        </Text>
      </div>
    </Center>
  );
}

function AuthenticatedApp() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return (
    <HashRouter>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route element={<AppShellLayout />}>
            <Route path="/" element={<OverviewTab />} />
            <Route path="/instances" element={<InstancesTab />} />
            <Route path="/tools" element={<ToolsTab />} />
            <Route path="/prompts" element={<PromptsTab />} />
            <Route path="/server" element={<ServerTab />} />
            <Route path="/security" element={<SecurityTab />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </HashRouter>
  );
}

function ThemedApp() {
  return (
    <>
      <ColorSchemeScript defaultColorScheme="auto" />
      <MantineProvider theme={appTheme} defaultColorScheme="auto">
        <ModalsProvider>
          <Notifications position="top-right" />
          <AuthProvider>
            <DirtyStateProvider>
              <AuthenticatedApp />
            </DirtyStateProvider>
          </AuthProvider>
        </ModalsProvider>
      </MantineProvider>
    </>
  );
}

export default ThemedApp;
