import { Box, Group, Paper, Stack, Text } from '@mantine/core';
import { IconNews } from '@tabler/icons-react';
import type { HeadlineDto } from '@football-gm/contracts';

const HEADLINE_COLORS: Record<string, string> = {
  goleada: '#F59E0B',
  sorpresa: '#10B981',
  racha_victorias: '#3B82F6',
};

export function HeadlinesFeed({ headlines }: { headlines: HeadlineDto[] }) {
  if (!headlines || headlines.length === 0) return null;
  return (
    <Paper withBorder p="md">
      <Group gap="xs" mb="sm">
        <IconNews size={16} color="#94A3B8" />
        <Text fw={700} size="sm">Titulares</Text>
      </Group>
      <Stack gap={6}>
        {headlines.map((h, i) => {
          const color = HEADLINE_COLORS[h.type] ?? '#EF4444';
          return (
            <Group key={i} gap="xs" align="flex-start">
              <Box style={{ width: 6, height: 6, borderRadius: '50%', background: color, marginTop: 6, flexShrink: 0 }} />
              <Text size="xs">{h.text}</Text>
            </Group>
          );
        })}
      </Stack>
    </Paper>
  );
}
