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
    dark: [
      '#C1C2C5',
      '#A6A7AB',
      '#909296',
      '#5c5f66',
      '#373A40',
      '#2C2E33',
      '#1A2332',
      '#111820',
      '#0B0F14',
      '#070A0E',
    ],
  },
  fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, sans-serif',
  fontFamilyMonospace: '"Geist Mono", "SF Mono", "Fira Code", monospace',
  headings: {
    fontFamily: '"Plus Jakarta Sans", sans-serif',
    fontWeight: '700',
    sizes: {
      h1: { fontSize: '36px', lineHeight: '1.2', fontWeight: '800' },
      h2: { fontSize: '28px', lineHeight: '1.25', fontWeight: '700' },
      h3: { fontSize: '22px', lineHeight: '1.3', fontWeight: '700' },
      h4: { fontSize: '18px', lineHeight: '1.35', fontWeight: '600' },
      h5: { fontSize: '16px', lineHeight: '1.4', fontWeight: '600' },
      h6: { fontSize: '14px', lineHeight: '1.4', fontWeight: '600' },
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
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
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
  components: {
    Button: {
      defaultProps: {
        radius: 'lg',
      },
      styles: {
        root: {
          fontWeight: 600,
          transition: 'all 250ms ease',
          '&:hover': {
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          },
        },
      },
    },
    Card: {
      defaultProps: {
        radius: 'lg',
        p: 'lg',
      },
      styles: {
        root: {
          backgroundColor: '#111820',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          transition: 'all 250ms ease',
        },
      },
    },
    Paper: {
      defaultProps: {
        radius: 'lg',
      },
      styles: {
        root: {
          backgroundColor: '#111820',
          border: '1px solid rgba(255,255,255,0.06)',
        },
      },
    },
    Badge: {
      defaultProps: {
        radius: 'xl',
        variant: 'light',
      },
      styles: {
        root: {
          fontWeight: 600,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          fontSize: '11px',
        },
      },
    },
    Table: {
      defaultProps: {
        striped: true,
        highlightOnHover: true,
        withTableBorder: false,
      },
      styles: {
        th: {
          fontFamily: '"DM Sans", sans-serif',
          fontWeight: 600,
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: '#5A6A7A',
          borderBottom: '2px solid rgba(255,255,255,0.08)',
          padding: '8px 12px',
        },
        td: {
          padding: '6px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        },
        tr: {
          transition: 'background-color 150ms ease',
        },
      },
    },
    Tabs: {
      styles: {
        list: {
          borderBottom: '2px solid rgba(255,255,255,0.06)',
        },
        tab: {
          fontWeight: 500,
          fontSize: '13px',
          transition: 'all 150ms ease',
          '&[data-active]': {
            borderBottom: '2px solid #10B981',
            marginBottom: '-2px',
          },
        },
      },
    },
    TextInput: {
      styles: {
        input: {
          fontFamily: '"DM Sans", sans-serif',
        },
      },
    },
    NumberInput: {
      styles: {
        input: {
          fontFamily: '"Geist Mono", monospace',
          textAlign: 'right',
        },
      },
    },
    Alert: {
      styles: {
        root: {
          border: 'none',
          borderLeft: '4px solid',
          borderRadius: '8px',
        },
      },
    },
  },
});
