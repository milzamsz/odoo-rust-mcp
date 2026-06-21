import { Box } from '@mantine/core';
import type { ReactNode } from 'react';

export function NameChip({ children }: { children: ReactNode }) {
  return (
    <Box
      component="span"
      style={{
        display: 'inline-block',
        padding: '0',
        borderRadius: 6,
        color: 'var(--app-text)',
        fontSize: '0.9375rem',
        fontWeight: 500,
        letterSpacing: '-0.01em',
        lineHeight: 1.45,
      }}
    >
      {children}
    </Box>
  );
}
