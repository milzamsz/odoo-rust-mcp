import {
  ActionIcon,
  AppShell,
  Badge,
  Box,
  Burger,
  Divider,
  Group,
  Kbd,
  Menu,
  Modal,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  Title,
  Tooltip,
  useMantineColorScheme,
} from '@mantine/core';
import { useColorScheme, useDisclosure, useLocalStorage, useMediaQuery } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import {
  BookOpenText,
  ChatCircleText,
  Check,
  Database,
  GearSix,
  House,
  Keyboard,
  Monitor,
  Moon,
  ShieldCheck,
  SidebarSimple,
  SignOut,
  SquaresFour,
  Sun,
} from '@phosphor-icons/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDirtyState } from '../hooks/useDirtyState';
import { focusPrimarySearch, isEditableElement } from '../lib/shortcuts';
import { AppMark } from './AppMark';

type NavItem = {
  label: string;
  icon: typeof House;
  path?: string;
  href?: string;
  section: 'Workspace' | 'Operations';
};

const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Overview', icon: House, path: '/', section: 'Workspace' },
  { label: 'Instances', icon: Database, path: '/instances', section: 'Workspace' },
  { label: 'Tools', icon: SquaresFour, path: '/tools', section: 'Workspace' },
  { label: 'Prompts', icon: ChatCircleText, path: '/prompts', section: 'Workspace' },
  { label: 'Documentation', icon: BookOpenText, href: 'https://milzamsz.github.io/odoo-rust-mcp/', section: 'Workspace' },
  { label: 'Server', icon: GearSix, path: '/server', section: 'Operations' },
  { label: 'Security', icon: ShieldCheck, path: '/security', section: 'Operations' },
] as const;

type ShortcutItem = {
  keys: readonly string[];
  macKeys?: readonly string[];
  description: string;
};

const SHORTCUT_GROUPS: ReadonlyArray<{ title: string; shortcuts: readonly ShortcutItem[] }> = [
  {
    title: 'Workspace',
    shortcuts: [
      { keys: ['Ctrl', 'B'], macKeys: ['Cmd', 'B'], description: 'Toggle sidebar width' },
      { keys: ['Ctrl', 'N'], macKeys: ['Cmd', 'N'], description: 'Open the primary create flow' },
      { keys: ['/'], description: 'Focus the primary search input' },
      { keys: ['?'], description: 'Open this shortcuts panel' },
    ],
  },
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['Ctrl', '1'], macKeys: ['Cmd', '1'], description: 'Overview' },
      { keys: ['Ctrl', '2'], macKeys: ['Cmd', '2'], description: 'Instances' },
      { keys: ['Ctrl', '3'], macKeys: ['Cmd', '3'], description: 'Tools' },
      { keys: ['Ctrl', '4'], macKeys: ['Cmd', '4'], description: 'Prompts' },
      { keys: ['Ctrl', '5'], macKeys: ['Cmd', '5'], description: 'Server' },
      { keys: ['Ctrl', '6'], macKeys: ['Cmd', '6'], description: 'Security' },
    ],
  },
] as const;

function getRouteLabel(pathname: string) {
  return NAV_ITEMS.find((item) => item.path === pathname)?.label ?? 'Overview';
}

export function AppShellLayout() {
  const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;
  const desktop = useMediaQuery('(min-width: 48em)');
  const osColorScheme = useColorScheme('light', { getInitialValueInEffect: false });
  const [opened, { toggle, close }] = useDisclosure(false);
  const [shortcutsOpened, setShortcutsOpened] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useLocalStorage({
    key: 'mcp_shell_sidebar_collapsed',
    defaultValue: false,
  });
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const { username, logout, version } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { isDirty, activeMessage, clearAll } = useDirtyState();

  const routeLabel = useMemo(() => getRouteLabel(location.pathname), [location.pathname]);
  const navbarWidth = desktopCollapsed && desktop ? 72 : 244;
  const activeColorScheme = colorScheme === 'auto' ? osColorScheme : colorScheme;

  const themeItems = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'auto', label: 'Auto', icon: Monitor },
  ] as const;

  const openUrlExternally = useCallback((url: string) => {
    const tauri = (window as Window & {
      __TAURI__?: {
        core?: {
          invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
        };
      };
    }).__TAURI__;
    if (tauri && tauri.core && tauri.core.invoke) {
      tauri.core.invoke('plugin:opener|open_url', { url })
        .catch((err: unknown) => console.error('Failed to open URL via Tauri:', err));
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, []);

  const navigateWithGuard = useCallback(
    (target: string) => {
      const currentTarget = `${location.pathname}${location.search}`;
      if (target === currentTarget) {
        close();
        return;
      }

      const go = () => {
        clearAll();
        navigate(target);
        close();
      };

      if (!isDirty) {
        go();
        return;
      }

      modals.openConfirmModal({
        title: 'Leave this screen?',
        children: (
          <Text size="sm" c="dimmed">
            {activeMessage ?? 'You have unsaved changes that will be lost if you continue.'}
          </Text>
        ),
        labels: { confirm: 'Discard changes', cancel: 'Stay here' },
        confirmProps: { color: 'red' },
        onConfirm: go,
      });
    },
    [activeMessage, clearAll, close, isDirty, location.pathname, location.search, navigate]
  );

  const handleLogout = async () => {
    if (isDirty) {
      modals.openConfirmModal({
        title: 'Log out now?',
        children: (
          <Text size="sm" c="dimmed">
            {activeMessage ?? 'You have unsaved changes that will be lost before logout.'}
          </Text>
        ),
        labels: { confirm: 'Log out', cancel: 'Cancel' },
        confirmProps: { color: 'red' },
        onConfirm: () => void logout(),
      });
      return;
    }

    await logout();
  };



  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const hasPrimaryModifier = event.ctrlKey || event.metaKey;

      if (hasPrimaryModifier && !event.altKey && key === 'b') {
        event.preventDefault();
        if (desktop) {
          setDesktopCollapsed((current) => !current);
        } else {
          toggle();
        }
        return;
      }

      if (hasPrimaryModifier && !event.altKey && key >= '1' && key <= '6') {
        const item = NAV_ITEMS.filter((navItem) => navItem.path)[Number(key) - 1];
        if (item) {
          event.preventDefault();
          navigateWithGuard(item.path!);
        }
        return;
      }

      if (hasPrimaryModifier && !event.altKey && key === 'n') {
        event.preventDefault();
        navigateWithGuard(location.pathname === '/prompts' ? '/prompts?action=new' : '/instances?action=new');
        return;
      }

      if (isEditableElement(event.target)) {
        return;
      }

      if (!hasPrimaryModifier && !event.altKey && !event.shiftKey && event.key === '/') {
        if (focusPrimarySearch()) {
          event.preventDefault();
        }
        return;
      }

      if (!hasPrimaryModifier && !event.altKey && event.key === '?') {
        event.preventDefault();
        setShortcutsOpened(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [desktop, location.pathname, navigateWithGuard, setDesktopCollapsed, toggle]);

  const navSections = useMemo(() => {
    const workspace = NAV_ITEMS.filter((item) => item.section === 'Workspace');
    const operations = NAV_ITEMS.filter((item) => item.section === 'Operations');
    return [
      { label: 'Workspace', items: workspace },
      { label: 'Operations', items: operations },
    ];
  }, []);

  return (
    <>
      <Modal
        opened={shortcutsOpened}
        onClose={() => setShortcutsOpened(false)}
        title="Keyboard shortcuts"
        size="lg"
        centered
      >
        <Stack gap="lg">
          <Text size="sm" c="dimmed">
            Use <Kbd>Cmd</Kbd> on macOS and <Kbd>Ctrl</Kbd> on Windows or Linux.
          </Text>
          {SHORTCUT_GROUPS.map((group) => (
            <Stack key={group.title} gap="sm">
              <Text>{group.title}</Text>
              {group.shortcuts.map((shortcut) => (
                <Group
                  key={`${group.title}-${shortcut.description}`}
                  justify="space-between"
                  wrap="nowrap"
                  align="center"
                >
                  <Text size="sm">{shortcut.description}</Text>
                  <Group gap={6} wrap="nowrap">
                    {(shortcut.macKeys ?? shortcut.keys).map((part) => (
                      <Kbd key={`${shortcut.description}-${part}`}>{part}</Kbd>
                    ))}
                  </Group>
                </Group>
              ))}
            </Stack>
          ))}
        </Stack>
      </Modal>

      <AppShell
        header={{ height: 72 }}
        footer={{ height: 44 }}
        navbar={{ width: navbarWidth, breakpoint: 'sm', collapsed: { mobile: !opened } }}
        styles={{
          main: {
            background: 'transparent',
          },
          header: {
            background: 'var(--app-header-bg)',
            borderColor: 'var(--app-border)',
            backdropFilter: 'blur(10px)',
          },
          navbar: {
            background: 'var(--app-navbar-bg)',
            borderColor: 'var(--app-navbar-border)',
            backdropFilter: 'blur(12px)',
          },
          footer: {
            background: 'var(--app-footer-bg)',
            borderColor: 'var(--app-border)',
            backdropFilter: 'blur(8px)',
          },
        }}
      >
        <AppShell.Header>
          <Group h="100%" px="lg" justify="space-between" wrap="nowrap">
            <Group gap="sm" wrap="nowrap">
              <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
              {desktop ? (
                <Tooltip label={desktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    onClick={() => setDesktopCollapsed((current) => !current)}
                    aria-label="Toggle sidebar"
                  >
                    <SidebarSimple size={18} />
                  </ActionIcon>
                </Tooltip>
              ) : null}
              <AppMark size={40} />
              <Box>
                <Text className="page-eyebrow">Odoo Rust MCP</Text>
                <Group gap="xs" wrap="wrap">
                  <Title order={4}>{routeLabel}</Title>
                  {isDirty ? (
                    <Badge variant="light" color="orange">
                      Unsaved
                    </Badge>
                  ) : null}
                </Group>
              </Box>
            </Group>

            <Group gap="xs" wrap="nowrap">
              <Tooltip label="Keyboard shortcuts">
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  onClick={() => setShortcutsOpened(true)}
                  aria-label="Keyboard shortcuts"
                >
                  <Keyboard size={18} />
                </ActionIcon>
              </Tooltip>
              <Menu shadow="sm" position="bottom-end" withinPortal={false}>
                <Menu.Target>
                  <Tooltip label="Theme mode">
                    <ActionIcon variant="subtle" color="gray" aria-label="Theme mode">
                      {activeColorScheme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                    </ActionIcon>
                  </Tooltip>
                </Menu.Target>

                <Menu.Dropdown>
                  <Menu.Label>Appearance</Menu.Label>
                  {themeItems.map((item) => (
                    <Menu.Item
                      key={item.value}
                      leftSection={<item.icon size={16} />}
                      rightSection={colorScheme === item.value ? <Check size={14} /> : null}
                      onClick={() => setColorScheme(item.value)}
                    >
                      {item.label}
                    </Menu.Item>
                  ))}
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Group>
        </AppShell.Header>

        <AppShell.Navbar p="sm">
          <AppShell.Section grow component={ScrollArea} pt="xs">
            <Stack gap="md" px={desktopCollapsed && desktop ? 0 : 'xs'}>
              {navSections.map((section) => (
                <Stack key={section.label} gap={4}>
                  {!desktopCollapsed || !desktop ? (
                    <Text className="page-eyebrow">{section.label}</Text>
                  ) : null}
                  {section.items.map((item) => (
                    <Tooltip
                      key={item.path ?? item.href ?? item.label}
                      disabled={!desktopCollapsed || !desktop}
                      label={item.label}
                      position="right"
                    >
                      <NavLink
                        aria-label={item.href ? `${item.label} (opens in a new tab)` : item.label}
                        active={Boolean(item.path && location.pathname === item.path)}
                        component={item.href && !isTauri ? 'a' : 'button'}
                        href={item.href && !isTauri ? item.href : undefined}
                        target={item.href && !isTauri ? '_blank' : undefined}
                        rel={item.href && !isTauri ? 'noopener noreferrer' : undefined}
                        className={desktopCollapsed && desktop ? 'nav-link-collapsed' : undefined}
                        label={desktopCollapsed && desktop ? undefined : item.label}
                        leftSection={<item.icon size={18} />}
                        onClick={(event) => {
                          if (item.href) {
                            if (isTauri) {
                              event.preventDefault();
                              openUrlExternally(item.href);
                            }
                            return;
                          }
                          if (item.path) {
                            navigateWithGuard(item.path);
                            return;
                          }
                          close();
                        }}
                        variant="subtle"
                        type="button"
                        styles={{
                          root: {
                            borderRadius: 10,
                            justifyContent: desktopCollapsed && desktop ? 'center' : undefined,
                            paddingInline: desktopCollapsed && desktop ? 0 : undefined,
                          },
                          section: {
                            marginInlineEnd: desktopCollapsed && desktop ? 0 : undefined,
                          },
                          body: {
                            display: desktopCollapsed && desktop ? 'none' : undefined,
                          },
                        }}
                      />
                    </Tooltip>
                  ))}
                </Stack>
              ))}
            </Stack>
          </AppShell.Section>

          <AppShell.Section pt="sm">
            <Stack gap="xs">
              <Divider />
              {!desktopCollapsed || !desktop ? (
                <Box px="xs" pt="xs">
                  <Text size="sm">{username ?? 'admin'}</Text>
                  <Text size="sm" c="dimmed">
                    Local config operator
                  </Text>
                </Box>
              ) : null}
              <Tooltip
                disabled={!desktopCollapsed || !desktop}
                label="Log out"
                position="right"
              >
                <NavLink
                  component="button"
                  label={desktopCollapsed && desktop ? undefined : 'Log out'}
                  leftSection={<SignOut size={18} />}
                  onClick={() => void handleLogout()}
                  variant="subtle"
                  type="button"
                  className={desktopCollapsed && desktop ? 'nav-link-collapsed' : undefined}
                  styles={{
                    root: {
                      borderRadius: 10,
                      justifyContent: desktopCollapsed && desktop ? 'center' : undefined,
                      paddingInline: desktopCollapsed && desktop ? 0 : undefined,
                    },
                    section: {
                      marginInlineEnd: desktopCollapsed && desktop ? 0 : undefined,
                    },
                    body: {
                      display: desktopCollapsed && desktop ? 'none' : undefined,
                    },
                  }}
                />
              </Tooltip>
            </Stack>
          </AppShell.Section>
        </AppShell.Navbar>

        <AppShell.Main className="app-shell-main">
          <Box maw={1400} mx="auto" py="sm">
            <Outlet />
          </Box>
        </AppShell.Main>

        <AppShell.Footer>
          <Group h="100%" px="lg" justify="space-between" wrap="nowrap">
            <Group gap="xs" wrap="nowrap">
              <Badge variant="dot" color="green">
                Hot reload
              </Badge>
              <Text size="sm" c="dimmed">
                v{version} — Changes are applied to the embedded config surface without restart.
              </Text>
            </Group>
            <Group gap="xs" wrap="nowrap">
              <Text size="sm" c="dimmed">
                {isDirty ? activeMessage ?? 'Unsaved changes are active.' : 'All changes saved locally.'}
              </Text>
            </Group>
          </Group>
        </AppShell.Footer>
      </AppShell>
    </>
  );
}
