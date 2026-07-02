import { Box, Stack, Text } from '@mantine/core';
import type { TablerIcon } from '@tabler/icons-react';

interface EmptyStateProps {
  icon: TablerIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  color?: string;
}

/** EmptyState — consistent "no data yet" panel with an iconic focal point. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  color = '#5A6675',
}: EmptyStateProps) {
  return (
    <Stack align="center" gap="sm" py={40} px="md">
      <Box
        style={{
          width: 60,
          height: 60,
          borderRadius: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `${color}14`,
          border: `1px solid ${color}30`,
        }}
      >
        <Icon size={28} color={color} stroke={1.6} />
      </Box>
      <Text fw={700} style={{ fontFamily: 'var(--font-heading)' }}>
        {title}
      </Text>
      {description && (
        <Text size="sm" c="dimmed" ta="center" maw={420}>
          {description}
        </Text>
      )}
      {action}
    </Stack>
  );
}
