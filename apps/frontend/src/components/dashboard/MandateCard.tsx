import { Alert, Badge, Group, Paper, Progress, Text } from '@mantine/core';
import { IconAlertTriangle, IconClipboardCheck } from '@tabler/icons-react';
import type { BoardMandateDto } from '@football-gm/contracts';

export function MandateCard({
  mandate,
  consecutiveFails,
  federationPrestige,
  impulsesPerSeason,
}: {
  mandate: BoardMandateDto;
  consecutiveFails: number;
  federationPrestige: number;
  impulsesPerSeason: number;
}) {
  const m = mandate;
  const fails = consecutiveFails;
  const statusColor = m.met === true ? '#10B981' : m.met === false ? '#EF4444' : '#F59E0B';
  const statusLabel = m.met === true ? 'Cumplido' : m.met === false ? 'Fallido' : 'En curso';

  let progress = 0;
  let progressLabel = '';
  if (m.type === 'prestige_min') {
    progress = m.target > 0 ? Math.min(100, Math.round((federationPrestige / m.target) * 100)) : 100;
    progressLabel = `${federationPrestige} / ${m.target} prestigio`;
  } else if (m.type === 'team_count') {
    progressLabel = `Objetivo: ${m.target} equipos`;
    progress = 50;
  } else if (m.type === 'positive_balance') {
    progressLabel = 'Balance al cierre de temporada';
    progress = m.met === true ? 100 : m.met === false ? 0 : 50;
  }

  return (
    <Paper withBorder p="md" style={{ borderColor: statusColor + '40', background: statusColor + '08' }}>
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <IconClipboardCheck size={16} color={statusColor} />
          <Text fw={700} size="sm">Mandato del consejo</Text>
        </Group>
        <Badge size="xs" style={{ background: statusColor + '20', color: statusColor }}>
          {statusLabel}
        </Badge>
      </Group>
      <Text size="sm" mb="xs" c="dimmed">{m.description}</Text>
      {m.met === null && (
        <Progress value={progress} color={progress >= 100 ? 'green' : 'yellow'} size="sm" mb="xs" />
      )}
      {progressLabel && m.met === null && (
        <Text size="xs" c="dimmed">{progressLabel}</Text>
      )}
      {fails === 1 && m.met === null && (
        <Alert color="orange" variant="light" p="xs" mt="xs" icon={<IconAlertTriangle size={14} />}>
          <Text size="xs">1 fallo consecutivo — el próximo fallo reducirá los impulsos permanentemente</Text>
        </Alert>
      )}
      {m.met === false && fails === 0 && impulsesPerSeason < 3 && (
        <Alert color="red" variant="light" p="xs" mt="xs" icon={<IconAlertTriangle size={14} />}>
          <Text size="xs">Mandato fallido. Impulsos reducidos a {impulsesPerSeason}/temporada</Text>
        </Alert>
      )}
    </Paper>
  );
}
