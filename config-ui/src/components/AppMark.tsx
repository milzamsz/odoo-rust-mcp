import type { CSSProperties, SVGProps } from 'react';

export type AppMarkProps = Omit<SVGProps<SVGSVGElement>, 'height' | 'width'> & {
  size?: number;
};

export function AppMark({ size = 40, style, ...props }: AppMarkProps) {
  return (
    <svg
      aria-hidden="true"
      data-testid="app-mark"
      fill="none"
      height={size}
      viewBox="0 0 64 64"
      width={size}
      style={{ flex: '0 0 auto', ...style } as CSSProperties}
      {...props}
    >
      <path
        d="M32 3.5 55.5 17v30L32 60.5 8.5 47V17L32 3.5Z"
        fill="var(--app-mark-surface, #111827)"
        stroke="var(--app-mark-accent, #4f8cff)"
        strokeLinejoin="round"
        strokeWidth="3"
      />
      <path
        d="M21 37.5 16.5 42M43 37.5l4.5 4.5M32 20v-6"
        stroke="var(--app-mark-accent, #4f8cff)"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <circle cx="32" cy="32" r="11" stroke="white" strokeWidth="4" />
      <circle cx="32" cy="13" r="3.5" fill="white" />
      <circle cx="15" cy="44" r="3.5" fill="white" />
      <circle cx="49" cy="44" r="3.5" fill="white" />
      <circle cx="32" cy="32" r="3" fill="var(--app-mark-accent, #4f8cff)" />
    </svg>
  );
}
