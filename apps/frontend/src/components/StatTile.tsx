import { Box, Group, Text } from '@mantine/core';
import type { TablerIcon } from '@tabler/icons-react';

interface StatTileProps {
  label: string;
  value: React.ReactNode;
  icon?: TablerIcon;
  color?: string;
  hint?: React.ReactNode;
  align?: 'left' | 'center';
}

/**
 * StatTile — a HUD readout cell: mono label, big display value, optional icon glow.
 * Used for stat rows / dashboards to keep numeric telemetry consistent.
 */
export function StatTile({
  label,
  value,
  icon: Icon,
  color = '#10B981',
  hint,
  align = 'left',
}: StatTileProps) {
  return (
    <Box
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 12,
        padding: '14px 16px',
        background: 'var(--surface-2)',
        border: '1px solid var(--border-1)',
        textAlign: align,
      }}
    >
      <Group
        gap={8}
        justify={align === 'center' ? 'center' : 'flex-start'}
        mb={6}
        wrap="nowrap"
      >
        {Icon && <Icon size={14} color={color} stroke={2} />}
        <Text
          component="span"
          className="hud-eyebrow"
          style={{ letterSpacing: '0.12em' }}
        >
          {label}
        </Text>
      </Group>
      <Text
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 26,
          fontWeight: 700,
          lineHeight: 1,
          color,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </Text>
      {hint && (
        <Text size="xs" c="dimmed" mt={4}>
          {hint}
        </Text>
      )}
    </Box>
  );
}
