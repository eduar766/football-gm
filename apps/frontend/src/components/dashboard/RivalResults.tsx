import { Box, Group, Paper, Stack, Text, useMantineTheme } from '@mantine/core';
import { IconWorld } from '@tabler/icons-react';
import type { RivalMatchResultDto } from '@football-gm/contracts';

export function RivalResults({ results }: { results: RivalMatchResultDto[] }) {
  const theme = useMantineTheme();
  if (!results || results.length === 0) return null;

  const byFed = new Map<string, RivalMatchResultDto[]>();
  for (const r of results) {
    const key = r.federationName || `Fed ${r.federationId}`;
    const arr = byFed.get(key) ?? [];
    arr.push(r);
    byFed.set(key, arr);
  }

  return (
    <Paper withBorder p="md">
      <Group gap="xs" mb="sm">
        <IconWorld size={16} color="#3B82F6" />
        <Text fw={700} size="sm">Jornada en Europa</Text>
        <Text size="xs" c="dimmed" style={{ fontFamily: theme.fontFamilyMonospace }}>
          J{results[0]?.matchday}
        </Text>
      </Group>
      <Stack gap={8}>
        {[...byFed.entries()].map(([fedName, fedResults]) => (
          <Box key={fedName}>
            <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb={4}
              style={{ letterSpacing: '0.05em', fontSize: 10 }}>
              {fedName}
            </Text>
            <Stack gap={2}>
              {fedResults.map((r, i) => (
                <Group key={i} justify="space-between" wrap="nowrap"
                  style={{ padding: '2px 6px', borderRadius: 4,
                    background: r.isShock ? 'rgba(245,158,11,0.06)' : 'transparent' }}>
                  <Text size="xs" style={{ flex: 1, textAlign: 'right' }}
                    fw={r.homeGoals > r.awayGoals ? 700 : 400}>
                    {r.homeName}
                  </Text>
                  <Text size="xs" fw={700} mx={6}
                    style={{ fontFamily: theme.fontFamilyMonospace,
                      color: r.isShock ? '#F59E0B' : 'rgba(255,255,255,0.7)',
                      minWidth: 36, textAlign: 'center' }}>
                    {r.homeGoals}–{r.awayGoals}
                  </Text>
                  <Text size="xs" style={{ flex: 1 }}
                    fw={r.awayGoals > r.homeGoals ? 700 : 400}>
                    {r.awayName}
                  </Text>
                  {r.isShock && (
                    <Text size="xs" c="yellow.5" style={{ flexShrink: 0 }}>!</Text>
                  )}
                </Group>
              ))}
            </Stack>
          </Box>
        ))}
      </Stack>
    </Paper>
  );
}
