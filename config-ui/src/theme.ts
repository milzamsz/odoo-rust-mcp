import { createTheme } from '@mantine/core';

export const appTheme = createTheme({
  primaryColor: 'blue',
  defaultRadius: 'md',
  cursorType: 'pointer',
  fontFamily: "'Geist Sans', 'Segoe UI', sans-serif",
  fontFamilyMonospace: "'Geist Mono', 'Cascadia Code', monospace",
  fontSizes: {
    xs: '0.75rem',
    sm: '0.8125rem',
    md: '0.875rem',
    lg: '0.9375rem',
    xl: '1rem',
  },
  headings: {
    fontFamily: "'Geist Sans', 'Segoe UI', sans-serif",
    fontWeight: '500',
    sizes: {
      h1: { fontSize: '1.5rem', lineHeight: '1.2' },
      h2: { fontSize: '1.25rem', lineHeight: '1.25' },
      h3: { fontSize: '1rem', lineHeight: '1.35' },
      h4: { fontSize: '0.9375rem', lineHeight: '1.4' },
    },
  },
  colors: {
    blue: [
      '#f2f7ff',
      '#e3efff',
      '#c8ddff',
      '#a4c3ff',
      '#7ca8ff',
      '#558dff',
      '#3d73e6',
      '#2f5abb',
      '#25458f',
      '#1c3369',
    ],
    gray: [
      '#fbfbfa',
      '#f5f5f2',
      '#ecece7',
      '#ddddd7',
      '#c7c7c0',
      '#a7a79f',
      '#7f7f78',
      '#5d5d57',
      '#363632',
      '#1e1e1b',
    ],
  },
  other: {
    shellBorder: 'rgba(26, 26, 23, 0.08)',
    shellCard: '#ffffff',
    shellMuted: '#6f6f68',
    shellPanel: '#f9f9f7',
    shellCanvas: '#f6f4ef',
    shellAccentSoft: '#edf3ff',
    shellSuccessSoft: '#edf3ec',
  },
  shadows: {
    xs: '0 1px 2px rgba(17, 17, 17, 0.04)',
    sm: '0 2px 8px rgba(17, 17, 17, 0.04)',
    md: '0 6px 24px rgba(17, 17, 17, 0.06)',
  },
  components: {
    AppShell: {
      defaultProps: {
        padding: 'lg',
      },
    },
    ActionIcon: {
      defaultProps: {
        radius: 'md',
        variant: 'subtle',
      },
    },
    Badge: {
      defaultProps: {
        radius: 'xl',
        variant: 'light',
      },
      styles: {
        root: {
          fontSize: '0.72rem',
          fontWeight: 500,
          letterSpacing: '0.02em',
          textTransform: 'none',
        },
        label: {
          overflow: 'visible',
        },
      },
    },
    Button: {
      defaultProps: {
        radius: 'md',
      },
      styles: {
        root: {
          fontWeight: 500,
        },
        label: {
          fontSize: '0.875rem',
        },
      },
    },
    Card: {
      defaultProps: {
        radius: 'lg',
        withBorder: true,
      },
    },
    Input: {
      defaultProps: {
        radius: 'md',
      },
    },
    Modal: {
      defaultProps: {
        radius: 'lg',
      },
    },
    Drawer: {
      defaultProps: {
        radius: 'lg',
      },
    },
    NavLink: {
      styles: {
        root: {
          fontSize: '0.9rem',
          fontWeight: 500,
        },
        description: {
          fontSize: '0.8rem',
        },
      },
    },
    Pill: {
      styles: {
        root: {
          fontSize: '0.75rem',
          fontWeight: 500,
        },
      },
    },
    Table: {
      styles: {
        th: {
          fontWeight: 500,
          color: 'var(--app-text-muted)',
          fontSize: '0.8125rem',
        },
        td: {
          fontSize: '0.875rem',
        },
      },
    },
    Text: {
      defaultProps: {
        size: 'md',
      },
    },
    TextInput: {
      defaultProps: {
        radius: 'md',
      },
    },
    Title: {
      styles: {
        root: {
          letterSpacing: '-0.02em',
        },
      },
    },
  },
});
