import { Box, Group, Paper, Stack, Text } from '@mantine/core';
import { IconGlobe, IconNews } from '@tabler/icons-react';
import type { HeadlineDto } from '@football-gm/contracts';

const HEADLINE_COLORS: Record<string, string> = {
  goleada: '#F59E0B',
  sorpresa: '#10B981',
  racha_victorias: '#3B82F6',
};

export function HeadlinesFeed({ headlines }: { headlines: HeadlineDto[] }) {
  if (!headlines || headlines.length === 0) return null;

  const own = headlines.filter(h => !h.isRival);
  const rival = headlines.filter(h => h.isRival);

  return (
    <Paper withBorder p="md">
      <Group gap="xs" mb="sm">
        <IconNews size={16} color="#94A3B8" />
        <Text fw={700} size="sm">Titulares</Text>
      </Group>
      <Stack gap={6}>
        {own.map((h, i) => {
          const color = HEADLINE_COLORS[h.type] ?? '#EF4444';
          return (
            <Group key={`own-${i}`} gap="xs" align="flex-start">
              <Box style={{ width: 6, height: 6, borderRadius: '50%', background: color, marginTop: 6, flexShrink: 0 }} />
              <Text size="xs">{h.text}</Text>
            </Group>
          );
        })}
        {rival.length > 0 && (
          <>
            {own.length > 0 && <Box style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '4px 0' }} />}
            <Group gap="xs" mb={2}>
              <IconGlobe size={11} color="#6B7280" />
              <Text size="xs" c="dimmed" fw={600} tt="uppercase" style={{ letterSpacing: '0.05em', fontSize: '10px' }}>Mundo</Text>
            </Group>
            {rival.map((h, i) => {
              const color = HEADLINE_COLORS[h.type] ?? '#6B7280';
              return (
                <Group key={`rival-${i}`} gap="xs" align="flex-start">
                  <Box style={{ width: 6, height: 6, borderRadius: '50%', background: color, opacity: 0.6, marginTop: 6, flexShrink: 0 }} />
                  <Text size="xs" c="dimmed">{h.text}</Text>
                </Group>
              );
            })}
          </>
        )}
      </Stack>
    </Paper>
  );
}
