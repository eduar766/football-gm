import { useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Paper,
  SegmentedControl,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import {
  IconAlertTriangle,
  IconCalendarOff,
  IconCheck,
  IconCircleCheck,
  IconClipboardList,
  IconFlag,
  IconPlayerPlay,
  IconPlayerStop,
  IconScale,
  IconSparkles,
  IconTrophy,
  IconUsers,
  IconX,
} from '@tabler/icons-react';
import { api } from '../api';

interface MatchGoalScorer {
  minute: number;
  playerName: string;
  teamName: string;
}

interface MatchReport {
  matchday: number;
  homeTeamName: string;
  awayTeamName: string;
  homeGoals: number;
  awayGoals: number;
  yellowCount: number;
  redCount: number;
  goalscorers: MatchGoalScorer[];
}

interface ExtendedSummary {
  matchReports?: MatchReport[];
}

export function DashboardPage() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [division, setDivision] = useState(1);
  const [reviewMatchKey, setReviewMatchKey] = useState<string | null>(null);
  const [emergencyTeamId, setEmergencyTeamId] = useState<string | null>(null);
  const summary = useQuery({ queryKey: ['summary', id], queryFn: () => api.summary(id) });
  const phase = summary.data?.phase;
  const isPreseason = phase === 'pretemporada';

  const standings = useQuery({
    queryKey: ['standings', id, division],
    queryFn: () => api.standings(id, division),
    enabled: !isPreseason,
  });
  const nextFixtures = useQuery({
    queryKey: ['nextFixtures', id],
    queryFn: () => api.nextFixtures(id),
    enabled: !isPreseason,
  });
  const structure = useQuery({
    queryKey: ['structure', id],
    queryFn: () => api.structure(id),
    enabled: !isPreseason,
  });
  const cups = useQuery({
    queryKey: ['cups', id],
    queryFn: () => api.cups(id),
    enabled: !isPreseason,
  });

  const refresh = () =>
    qc.invalidateQueries({
      predicate: (q) =>
        [
          'summary',
          'standings',
          'history',
          'teams',
          'nextFixtures',
          'cups',
          'structure',
          'economy',
          'events',
        ].includes(q.queryKey[0] as string),
    });

  const handleSuccess = (message: string) => {
    notifications.show({
      color: 'green',
      icon: <IconCheck size={18} />,
      title: 'Éxito',
      message,
    });
    refresh();
  };

  const handleError = (error: Error) => {
    notifications.show({
      color: 'red',
      icon: <IconX size={18} />,
      title: 'Error',
      message: error.message,
    });
  };

  const mImpulse = useMutation({
    mutationFn: (v: { home: number; away: number; fav: number }) =>
      api.applyImpulse(id, v.home, v.away, v.fav),
    onSuccess: () => handleSuccess('Impulso aplicado'),
    onError: handleError,
  });

  const mStart = useMutation({
    mutationFn: () => api.startSeason(id),
    onSuccess: () => handleSuccess('Temporada comenzada'),
    onError: handleError,
  });

  const mAdvanceMd = useMutation({
    mutationFn: () => api.advanceMatchday(id),
    onSuccess: () => handleSuccess('Jornada avanzada'),
    onError: handleError,
  });

  const mAdvanceSeason = useMutation({
    mutationFn: () => api.advanceSeason(id),
    onSuccess: () => handleSuccess('Temporada avanzada'),
    onError: handleError,
  });

  const mClose = useMutation({
    mutationFn: () => api.closeSeason(id),
    onSuccess: () => handleSuccess('Temporada cerrada'),
    onError: handleError,
  });

  const mCallReview = useMutation({
    mutationFn: (v: { matchday: number; homeTeamId: number; awayTeamId: number }) =>
      api.callReview(id, v.matchday, v.homeTeamId, v.awayTeamId),
    onSuccess: () => handleSuccess('Revisión convocada'),
    onError: handleError,
  });

  const mEmergencyMeeting = useMutation({
    mutationFn: (teamId: number) => api.emergencyMeeting(id, teamId),
    onSuccess: () => handleSuccess('Reunión de emergencia convocada'),
    onError: handleError,
  });

  const mPostponeMatchday = useMutation({
    mutationFn: () => api.postponeMatchday(id),
    onSuccess: () => handleSuccess('Jornada pospuesta'),
    onError: handleError,
  });

  const over = summary.data?.seasonOver ?? false;
  const blocked = (summary.data?.pendingEventsCount ?? 0) > 0;
  const busy = mAdvanceMd.isPending || mAdvanceSeason.isPending || mClose.isPending || mCallReview.isPending || mEmergencyMeeting.isPending || mPostponeMatchday.isPending;

  return (
    <div className="page-enter">
      <Paper
        mb="md"
        p="xl"
        style={{
          background: 'linear-gradient(135deg, #111820 0%, #0D2818 100%)',
          border: '1px solid rgba(16,185,129,0.2)',
        }}
      >
        {isPreseason ? (
          <Stack>
            <Group justify="space-between" align="flex-start">
              <div>
                <Group gap="sm">
                  <Box
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: 'rgba(245,158,11,0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <IconSparkles size={20} color="#F59E0B" />
                  </Box>
                  <Text fw={700} size="lg">
                    Pretemporada · Año {summary.data?.year ?? '—'}
                  </Text>
                </Group>
                <Text size="sm" c="dimmed" ml={52}>
                  Monta la nueva temporada antes de que ruede el balón (§4.8).
                  Las copas, ligas juveniles y formato deben quedar decididos
                  aquí porque el calendario se construye al comenzar.
                </Text>
              </div>
              <Button
                size="lg"
                leftSection={<IconPlayerPlay size={18} />}
                onClick={() => mStart.mutate()}
                loading={mStart.isPending}
                variant="gradient"
                gradient={{ from: '#10B981', to: '#059669' }}
                style={{ height: 48 }}
              >
                Comenzar temporada
              </Button>
            </Group>

            <Stack gap={8} ml={52}>
              {[
                {
                  icon: <IconTrophy size={18} color="#F59E0B" />,
                  iconBg: 'rgba(245,158,11,0.15)',
                  title: 'Copas y ligas juveniles —',
                  desc: 'créalas en Copas; cualquier participante que añadas quedará incluido en el calendario.',
                  route: '/games/$gameId/cups',
                },
                {
                  icon: <IconCircleCheck size={18} color="#10B981" />,
                  iconBg: 'rgba(16,185,129,0.15)',
                  title: 'Estructura de la liga —',
                  desc: 'formato de liga (ida / ida y vuelta), liga de nivelación si tienes equipos pendientes, y creación de equipos propios.',
                  route: '/games/$gameId/structure',
                },
                {
                  icon: <IconSparkles size={18} color="#F59E0B" />,
                  iconBg: 'rgba(245,158,11,0.15)',
                  title: 'Economía y contratos —',
                  desc: 'firma patrocinios y revisa la inversión en talento.',
                  route: '/games/$gameId/economy',
                },
                {
                  icon: <IconTrophy size={18} color="#F59E0B" />,
                  iconBg: 'rgba(245,158,11,0.15)',
                  title: 'Premios por competición —',
                  desc: 'define la bolsa y el reparto para la liga y cada copa que organices.',
                  route: '/games/$gameId/prizes',
                },
                {
                  icon: <IconAlertTriangle size={18} color="#EF4444" />,
                  iconBg: 'rgba(239,68,68,0.15)',
                  title: 'Normas —',
                  desc: 'ajusta topes y mínimos competitivos que regirán la próxima temporada.',
                  route: '/games/$gameId/norms',
                },
                {
                  icon: <IconFlag size={18} color="#3B82F6" />,
                  iconBg: 'rgba(59,130,246,0.15)',
                  title: 'Fichajes —',
                  desc: 'revisa la ventana de movimientos que han firmado los clubes entre la temporada anterior y la próxima.',
                  route: '/games/$gameId/transfers',
                },
              ].map((item, i) => (
                <Group
                  key={item.route}
                  gap="md"
                  p="sm"
                  className="stagger-item"
                  style={{
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    animationDelay: `${i * 50}ms`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                  onClick={() => navigate({ to: item.route, params: { gameId } })}
                >
                  <Box
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: item.iconBg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {item.icon}
                  </Box>
                  <div>
                    <Text size="sm" fw={600}>
                      {item.title}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {item.desc}
                    </Text>
                  </div>
                </Group>
              ))}
            </Stack>
          </Stack>
        ) : (
          <>
            <Group>
              <Button
                size="lg"
                leftSection={<IconPlayerPlay size={18} />}
                onClick={() => mAdvanceMd.mutate()}
                disabled={over || busy || blocked}
                loading={mAdvanceMd.isPending}
                variant="gradient"
                gradient={{ from: '#10B981', to: '#059669' }}
                style={{ height: 48 }}
              >
                Avanzar jornada
              </Button>
              <Button
                variant="outline"
                leftSection={<IconSparkles size={16} />}
                onClick={() => mAdvanceSeason.mutate()}
                disabled={over || busy || blocked}
                loading={mAdvanceSeason.isPending}
                style={{ borderColor: '#10B981', color: '#10B981' }}
              >
                Avanzar temporada
              </Button>
              <Button
                color="red"
                variant="light"
                leftSection={<IconPlayerStop size={16} />}
                onClick={() =>
                  modals.openConfirmModal({
                    title: 'Cerrar temporada',
                    children: (
                      <Text size="sm">
                        Esto escribirá el historial permanente y comenzará la pretemporada
                        siguiente. ¿Estás seguro?
                      </Text>
                    ),
                    labels: { confirm: 'Cerrar temporada', cancel: 'Cancelar' },
                    confirmProps: { color: 'red' },
                    onConfirm: () => mClose.mutate(),
                  })
                }
                disabled={!over || busy}
                loading={mClose.isPending}
              >
                Cerrar temporada
              </Button>
            </Group>
            <Stack gap="xs" mt="md">
              <Group gap="xs" align="flex-end">
                <Select
                  label="Revisar partido"
                  placeholder="Selecciona un partido"
                  data={(() => {
                    const ext = summary.data as unknown as ExtendedSummary;
                    const reports = ext?.matchReports;
                    if (!reports || reports.length === 0) return [];
                    return reports.map((r) => ({
                      value: `${r.matchday}:${r.homeTeamName}:${r.awayTeamName}`,
                      label: `J${r.matchday} · ${r.homeTeamName} vs ${r.awayTeamName} (${r.homeGoals}-${r.awayGoals})`,
                    }));
                  })()}
                  value={reviewMatchKey}
                  onChange={setReviewMatchKey}
                  size="xs"
                  style={{ minWidth: 280 }}
                  disabled={over || busy || blocked || (nextFixtures.data?.impulsesRemaining ?? 0) <= 0 || phase !== 'temporada'}
                />
                <Button
                  variant="outline"
                  size="xs"
                  leftSection={<IconScale size={14} />}
                  onClick={() => {
                    if (!reviewMatchKey) return;
                    const ext = summary.data as unknown as ExtendedSummary;
                    const reports = ext?.matchReports ?? [];
                    const [mdStr, homeName, awayName] = reviewMatchKey.split(':');
                    const matchday = Number(mdStr);
                    const report = reports.find(
                      (r) => r.matchday === matchday && r.homeTeamName === homeName && r.awayTeamName === awayName,
                    );
                    if (!report) return;
                    const allTeams = (structure.data?.divisions ?? []).flatMap((d) => d.teams);
                    const homeTeam = allTeams.find((t) => t.name === report.homeTeamName);
                    const awayTeam = allTeams.find((t) => t.name === report.awayTeamName);
                    if (!homeTeam || !awayTeam) return;
                    mCallReview.mutate({ matchday, homeTeamId: homeTeam.teamId, awayTeamId: awayTeam.teamId });
                  }}
                  disabled={over || busy || blocked || !reviewMatchKey || (nextFixtures.data?.impulsesRemaining ?? 0) <= 0 || phase !== 'temporada'}
                  loading={mCallReview.isPending}
                  style={{ borderColor: '#F59E0B', color: '#F59E0B' }}
                >
                  Llamar a revisión
                </Button>
              </Group>
              <Group gap="xs" align="flex-end">
                <Select
                  label="Reunión de emergencia"
                  placeholder="Selecciona un equipo"
                  data={(structure.data?.divisions ?? []).flatMap((d) => d.teams).map((t) => ({
                    value: String(t.teamId),
                    label: t.name,
                  }))}
                  value={emergencyTeamId}
                  onChange={setEmergencyTeamId}
                  size="xs"
                  searchable
                  style={{ minWidth: 280 }}
                  disabled={over || busy || blocked || (nextFixtures.data?.impulsesRemaining ?? 0) <= 0 || phase !== 'temporada'}
                />
                <Button
                  variant="outline"
                  size="xs"
                  leftSection={<IconUsers size={14} />}
                  onClick={() => {
                    if (!emergencyTeamId) return;
                    mEmergencyMeeting.mutate(Number(emergencyTeamId));
                  }}
                  disabled={over || busy || blocked || !emergencyTeamId || (nextFixtures.data?.impulsesRemaining ?? 0) <= 0 || phase !== 'temporada'}
                  loading={mEmergencyMeeting.isPending}
                  style={{ borderColor: '#3B82F6', color: '#3B82F6' }}
                >
                  Reunión de emergencia
                </Button>
              </Group>
              <Button
                variant="outline"
                size="sm"
                leftSection={<IconCalendarOff size={14} />}
                onClick={() => mPostponeMatchday.mutate()}
                disabled={over || busy || blocked || (nextFixtures.data?.impulsesRemaining ?? 0) <= 0 || phase !== 'temporada'}
                loading={mPostponeMatchday.isPending}
                style={{ borderColor: '#8B5CF6', color: '#8B5CF6', alignSelf: 'flex-start' }}
              >
                Posponer jornada
              </Button>
            </Stack>
            {blocked && (
              <Alert color="orange" mt="md" icon={<IconAlertTriangle size={18} />} title="Polémica sin resolver">
                Hay {summary.data?.pendingEventsCount} evento(s) pendiente(s). Ve
                a la pestaña <strong>Eventos</strong> y resuélvelos para poder
                avanzar.
              </Alert>
            )}
            {!isPreseason && !over && standings.data && standings.data.rows.length >= 2 && (() => {
              const rows = standings.data!.rows;
              const leader = rows[0];
              const runnerUp = rows[1];
              const matchdaysLeft = (summary.data?.totalMatchdays ?? 0) - (summary.data?.currentMatchday ?? 0);
              const maxPointsLeft = matchdaysLeft * 3;
              const gap = leader.points - runnerUp.points;
              if (gap > maxPointsLeft) {
                return (
                  <Alert
                    color="gold"
                    mt="md"
                    icon={<IconTrophy size={18} />}
                    title="Campeón matemático"
                    styles={{ title: { color: '#F59E0B', fontWeight: 800 } }}
                  >
                    <Text size="sm">
                      <strong>{leader.name}</strong> es campeón matemático de la liga con {gap} puntos de ventaja.
                    </Text>
                  </Alert>
                );
              }
              return null;
            })()}
            {over && (
              <Alert color="yellow" mt="md" icon={<IconTrophy size={18} />} title="Temporada terminada">
                Revisa la clasificación final y cierra la temporada para escribir
                el historial y empezar el año siguiente (entrarás en
                pretemporada).
              </Alert>
            )}
          </>
        )}
      </Paper>

      {!isPreseason && !over && nextFixtures.data && (nextFixtures.data.fixtures.length > 0 || nextFixtures.data.cupRounds.length > 0) && (
        <Paper withBorder p="md" mb="md">
          <Group justify="space-between" mb="sm">
            <Text fw={700}>
              Próxima jornada · {nextFixtures.data.matchday}
            </Text>
            <Badge variant="light" color="grape" leftSection={<IconFlag size={12} />}>
              Impulsos {nextFixtures.data.impulsesRemaining}/{nextFixtures.data.impulsesPerSeason}
            </Badge>
          </Group>
          <Text size="xs" c="dimmed" mb="sm">
            El "dedo en la balanza" del comisionado: beneficia a un equipo en un
            partido concreto (§4.6).
          </Text>

          <Stack gap={6}>
            {nextFixtures.data.fixtures.map((f, i) => {
              const noImpulses = nextFixtures.data!.impulsesRemaining <= 0 && f.favoredTeamId == null;
              return (
                <Paper
                  key={`${f.homeTeamId}-${f.awayTeamId}`}
                  withBorder
                  p="sm"
                  radius="sm"
                  className="stagger-item"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    animationDelay: `${i * 50}ms`,
                  }}
                >
                  <Group justify="space-between" align="center">
                    <Group gap="md" style={{ flex: 1 }}>
                      <Text fw={600} size="sm" style={{ minWidth: 120, textAlign: 'right' }}>
                        {f.homeTeamName}
                      </Text>
                      <Text
                        size="xs"
                        c="dimmed"
                        style={{ fontFamily: '"Geist Mono", monospace' }}
                      >
                        vs
                      </Text>
                      <Text fw={600} size="sm" style={{ minWidth: 120 }}>
                        {f.awayTeamName}
                      </Text>
                    </Group>
                    <Group gap="xs">
                      <Tooltip label={`Impulsar a ${f.homeTeamName}`}>
                        <Button
                          size="compact-xs"
                          variant={f.favoredTeamId === f.homeTeamId ? 'filled' : 'light'}
                          color="grape"
                          leftSection={<IconFlag size={12} />}
                          disabled={busy || noImpulses || f.favoredTeamId != null}
                          onClick={() =>
                            mImpulse.mutate({
                              home: f.homeTeamId,
                              away: f.awayTeamId,
                              fav: f.homeTeamId,
                            })
                          }
                        >
                          {f.homeTeamName}
                        </Button>
                      </Tooltip>
                      <Tooltip label={`Impulsar a ${f.awayTeamName}`}>
                        <Button
                          size="compact-xs"
                          variant={f.favoredTeamId === f.awayTeamId ? 'filled' : 'light'}
                          color="grape"
                          leftSection={<IconFlag size={12} />}
                          disabled={busy || noImpulses || f.favoredTeamId != null}
                          onClick={() =>
                            mImpulse.mutate({
                              home: f.homeTeamId,
                              away: f.awayTeamId,
                              fav: f.awayTeamId,
                            })
                          }
                        >
                          {f.awayTeamName}
                        </Button>
                      </Tooltip>
                    </Group>
                  </Group>
                </Paper>
              );
            })}
          </Stack>

          {nextFixtures.data.cupRounds.length > 0 && (
            <Stack gap="xs" mt="md">
              <Text fw={600} size="sm" c="dimmed">
                Copas en esta jornada
              </Text>
              {nextFixtures.data.cupRounds.map((cr, i) => {
                const fullCup = (cups.data?.cups ?? []).find((c) => c.id === cr.cupId);
                return (
                <Paper key={cr.cupId} withBorder p="xs" radius="sm" className="stagger-item" style={{ animationDelay: `${i * 50}ms` }}>
                  <Group justify="space-between" mb={6}>
                    <Text fw={600} size="sm">
                      {cr.cupName}
                    </Text>
                    <Badge variant="light" color="orange" size="sm" leftSection={<IconTrophy size={10} />}>
                      {cr.cupFormato === 'liga' ? 'Liga' : `Ronda ${cr.roundNumero}`}
                    </Badge>
                  </Group>
                  {/* Mini-bracket: show all played rounds */}
                  {fullCup && fullCup.rounds.length > 1 && (
                    <Stack gap={4} mb={6}>
                      {fullCup.rounds.filter((r) => r.numero < cr.roundNumero).map((r) => {
                        const realMatches = r.matches.filter(
                          (m) => m.homeTeamName !== 'BYE' && m.awayTeamName !== 'BYE',
                        );
                        if (realMatches.length === 0) return null;
                        return (
                          <Group key={r.numero} gap={4}>
                            <Text size="xs" c="dimmed" style={{ fontFamily: '"Geist Mono", monospace', minWidth: 48 }}>
                              R{r.numero}
                            </Text>
                            {realMatches.map((m, j) => (
                              <Group key={j} gap={4}>
                                <Text
                                  size="xs"
                                  fw={m.winnerTeamId === m.homeTeamId ? 700 : 400}
                                  style={{
                                    color: m.winnerTeamId === m.homeTeamId ? '#10B981' : undefined,
                                    textDecoration: m.winnerTeamId === m.awayTeamId ? 'line-through' : undefined,
                                    opacity: m.winnerTeamId === m.awayTeamId ? 0.5 : 1,
                                  }}
                                >
                                  {m.homeTeamName}
                                </Text>
                                <Text size="xs" c="dimmed" style={{ fontFamily: '"Geist Mono", monospace' }}>
                                  {m.homeGoals}-{m.awayGoals}
                                </Text>
                                <Text
                                  size="xs"
                                  fw={m.winnerTeamId === m.awayTeamId ? 700 : 400}
                                  style={{
                                    color: m.winnerTeamId === m.awayTeamId ? '#10B981' : undefined,
                                    textDecoration: m.winnerTeamId === m.homeTeamId ? 'line-through' : undefined,
                                    opacity: m.winnerTeamId === m.homeTeamId ? 0.5 : 1,
                                  }}
                                >
                                  {m.awayTeamName}
                                </Text>
                              </Group>
                            ))}
                          </Group>
                        );
                      })}
                    </Stack>
                  )}
                  {/* Current round matches */}
                  {!cr.matchesKnown ? (
                    <Text size="xs" c="dimmed">
                      Emparejamientos pendientes hasta resolver la ronda previa.
                    </Text>
                  ) : (() => {
                    const realMatches = cr.matches.filter(
                      (m) => m.homeTeamName !== 'BYE' && m.awayTeamName !== 'BYE',
                    );
                    if (realMatches.length === 0) return null;
                    return (
                    <Table>
                      <Table.Tbody>
                        {realMatches.map((m, j) => (
                          <Table.Tr key={`${cr.cupId}-${cr.roundNumero}-${j}`}>
                            <Table.Td>
                              {m.homeTeamName}{' '}
                              <Text span c="dimmed" size="xs">
                                vs
                              </Text>{' '}
                              {m.awayTeamName}
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                    );
                  })()}
                </Paper>
                );
              })}
            </Stack>
          )}
        </Paper>
      )}

      {!isPreseason && !over && summary.data && summary.data.currentMatchday > 0 && (() => {
        const ext = summary.data as unknown as ExtendedSummary;
        const reports = ext.matchReports;
        if (!reports || !Array.isArray(reports)) return null;
        const matchdayReports = reports.filter((r) => r.matchday === summary.data!.currentMatchday);
        if (matchdayReports.length === 0) return null;
        return (
          <Paper withBorder p="md" mb="md">
            <Text fw={700} mb="sm">
              Informes de partido · Jornada {summary.data.currentMatchday}
            </Text>
            <Stack gap="xs">
              {matchdayReports.map((report, i) => (
                <Paper
                  key={i}
                  withBorder
                  p="sm"
                  radius="sm"
                  style={{ background: 'rgba(255,255,255,0.02)' }}
                >
                  <Group justify="space-between" align="center" mb="xs">
                    <Group gap="md" style={{ flex: 1 }}>
                      <Text fw={600} size="sm" style={{ minWidth: 120, textAlign: 'right' }}>
                        {report.homeTeamName ?? '—'}
                      </Text>
                      <Text
                        fw={800}
                        size="lg"
                        style={{ fontFamily: '"Geist Mono", monospace', minWidth: 60, textAlign: 'center' }}
                      >
                        {report.homeGoals ?? 0} - {report.awayGoals ?? 0}
                      </Text>
                      <Text fw={600} size="sm" style={{ minWidth: 120 }}>
                        {report.awayTeamName ?? '—'}
                      </Text>
                    </Group>
                    <Group gap="xs">
                      {report.yellowCount != null && report.yellowCount > 0 && (
                        <Group gap={4} align="center">
                          <Box style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#F59E0B' }} />
                          <Text size="xs" style={{ fontFamily: '"Geist Mono", monospace' }}>{report.yellowCount}</Text>
                        </Group>
                      )}
                      {report.redCount != null && report.redCount > 0 && (
                        <Group gap={4} align="center">
                          <Box style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#EF4444' }} />
                          <Text size="xs" style={{ fontFamily: '"Geist Mono", monospace' }}>{report.redCount}</Text>
                        </Group>
                      )}
                    </Group>
                  </Group>
                  {report.goalscorers && report.goalscorers.length > 0 && (
                    <Stack gap={2} ml="md">
                      {report.goalscorers.map((g, j) => (
                        <Text key={j} size="xs" c="dimmed">
                          {g.minute}' {g.playerName} ({g.teamName})
                        </Text>
                      ))}
                    </Stack>
                  )}
                </Paper>
              ))}
            </Stack>
          </Paper>
        );
      })()}

      {isPreseason ? (
        <Paper withBorder p="md">
          <Group gap="sm" mb={4}>
            <IconClipboardList size={20} color="var(--mantine-color-dimmed)" />
            <Text fw={700}>Sin clasificación</Text>
          </Group>
          <Text size="xs" c="dimmed" ml={28}>
            Estás en pretemporada. Al pulsar <strong>Comenzar temporada</strong>{' '}
            se construirá el calendario y aparecerá la tabla.
          </Text>
        </Paper>
      ) : (
        <Paper withBorder p="md">
          <Group justify="space-between" mb="sm">
            <Text fw={700}>
              {standings.data?.divisionName ?? 'Clasificación'} · Temporada{' '}
              {standings.data?.year ?? summary.data?.year ?? '—'}
            </Text>
            {standings.data && standings.data.availableDivisions.length > 1 && (
              <SegmentedControl
                size="xs"
                value={String(division)}
                onChange={(v) => setDivision(Number(v))}
                data={standings.data.availableDivisions.map((d) => ({
                  label: d.name,
                  value: String(d.orden),
                }))}
              />
            )}
          </Group>
          {standings.isLoading ? (
            <Stack>
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} height={32} />
              ))}
            </Stack>
          ) : (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>#</Table.Th>
                  <Table.Th>Equipo</Table.Th>
                  <Tooltip label="Partidos Jugados" position="bottom" withArrow>
                    <Table.Th ta="right">PJ</Table.Th>
                  </Tooltip>
                  <Tooltip label="Ganados" position="bottom" withArrow>
                    <Table.Th ta="right">G</Table.Th>
                  </Tooltip>
                  <Tooltip label="Empatados" position="bottom" withArrow>
                    <Table.Th ta="right">E</Table.Th>
                  </Tooltip>
                  <Tooltip label="Perdidos" position="bottom" withArrow>
                    <Table.Th ta="right">P</Table.Th>
                  </Tooltip>
                  <Tooltip label="Goles a Favor" position="bottom" withArrow>
                    <Table.Th ta="right">GF</Table.Th>
                  </Tooltip>
                  <Tooltip label="Goles en Contra" position="bottom" withArrow>
                    <Table.Th ta="right">GC</Table.Th>
                  </Tooltip>
                  <Tooltip label="Diferencia de Goles" position="bottom" withArrow>
                    <Table.Th ta="right">DG</Table.Th>
                  </Tooltip>
                  <Tooltip label="Puntos" position="bottom" withArrow>
                    <Table.Th ta="right">Pts</Table.Th>
                  </Tooltip>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {standings.data?.rows.map((r, i) => {
                  const pos = i + 1;
                  const isTop3 = pos <= 3;
                  const posColors: Record<number, { bg: string; text: string }> = {
                    1: { bg: '#F59E0B', text: '#fff' },
                    2: { bg: '#9CA3AF', text: '#fff' },
                    3: { bg: '#D97706', text: '#fff' },
                  };
                  return (
                    <Table.Tr
                      key={r.teamId}
                      className="stagger-item"
                      style={{
                        borderLeft: isTop3 ? '3px solid #10B981' : '3px solid transparent',
                        transition: 'border-color 0.15s',
                        animationDelay: `${i * 50}ms`,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderLeftColor = '#10B981';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderLeftColor = isTop3
                          ? '#10B981'
                          : 'transparent';
                      }}
                    >
                      <Table.Td>
                        {isTop3 ? (
                          <Box
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: '50%',
                              background: posColors[pos].bg,
                              color: posColors[pos].text,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {pos}
                          </Box>
                        ) : (
                          pos
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Link
                          to="/games/$gameId/teams/$teamId"
                          params={{ gameId, teamId: String(r.teamId) }}
                        >
                          <Text fw={isTop3 ? 600 : 400}>{r.name}</Text>
                        </Link>
                      </Table.Td>
                      <Table.Td ta="right">{r.played}</Table.Td>
                      <Table.Td ta="right">{r.won}</Table.Td>
                      <Table.Td ta="right">{r.drawn}</Table.Td>
                      <Table.Td ta="right">{r.lost}</Table.Td>
                      <Table.Td ta="right">{r.goalsFor}</Table.Td>
                      <Table.Td ta="right">{r.goalsAgainst}</Table.Td>
                      <Table.Td
                        ta="right"
                        style={{
                          color:
                            r.goalDiff > 0
                              ? '#10B981'
                              : r.goalDiff < 0
                                ? '#EF4444'
                                : undefined,
                        }}
                      >
                        {r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}
                      </Table.Td>
                      <Table.Td
                        ta="right"
                        style={{
                          fontWeight: 800,
                          fontSize: '1.05em',
                          borderLeft: isTop3
                            ? '3px solid rgba(16,185,129,0.3)'
                            : '3px solid transparent',
                          paddingLeft: isTop3 ? 10 : 13,
                        }}
                      >
                        {r.points}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}
        </Paper>
      )}
    </div>
  );
}
