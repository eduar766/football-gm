import { Box, Group, Paper, Text, type PaperProps } from '@mantine/core';
import type { TablerIcon } from '@tabler/icons-react';

/**
 * Panel — the shared card/section chrome used across the app.
 * Exposed as `SectionCard` (backward compatible) and `Panel`.
 */
export function SectionCard({
  title,
  icon: Icon,
  iconColor = '#10B981',
  actions,
  bodyProps,
  children,
  ...paperProps
}: {
  title?: React.ReactNode;
  icon?: TablerIcon;
  iconColor?: string;
  actions?: React.ReactNode;
  bodyProps?: React.ComponentProps<typeof Box>;
  children: React.ReactNode;
} & Omit<PaperProps, 'title' | 'children'>) {
  return (
    <Paper p="lg" {...paperProps}>
      {(title || actions) && (
        <Group justify="space-between" align="center" mb="md" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            {Icon && (
              <Box
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `${iconColor}18`,
                  border: `1px solid ${iconColor}33`,
                  flexShrink: 0,
                }}
              >
                <Icon size={16} color={iconColor} stroke={1.9} />
              </Box>
            )}
            {title && (
              <Text
                fw={700}
                style={{ fontFamily: 'var(--font-heading)', fontSize: 15 }}
              >
                {title}
              </Text>
            )}
          </Group>
          {actions}
        </Group>
      )}
      <Box {...bodyProps}>{children}</Box>
    </Paper>
  );
}

export const Panel = SectionCard;
