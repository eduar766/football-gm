export const tokens = {
  colors: {
    bg: {
      base: '#0B0F14',
      surface: '#111820',
      elevated: '#1A2332',
      inset: '#0D1219',
    },
    text: {
      primary: '#F0F2F5',
      secondary: '#A0AEC0',
      tertiary: '#5A6A7A',
    },
    accent: {
      primary: '#10B981',
      gold: '#F59E0B',
      danger: '#EF4444',
      blue: '#3B82F6',
      purple: '#8B5CF6',
      orange: '#F97316',
    },
    data: {
      income: '#10B981',
      expense: '#F87171',
      neutral: '#6B7280',
      highlight: '#FBBF24',
    },
  },
  fonts: {
    display: '"Plus Jakarta Sans", sans-serif',
    body: '"DM Sans", sans-serif',
    mono: '"Geist Mono", monospace',
  },
  transitions: {
    fast: '150ms ease',
    normal: '250ms ease',
    slow: '400ms ease-out',
  },
} as const;
