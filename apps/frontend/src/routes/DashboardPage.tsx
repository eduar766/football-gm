import { useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Grid,
  Group,
  Paper,
  Progress,
  Select,
  Stack,
  Table,
  Text,
  Tooltip,
  useMantineTheme,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { modals } from '@mantine/modals';
import { useNavigate, useParams } from '@tanstack/react-router';
import {
  IconAlertTriangle,
  IconCalendarOff,
  IconCircleCheck,
  IconCircleX,
  IconClipboardList,
  IconFlag,
  IconPlayerPlay,
  IconPlayerStop,
  IconScale,
  IconSparkles,
  IconStar,
  IconTrophy,
  IconUsers,
} from '@tabler/icons-react';
import type { SeasonReportDto } from '@football-gm/contracts';
import { api } from '../api';
import { useMutationWithFeedback } from '../useMutationWithFeedback';
import { QK } from '../query-keys';
import { StandingsTable } from '../components/dashboard/StandingsTable';
import { MandateCard } from '../components/dashboard/MandateCard';
import { HeadlinesFeed } from '../components/dashboard/HeadlinesFeed';
import { MatchReports } from '../components/dashboard/MatchReports';
import { RivalResults } from '../components/dashboard/RivalResults';
import { SeasonNewspaper } from '../components/SeasonNewspaper';
import { DeskPanel } from '../components/dashboard/DeskPanel';

export function DashboardPage() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);
  const navigate = useNavigate();
  const theme = useMantineTheme();

  const [division, setDivision] = useState(1);
  const [reviewMatchKey, setReviewMatchKey] = useState<string | null>(null);
  const [emergencyTeamId, setEmergencyTeamId] = useState<string | null>(null);
  const [newspaperOpen, setNewspaperOpen] = useState(false);
  const [newspaperReport, setNewspaperReport] = useState<SeasonReportDto | null>(null);
  const summary = useQuery({ queryKey: QK.summary(id), queryFn: () => api.summary(id) });
  const phase = summary.data?.phase;
  const isPreseason = phase === 'pretemporada';

  const standings = useQuery({
    queryKey: QK.standings(id, division),
    queryFn: () => api.standings(id, division),
    enabled: !isPreseason,
  });
  const nextFixtures = useQuery({
    queryKey: QK.nextFixtures(id),
    queryFn: () => api.nextFixtures(id),
    enabled: !isPreseason,
  });
  const structure = useQuery({
    queryKey: QK.structure(id),
    queryFn: () => api.structure(id),
    enabled: !isPreseason,
  });
  const cups = useQuery({
    queryKey: QK.cups(id),
    queryFn: () => api.cups(id),
    enabled: !isPreseason,
  });
  const preseason = useQuery({
    queryKey: QK.preseason(id),
    queryFn: () => api.preseasonChecklist(id),
    enabled: isPreseason,
  });
  const preseasonReady = preseason.data?.ready ?? true;
  const pendingBlockers = (preseason.data?.items ?? []).filter((i) => i.blocking && !i.done);

  const REFRESH_KEYS = ['summary', 'standings', 'history', 'teams', 'nextFixtures', 'cups', 'structure', 'economy', 'events', 'preseason'];

  const mImpulse = useMutationWithFeedback({
    mutationFn: (v: { home: number; away: number; fav: number }) =>
      api.applyImpulse(id, v.home, v.away, v.fav),
    queryKeyToInvalidate: REFRESH_KEYS,
    successMessage: 'Impulso aplicado',
  });

  const mStart = useMutationWithFeedback({
    mutationFn: () => api.startSeason(id),
    queryKeyToInvalidate: REFRESH_KEYS,
    successMessage: 'Temporada comenzada',
  });

  const mAdvanceMd = useMutationWithFeedback({
    mutationFn: () => api.advanceMatchday(id),
    queryKeyToInvalidate: REFRESH_KEYS,
    successMessage: 'Jornada avanzada',
  });

  const mAdvanceSeason = useMutationWithFeedback({
    mutationFn: () => api.advanceSeason(id),
    queryKeyToInvalidate: REFRESH_KEYS,
    successMessage: 'Temporada avanzada',
  });

  const mClose = useMutationWithFeedback({
    mutationFn: () => api.closeSeason(id),
    queryKeyToInvalidate: REFRESH_KEYS,
    successMessage: 'Temporada cerrada',
    onSuccess: (data) => {
      if (data.lastSeasonReport) {
        setNewspaperReport(data.lastSeasonReport);
        setNewspaperOpen(true);
      }
    },
  });

  const mCallReview = useMutationWithFeedback({
    mutationFn: (v: { matchday: number; homeTeamId: number; awayTeamId: number }) =>
      api.callReview(id, v.matchday, v.homeTeamId, v.awayTeamId),
    queryKeyToInvalidate: REFRESH_KEYS,
    successMessage: 'Revisión convocada',
  });

  const mEmergencyMeeting = useMutationWithFeedback({
    mutationFn: (teamId: number) => api.emergencyMeeting(id, teamId),
    queryKeyToInvalidate: REFRESH_KEYS,
    successMessage: 'Reunión de emergencia convocada',
  });

  const mPostponeMatchday = useMutationWithFeedback({
    mutationFn: () => api.postponeMatchday(id),
    queryKeyToInvalidate: REFRESH_KEYS,
    successMessage: 'Jornada pospuesta',
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
          position: 'relative',
          overflow: 'hidden',
          background:
            'linear-gradient(135deg, var(--surface-1) 0%, #0c141a 55%, #0b1512 100%)',
          border: '1px solid var(--border-1)',
          boxShadow: 'var(--panel-shadow)',
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
                  Monta la nueva temporada antes de que ruede el balón.
                  Las copas, ligas juveniles y formato deben quedar decididos
                  aquí porque el calendario se construye al comenzar.
                </Text>
              </div>
              <Tooltip
                multiline
                w={280}
                disabled={preseasonReady}
                label={`Faltan requisitos: ${pendingBlockers.map((b) => b.label).join('; ')}`}
              >
                <Button
                  size="lg"
                  leftSection={<IconPlayerPlay size={18} />}
                  onClick={() => mStart.mutate(undefined as void)}
                  loading={mStart.isPending}
                  disabled={!preseasonReady}
                  variant="gradient"
                  gradient={{ from: '#10B981', to: '#059669' }}
                  style={{ height: 48 }}
                >
                  Comenzar temporada
                </Button>
              </Tooltip>
            </Group>

            {preseason.data && (
              <Paper
                p="md"
                ml={52}
                style={{
                  background: preseasonReady ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderLeft: `3px solid ${preseasonReady ? '#10B981' : '#EF4444'}`,
                }}
              >
                <Group gap="xs" mb="xs">
                  <IconClipboardList size={18} color={preseasonReady ? '#10B981' : '#EF4444'} />
                  <Text fw={700} size="sm">
                    {preseasonReady
                      ? 'Todo listo para comenzar'
                      : 'Antes de empezar la temporada'}
                  </Text>
                </Group>
                <Stack gap={6}>
                  {preseason.data.items.map((item) => (
                    <Group gap="xs" key={item.id} wrap="nowrap">
                      {item.done ? (
                        <IconCircleCheck size={18} color="#10B981" />
                      ) : (
                        <IconCircleX size={18} color={item.blocking ? '#EF4444' : '#6B7280'} />
                      )}
                      <Text size="sm" c={item.done ? undefined : 'dimmed'} style={{ flex: 1 }}>
                        {item.label}
                      </Text>
                      {!item.done && item.blocking && (
                        <Badge size="xs" color="red" variant="light">
                          obligatorio
                        </Badge>
                      )}
                      {!item.blocking && (
                        <Badge size="xs" color="gray" variant="outline">
                          recomendado
                        </Badge>
                      )}
                    </Group>
                  ))}
                </Stack>
              </Paper>
            )}

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

            {/* Last season chronicle */}
            {summary.data?.lastChronicle && (() => {
              const c = summary.data.lastChronicle!;
              return (
                <Paper p="md" mt="sm" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8 }}>
                  <Group gap="xs" mb="xs">
                    <IconTrophy size={16} color="#F59E0B" />
                    <Text fw={700} size="sm">Temporada {c.year} — Crónica</Text>
                  </Group>
                  <Text size="sm" fw={600} mb={4}>{c.headline}</Text>
                  <Stack gap={4}>
                    {c.revelation && (
                      <Group gap="xs">
                        <IconStar size={13} color="#10B981" />
                        <Text size="xs" c="dimmed">Revelación: <Text span fw={600} c="white">{c.revelation.name}</Text> — {c.revelation.reason}</Text>
                      </Group>
                    )}
                    {c.disappointment && (
                      <Group gap="xs">
                        <IconAlertTriangle size={13} color="#EF4444" />
                        <Text size="xs" c="dimmed">Decepción: <Text span fw={600} c="white">{c.disappointment.name}</Text> — {c.disappointment.reason}</Text>
                      </Group>
                    )}
                    {c.bestPlayer && (
                      <Group gap="xs">
                        <IconStar size={13} color="#F59E0B" />
                        <Text size="xs" c="dimmed">Máximo goleador: <Text span fw={600} c="white">{c.bestPlayer.name}</Text> ({c.bestPlayer.goals} goles, {c.bestPlayer.teamName})</Text>
                      </Group>
                    )}
                  </Stack>
                </Paper>
              );
            })()}
          </Stack>
        ) : (
          <Stack gap="md">
            {/* HUD command header: phase context + matchday telemetry */}
            <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
              <div>
                <Text component="div" className="hud-eyebrow">
                  Centro de mando · Temporada {summary.data?.year ?? '—'}
                </Text>
                <Text
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 24,
                    fontWeight: 700,
                    lineHeight: 1.1,
                    color: '#F4F7FA',
                  }}
                >
                  {over
                    ? 'Temporada finalizada'
                    : blocked
                      ? 'Atención requerida'
                      : `Jornada ${summary.data?.currentMatchday ?? 0} de ${summary.data?.totalMatchdays ?? 0}`}
                </Text>
              </div>
              {!over && (summary.data?.totalMatchdays ?? 0) > 0 && (
                <Box style={{ minWidth: 180, flex: '0 1 240px' }}>
                  <Group justify="space-between" mb={4}>
                    <Text className="hud-eyebrow" component="span" style={{ fontSize: 10 }}>
                      Progreso
                    </Text>
                    <Text
                      component="span"
                      className="mono"
                      style={{ fontSize: 12, color: '#34D399', fontWeight: 600 }}
                    >
                      {Math.round(
                        ((summary.data?.currentMatchday ?? 0) /
                          (summary.data?.totalMatchdays || 1)) *
                          100,
                      )}
                      %
                    </Text>
                  </Group>
                  <Progress
                    value={
                      ((summary.data?.currentMatchday ?? 0) /
                        (summary.data?.totalMatchdays || 1)) *
                      100
                    }
                    color="accent"
                    size="sm"
                  />
                </Box>
              )}
            </Group>

            {/* El despacho (Fase 17E): optional per-matchday flavor, auto-resolves if ignored */}
            {!over && phase === 'temporada' && <DeskPanel gameId={gameId} />}

            {/* Primary actions row */}
            <Group>
              <Button
                size="lg"
                leftSection={<IconPlayerPlay size={20} />}
                onClick={() => mAdvanceMd.mutate(undefined as void)}
                disabled={over || busy || blocked}
                loading={mAdvanceMd.isPending}
                variant="gradient"
                gradient={{ from: '#10B981', to: '#047857' }}
                style={{
                  height: 52,
                  paddingInline: 26,
                  fontSize: 15,
                  boxShadow: over || busy || blocked ? undefined : '0 12px 30px -10px rgba(16,185,129,0.6)',
                }}
              >
                Avanzar jornada
              </Button>
              <Button
                variant="outline"
                leftSection={<IconSparkles size={16} />}
                onClick={() => mAdvanceSeason.mutate(undefined as void)}
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
                    onConfirm: () => mClose.mutate(undefined as void),
                  })
                }
                disabled={!over || busy}
                loading={mClose.isPending}
              >
                Cerrar temporada
              </Button>
            </Group>

            {/* Blocking alert: events must be resolved before advancing */}
            {blocked && (
              <Alert color="orange" icon={<IconAlertTriangle size={18} />} title="Polémica sin resolver">
                Hay {summary.data?.pendingEventsCount} evento(s) pendiente(s). Ve
                a <strong>Eventos</strong> y resuélvelos para poder avanzar.
              </Alert>
            )}

            {/* Mathematical champion alert */}
            {!over && standings.data && standings.data.rows.length >= 2 && (() => {
              const rows = standings.data!.rows;
              const leader = rows[0];
              const runnerUp = rows[1];
              const matchdaysLeft = (summary.data?.totalMatchdays ?? 0) - (summary.data?.currentMatchday ?? 0);
              const gap = leader.points - runnerUp.points;
              if (gap > matchdaysLeft * 3) {
                return (
                  <Alert
                    color="yellow"
                    icon={<IconTrophy size={18} />}
                    title="Campeón matemático"
                    styles={{ title: { color: '#F59E0B', fontWeight: 800 } }}
                  >
                    <strong>{leader.name}</strong> es campeón matemático con {gap} puntos de ventaja.
                  </Alert>
                );
              }
              return null;
            })()}

            {/* Season-over alert */}
            {over && (
              <Alert color="yellow" icon={<IconTrophy size={18} />} title="Temporada terminada">
                Revisa la clasificación final y cierra la temporada para escribir el historial.
              </Alert>
            )}
          </Stack>
        )}
      </Paper>

      {/* ── Two-column layout for in-season view ── */}
      {!isPreseason && (
        <Grid gutter="md">
          {/* LEFT: standings + next fixtures */}
          <Grid.Col span={{ base: 12, md: 7 }}>
            <Stack gap="md">
              {/* Standings table */}
              <Paper withBorder p="md">
                <StandingsTable
                  gameId={gameId}
                  division={division}
                  setDivision={setDivision}
                  year={standings.data?.year ?? summary.data?.year ?? 0}
                  divisionName={standings.data?.divisionName}
                  availableDivisions={standings.data?.availableDivisions ?? []}
                  rows={standings.data?.rows ?? []}
                  isLoading={standings.isLoading}
                />
              </Paper>

              {/* Persistent cups panel: always shows active cups + when their next round lands */}
              {!over && cups.data && (() => {
                const sched = cups.data.schedule;
                const curMd = cups.data.currentMatchday;
                const active = cups.data.cups.filter((c) => c.status !== 'finalizada');
                if (active.length === 0 && sched.length === 0) return null;
                const nextByCup = (cupId: number) =>
                  sched
                    .filter((e) => e.cupId === cupId && e.matchday >= curMd)
                    .sort((a, b) => a.matchday - b.matchday)[0]?.matchday ?? null;
                return (
                  <Paper withBorder p="md">
                    <Group gap="xs" mb="sm">
                      <IconTrophy size={18} color="#F59E0B" />
                      <Text fw={700}>Copas</Text>
                    </Group>
                    <Stack gap={8}>
                      {active.length === 0 && (
                        <Text size="xs" c="dimmed">No hay copas activas esta temporada.</Text>
                      )}
                      {active.map((c) => {
                        const nm = nextByCup(c.id);
                        const thisJornada = nm === curMd;
                        return (
                          <Group key={c.id} justify="space-between" wrap="nowrap">
                            <Text size="sm" fw={500}>{c.name}</Text>
                            {nm == null ? (
                              <Badge size="sm" variant="light" color="gray">Sin rondas próximas</Badge>
                            ) : thisJornada ? (
                              <Badge size="sm" variant="filled" color="orange" leftSection={<IconTrophy size={10} />}>
                                ¡Ronda esta jornada!
                              </Badge>
                            ) : (
                              <Badge size="sm" variant="light" color="orange">
                                Próxima ronda · J{nm}
                              </Badge>
                            )}
                          </Group>
                        );
                      })}
                    </Stack>
                  </Paper>
                );
              })()}

              {/* Next fixtures + cup rounds */}
              {!over && nextFixtures.data && (nextFixtures.data.fixtures.length > 0 || nextFixtures.data.cupRounds.length > 0) && (
                <Paper withBorder p="md">
                  <Group justify="space-between" mb="sm">
                    <Text fw={700}>Próxima jornada · {nextFixtures.data.matchday}</Text>
                    <Badge variant="light" color="grape" leftSection={<IconFlag size={12} />}>
                      Impulsos {nextFixtures.data.impulsesRemaining}/{nextFixtures.data.impulsesPerSeason}
                    </Badge>
                  </Group>
                  <Stack gap={6}>
                    {nextFixtures.data.fixtures.map((f, i) => {
                      const noImpulses = nextFixtures.data!.impulsesRemaining <= 0 && f.favoredTeamId == null;
                      return (
                        <Paper key={`${f.homeTeamId}-${f.awayTeamId}`} withBorder p="sm" radius="sm" className="stagger-item" style={{ background: 'rgba(255,255,255,0.02)', animationDelay: `${i * 40}ms` }}>
                          <Group justify="space-between" align="center">
                            <Group gap="sm" style={{ flex: 1 }}>
                              <Text fw={600} size="sm" style={{ minWidth: 100, textAlign: 'right' }}>{f.homeTeamName}</Text>
                              <Text size="xs" c="dimmed" style={{ fontFamily: theme.fontFamilyMonospace }}>vs</Text>
                              <Text fw={600} size="sm" style={{ minWidth: 100 }}>{f.awayTeamName}</Text>
                            </Group>
                            <Group gap={4}>
                              <Tooltip label={`Impulsar a ${f.homeTeamName}`}>
                                <Button size="compact-xs" variant={f.favoredTeamId === f.homeTeamId ? 'filled' : 'light'} color="grape" leftSection={<IconFlag size={12} />} disabled={busy || noImpulses || f.favoredTeamId != null} onClick={() => mImpulse.mutate({ home: f.homeTeamId, away: f.awayTeamId, fav: f.homeTeamId })}>
                                  Local
                                </Button>
                              </Tooltip>
                              <Tooltip label={`Impulsar a ${f.awayTeamName}`}>
                                <Button size="compact-xs" variant={f.favoredTeamId === f.awayTeamId ? 'filled' : 'light'} color="grape" leftSection={<IconFlag size={12} />} disabled={busy || noImpulses || f.favoredTeamId != null} onClick={() => mImpulse.mutate({ home: f.homeTeamId, away: f.awayTeamId, fav: f.awayTeamId })}>
                                  Visitante
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
                      <Text fw={600} size="sm" c="dimmed">Copas en esta jornada</Text>
                      {nextFixtures.data.cupRounds.map((cr, i) => {
                        const fullCup = (cups.data?.cups ?? []).find((c) => c.id === cr.cupId);
                        return (
                          <Paper key={cr.cupId} withBorder p="xs" radius="sm" className="stagger-item" style={{ animationDelay: `${i * 40}ms` }}>
                            <Group justify="space-between" mb={6}>
                              <Text fw={600} size="sm">{cr.cupName}</Text>
                              <Badge variant="light" color="orange" size="sm" leftSection={<IconTrophy size={10} />}>
                                {cr.cupFormato === 'liga' ? 'Liga' : `Ronda ${cr.roundNumero}`}
                              </Badge>
                            </Group>
                            {fullCup && fullCup.rounds.length > 1 && (
                              <Stack gap={4} mb={6}>
                                {fullCup.rounds.filter((r) => r.numero < cr.roundNumero).map((r) => {
                                  const realMatches = r.matches.filter((m) => m.homeTeamName !== 'BYE' && m.awayTeamName !== 'BYE');
                                  if (realMatches.length === 0) return null;
                                  return (
                                    <Group key={r.numero} gap={4}>
                                      <Text size="xs" c="dimmed" style={{ fontFamily: theme.fontFamilyMonospace, minWidth: 40 }}>R{r.numero}</Text>
                                      {realMatches.map((m, j) => (
                                        <Group key={j} gap={4}>
                                          <Text size="xs" fw={m.winnerTeamId === m.homeTeamId ? 700 : 400} style={{ color: m.winnerTeamId === m.homeTeamId ? '#10B981' : undefined, textDecoration: m.winnerTeamId === m.awayTeamId ? 'line-through' : undefined, opacity: m.winnerTeamId === m.awayTeamId ? 0.5 : 1 }}>{m.homeTeamName}</Text>
                                          <Text size="xs" c="dimmed" style={{ fontFamily: theme.fontFamilyMonospace }}>{m.homeGoals}-{m.awayGoals}</Text>
                                          <Text size="xs" fw={m.winnerTeamId === m.awayTeamId ? 700 : 400} style={{ color: m.winnerTeamId === m.awayTeamId ? '#10B981' : undefined, textDecoration: m.winnerTeamId === m.homeTeamId ? 'line-through' : undefined, opacity: m.winnerTeamId === m.homeTeamId ? 0.5 : 1 }}>{m.awayTeamName}</Text>
                                        </Group>
                                      ))}
                                    </Group>
                                  );
                                })}
                              </Stack>
                            )}
                            {!cr.matchesKnown ? (
                              <Text size="xs" c="dimmed">Emparejamientos pendientes hasta resolver la ronda previa.</Text>
                            ) : (() => {
                              const realMatches = cr.matches.filter((m) => m.homeTeamName !== 'BYE' && m.awayTeamName !== 'BYE');
                              if (realMatches.length === 0) return null;
                              return (
                                <Table><Table.Tbody>
                                  {realMatches.map((m, j) => (
                                    <Table.Tr key={`${cr.cupId}-${cr.roundNumero}-${j}`}>
                                      <Table.Td>{m.homeTeamName} <Text span c="dimmed" size="xs">vs</Text> {m.awayTeamName}</Table.Td>
                                    </Table.Tr>
                                  ))}
                                </Table.Tbody></Table>
                              );
                            })()}
                          </Paper>
                        );
                      })}
                    </Stack>
                  )}
                </Paper>
              )}
            </Stack>
          </Grid.Col>

          {/* RIGHT: commissioner actions + match reports */}
          <Grid.Col span={{ base: 12, md: 5 }}>
            <Stack gap="md">
              {/* Headlines feed */}
              <HeadlinesFeed headlines={summary.data?.headlines ?? []} />

              {/* Board mandate card */}
              {summary.data?.mandate && (
                <MandateCard
                  mandate={summary.data.mandate}
                  consecutiveFails={summary.data.consecutiveMandateFails ?? 0}
                  federationPrestige={summary.data.federation.prestige}
                  impulsesPerSeason={summary.data.impulsesPerSeason}
                />
              )}

              {/* Commissioner actions panel */}
              <Paper withBorder p="md">
                <Text fw={700} mb="sm">Acciones del comisionario</Text>
                <Stack gap="xs">
                  <Group gap="xs" align="flex-end">
                    <Select
                      label="Revisar partido"
                      placeholder="Selecciona un partido"
                      data={(() => {
                        const reports = summary.data?.matchReports;
                        if (!reports || reports.length === 0) return [];
                        return reports.map((r) => ({
                          value: `${r.matchday}:${r.homeTeamName}:${r.awayTeamName}`,
                          label: `J${r.matchday} · ${r.homeTeamName} vs ${r.awayTeamName} (${r.homeGoals}-${r.awayGoals})`,
                        }));
                      })()}
                      value={reviewMatchKey}
                      onChange={setReviewMatchKey}
                      size="xs"
                      style={{ flex: 1 }}
                      disabled={over || busy || blocked || phase !== 'temporada'}
                    />
                    <Tooltip label={summary.data?.reviewsUsedThisSeason !== undefined ? `Usadas ${summary.data.reviewsUsedThisSeason}/2 esta temporada` : ''}>
                      <Button
                        variant="outline"
                        size="xs"
                        leftSection={<IconScale size={14} />}
                        onClick={() => {
                          if (!reviewMatchKey) return;
                          const reports = summary.data?.matchReports ?? [];
                          const [mdStr, homeName, awayName] = reviewMatchKey.split(':');
                          const matchday = Number(mdStr);
                          const report = reports.find((r) => r.matchday === matchday && r.homeTeamName === homeName && r.awayTeamName === awayName);
                          if (!report) return;
                          const allTeams = (structure.data?.divisions ?? []).flatMap((d) => d.teams);
                          const homeTeam = allTeams.find((t) => t.name === report.homeTeamName);
                          const awayTeam = allTeams.find((t) => t.name === report.awayTeamName);
                          if (!homeTeam || !awayTeam) return;
                          mCallReview.mutate({ matchday, homeTeamId: homeTeam.teamId, awayTeamId: awayTeam.teamId });
                        }}
                        disabled={over || busy || blocked || !reviewMatchKey || (summary.data?.reviewsUsedThisSeason ?? 0) >= 2 || phase !== 'temporada'}
                        loading={mCallReview.isPending}
                        style={{ borderColor: '#F59E0B', color: '#F59E0B' }}
                      >
                        Revisión {summary.data?.reviewsUsedThisSeason !== undefined ? `(${summary.data.reviewsUsedThisSeason}/2)` : ''}
                      </Button>
                    </Tooltip>
                  </Group>
                  <Group gap="xs" align="flex-end">
                    <Select
                      label="Reunión de emergencia"
                      placeholder="Selecciona un equipo"
                      data={(() => {
                        const seen = new Set<number>();
                        return (structure.data?.divisions ?? [])
                          .flatMap((d) => d.teams)
                          .filter((t) => { if (seen.has(t.teamId)) return false; seen.add(t.teamId); return true; })
                          .map((t) => ({ value: String(t.teamId), label: t.name }));
                      })()}
                      value={emergencyTeamId}
                      onChange={setEmergencyTeamId}
                      size="xs"
                      searchable
                      style={{ flex: 1 }}
                      disabled={over || busy || blocked || phase !== 'temporada'}
                    />
                    <Button
                      variant="outline"
                      size="xs"
                      leftSection={<IconUsers size={14} />}
                      onClick={() => { if (!emergencyTeamId) return; mEmergencyMeeting.mutate(Number(emergencyTeamId)); }}
                      disabled={over || busy || blocked || !emergencyTeamId || phase !== 'temporada'}
                      loading={mEmergencyMeeting.isPending}
                      style={{ borderColor: '#3B82F6', color: '#3B82F6' }}
                    >
                      Convocar
                    </Button>
                  </Group>
                  <Button
                    variant="outline"
                    size="sm"
                    leftSection={<IconCalendarOff size={14} />}
                    onClick={() => mPostponeMatchday.mutate(undefined as void)}
                    disabled={over || busy || blocked || phase !== 'temporada'}
                    loading={mPostponeMatchday.isPending}
                    style={{ borderColor: '#8B5CF6', color: '#8B5CF6', alignSelf: 'flex-start' }}
                  >
                    Posponer jornada
                  </Button>
                </Stack>
              </Paper>

              {/* Last matchday match reports */}
              {summary.data && summary.data.currentMatchday > 0 && (
                <MatchReports
                  matchday={summary.data.currentMatchday}
                  reports={summary.data.matchReports.filter((r) => r.matchday === summary.data!.currentMatchday)}
                />
              )}

              {/* 11.1 — Rival league matchday results */}
              <RivalResults results={summary.data?.rivalLastMatchday ?? []} />
            </Stack>
          </Grid.Col>
        </Grid>
      )}

      {/* Preseason: no standings */}
      {isPreseason && (
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
      )}

      <SeasonNewspaper
        report={newspaperReport}
        federationName={summary.data?.federation.name ?? ''}
        opened={newspaperOpen}
        onClose={() => setNewspaperOpen(false)}
      />
    </div>
  );
}
