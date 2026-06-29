import { Group, Paper, Text } from '@mantine/core';
import type { TablerIcon } from '@tabler/icons-react';

interface PageHeroProps {
  icon: TablerIcon;
  iconColor?: string;
  title: string;
  subtitle?: React.ReactNode;
}

export function PageHero({ icon: Icon, iconColor = '#10B981', title, subtitle }: PageHeroProps) {
  return (
    <Paper
      p="xl"
      mb="md"
      style={{
        background: 'linear-gradient(135deg, #111820 0%, #0D2818 100%)',
        border: '1px solid rgba(16,185,129,0.2)',
      }}
    >
      <Group gap="sm">
        <Icon size={22} color={iconColor} />
        <Text
          fw={800}
          style={{
            fontFamily: '"Plus Jakarta Sans", sans-serif',
            fontSize: '28px',
            color: '#F9FAFB',
          }}
        >
          {title}
        </Text>
      </Group>
      {subtitle && (
        <Text size="sm" c="dimmed" mt="xs" ml={34}>
          {subtitle}
        </Text>
      )}
    </Paper>
  );
}
