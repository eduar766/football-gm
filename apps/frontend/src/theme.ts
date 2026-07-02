import { createTheme, type MantineThemeOverride } from '@mantine/core';

export const theme: MantineThemeOverride = createTheme({
  primaryColor: 'accent',
  primaryShade: { light: 5, dark: 5 },
  colors: {
    accent: [
      '#D1FAE5',
      '#A7F3D0',
      '#6EE7B7',
      '#34D399',
      '#10B981',
      '#059669',
      '#047857',
      '#065F46',
      '#064E3B',
      '#022C22',
    ],
    gold: [
      '#FFFBEB',
      '#FEF3C7',
      '#FDE68A',
      '#FCD34D',
      '#FBBF24',
      '#F59E0B',
      '#D97706',
      '#B45309',
      '#92400E',
      '#78350F',
    ],
    // Cohesive navy-black command-center surfaces (light → dark)
    dark: [
      '#C7D0DB',
      '#A4B0BD',
      '#7E8B99',
      '#5A6675',
      '#26313D', // 4 — default border
      '#141D27', // 5 — raised surface
      '#0F151C', // 6 — panel / default paper
      '#0A0E14', // 7 — body background
      '#070A0F', // 8
      '#04070A', // 9
    ],
  },
  fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, sans-serif',
  fontFamilyMonospace: '"Geist Mono", "SF Mono", "Fira Code", monospace',
  headings: {
    fontFamily: '"Plus Jakarta Sans", sans-serif',
    fontWeight: '700',
    sizes: {
      h1: { fontSize: '34px', lineHeight: '1.15', fontWeight: '800' },
      h2: { fontSize: '26px', lineHeight: '1.2', fontWeight: '800' },
      h3: { fontSize: '21px', lineHeight: '1.3', fontWeight: '700' },
      h4: { fontSize: '17px', lineHeight: '1.35', fontWeight: '700' },
      h5: { fontSize: '15px', lineHeight: '1.4', fontWeight: '600' },
      h6: { fontSize: '13px', lineHeight: '1.4', fontWeight: '600' },
    },
  },
  fontSizes: {
    xs: '11px',
    sm: '13px',
    md: '15px',
    lg: '17px',
    xl: '20px',
  },
  radius: {
    xs: '4px',
    sm: '7px',
    md: '10px',
    lg: '14px',
    xl: '18px',
  },
  spacing: {
    xxs: '2px',
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
  },
  shadows: {
    xs: '0 1px 0 rgba(255,255,255,0.03) inset, 0 6px 16px -12px rgba(0,0,0,0.9)',
    sm: '0 1px 0 rgba(255,255,255,0.03) inset, 0 12px 30px -18px rgba(0,0,0,0.9)',
    md: '0 1px 0 rgba(255,255,255,0.04) inset, 0 18px 40px -20px rgba(0,0,0,0.95)',
    lg: '0 1px 0 rgba(255,255,255,0.05) inset, 0 28px 60px -24px rgba(0,0,0,0.95)',
    xl: '0 1px 0 rgba(255,255,255,0.06) inset, 0 40px 90px -30px rgba(0,0,0,0.95)',
  },
  other: {
    surface1: 'var(--surface-1)',
    surface2: 'var(--surface-2)',
    fontDisplay: 'var(--font-display)',
  },
  components: {
    Button: {
      defaultProps: {
        radius: 'md',
      },
      styles: {
        root: {
          fontWeight: 600,
          letterSpacing: '0.01em',
        },
      },
    },
    ActionIcon: {
      defaultProps: {
        radius: 'md',
      },
    },
    Card: {
      defaultProps: {
        radius: 'lg',
        p: 'lg',
      },
      styles: {
        root: {
          backgroundColor: 'var(--surface-1)',
          border: '1px solid var(--border-1)',
          boxShadow: 'var(--panel-shadow)',
        },
      },
    },
    Paper: {
      defaultProps: {
        radius: 'lg',
      },
      styles: {
        root: {
          backgroundColor: 'var(--surface-1)',
          border: '1px solid var(--border-1)',
        },
      },
    },
    Modal: {
      styles: {
        content: {
          backgroundColor: 'var(--surface-1)',
          border: '1px solid var(--border-2)',
        },
        header: {
          backgroundColor: 'transparent',
          borderBottom: '1px solid var(--border-1)',
        },
        title: {
          fontFamily: 'var(--font-heading)',
          fontWeight: 700,
        },
      },
    },
    ThemeIcon: {
      defaultProps: {
        radius: 'md',
        variant: 'light',
      },
    },
    Badge: {
      defaultProps: {
        radius: 'sm',
        variant: 'light',
      },
      styles: {
        root: {
          fontWeight: 700,
          letterSpacing: '0.03em',
          textTransform: 'uppercase',
          fontSize: '10px',
          fontFamily: 'var(--font-mono)',
        },
      },
    },
    Progress: {
      defaultProps: {
        radius: 'xl',
      },
      styles: {
        root: {
          backgroundColor: 'rgba(148,176,205,0.1)',
        },
      },
    },
    Table: {
      defaultProps: {
        striped: false,
        highlightOnHover: true,
        withTableBorder: false,
        verticalSpacing: 8,
      },
      styles: {
        th: {
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          fontSize: '10px',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'rgba(148,176,205,0.55)',
          borderBottom: '1px solid var(--border-2)',
          padding: '10px 12px',
        },
        td: {
          padding: '8px 12px',
          borderBottom: '1px solid rgba(148,176,205,0.06)',
        },
        tr: {
          transition: 'background-color 150ms ease',
        },
      },
    },
    Tabs: {
      styles: {
        list: {
          borderBottom: '1px solid var(--border-1)',
        },
        tab: {
          fontWeight: 600,
          fontSize: '13px',
          fontFamily: 'var(--font-heading)',
          transition: 'all 150ms ease',
        },
      },
    },
    TextInput: {
      styles: {
        input: {
          backgroundColor: 'var(--surface-2)',
          borderColor: 'var(--border-1)',
        },
        label: {
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'rgba(148,176,205,0.7)',
          marginBottom: 4,
        },
      },
    },
    Select: {
      styles: {
        input: {
          backgroundColor: 'var(--surface-2)',
          borderColor: 'var(--border-1)',
        },
        label: {
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'rgba(148,176,205,0.7)',
          marginBottom: 4,
        },
      },
    },
    NumberInput: {
      styles: {
        input: {
          fontFamily: 'var(--font-mono)',
          textAlign: 'right',
          backgroundColor: 'var(--surface-2)',
          borderColor: 'var(--border-1)',
        },
        label: {
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'rgba(148,176,205,0.7)',
          marginBottom: 4,
        },
      },
    },
    Alert: {
      styles: {
        root: {
          border: '1px solid var(--border-1)',
          borderLeft: '3px solid',
          borderRadius: '10px',
        },
        title: {
          fontFamily: 'var(--font-heading)',
          fontWeight: 700,
        },
      },
    },
    Tooltip: {
      styles: {
        tooltip: {
          backgroundColor: '#04070A',
          border: '1px solid var(--border-2)',
          color: '#C7D0DB',
          fontSize: '12px',
          fontWeight: 500,
        },
      },
    },
  },
});
