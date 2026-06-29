import { Box, Group, Paper, Stack, Text, useMantineTheme } from '@mantine/core';
import type { MatchReportDto } from '@football-gm/contracts';

export function MatchReports({
  matchday,
  reports,
}: {
  matchday: number;
  reports: MatchReportDto[];
}) {
  const theme = useMantineTheme();
  if (!reports || reports.length === 0) return null;
  return (
    <Paper withBorder p="md">
      <Text fw={700} mb="sm">Resultados · Jornada {matchday}</Text>
      <Stack gap="xs">
        {reports.map((report, i) => (
          <Paper key={i} withBorder p="sm" radius="sm" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <Group justify="space-between" align="center" mb={report.goalscorers?.length ? 'xs' : 0}>
              <Group gap="sm" style={{ flex: 1 }}>
                <Text fw={600} size="sm" style={{ minWidth: 90, textAlign: 'right' }}>{report.homeTeamName ?? '—'}</Text>
                <Text fw={800} size="lg" style={{ fontFamily: theme.fontFamilyMonospace, minWidth: 50, textAlign: 'center' }}>
                  {report.homeGoals ?? 0}–{report.awayGoals ?? 0}
                </Text>
                <Text fw={600} size="sm" style={{ minWidth: 90 }}>{report.awayTeamName ?? '—'}</Text>
              </Group>
              <Group gap={4}>
                {(report.yellowCount ?? 0) > 0 && (
                  <Group gap={2}><Box style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#F59E0B' }} /><Text size="xs">{report.yellowCount}</Text></Group>
                )}
                {(report.redCount ?? 0) > 0 && (
                  <Group gap={2}><Box style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#EF4444' }} /><Text size="xs">{report.redCount}</Text></Group>
                )}
              </Group>
            </Group>
            {report.goalscorers && report.goalscorers.length > 0 && (
              <Stack gap={2} ml="sm">
                {report.goalscorers.map((g, j) => (
                  <Text key={j} size="xs" c="dimmed">{g.minute}' {g.playerName} ({g.teamName})</Text>
                ))}
              </Stack>
            )}
          </Paper>
        ))}
      </Stack>
    </Paper>
  );
}
