import { useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Paper,
  SegmentedControl,
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
  IconCheck,
  IconCircleCheck,
  IconClipboardList,
  IconFlag,
  IconPlayerPlay,
  IconPlayerStop,
  IconSparkles,
  IconTrophy,
  IconX,
} from '@tabler/icons-react';
import { api } from '../api';

export function DashboardPage() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [division, setDivision] = useState(1);
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

  const over = summary.data?.seasonOver ?? false;
  const blocked = (summary.data?.pendingEventsCount ?? 0) > 0;
  const busy = mAdvanceMd.isPending || mAdvanceSeason.isPending || mClose.isPending;

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
                style={{
                  background: 'linear-gradient(135deg, #10B981, #059669)',
                  color: 'white',
                  height: 48,
                }}
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
              ].map((item) => (
                <Group
                  key={item.route}
                  gap="md"
                  p="sm"
                  style={{
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'background 0.15s',
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
                style={{
                  background: 'linear-gradient(135deg, #10B981, #059669)',
                  color: 'white',
                  height: 48,
                }}
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
            {blocked && (
              <Alert color="orange" mt="md" icon={<IconAlertTriangle size={18} />} title="Polémica sin resolver">
                Hay {summary.data?.pendingEventsCount} evento(s) pendiente(s). Ve
                a la pestaña <strong>Eventos</strong> y resuélvelos para poder
                avanzar.
              </Alert>
            )}
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
            {nextFixtures.data.fixtures.map((f) => {
              const noImpulses = nextFixtures.data!.impulsesRemaining <= 0 && f.favoredTeamId == null;
              return (
                <Paper
                  key={`${f.homeTeamId}-${f.awayTeamId}`}
                  withBorder
                  p="sm"
                  radius="sm"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
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
              {nextFixtures.data.cupRounds.map((cr) => (
                <Paper key={cr.cupId} withBorder p="xs" radius="sm">
                  <Group justify="space-between" mb={6}>
                    <Text fw={600} size="sm">
                      {cr.cupName}
                    </Text>
                    <Badge variant="light" color="orange" size="sm" leftSection={<IconTrophy size={10} />}>
                      {cr.cupFormato === 'liga' ? 'Liga' : `Ronda ${cr.roundNumero}`}
                    </Badge>
                  </Group>
                  {!cr.matchesKnown ? (
                    <Text size="xs" c="dimmed">
                      Emparejamientos pendientes hasta resolver la ronda previa.
                    </Text>
                  ) : (
                    <Table>
                      <Table.Tbody>
                        {cr.matches.map((m, i) => (
                          <Table.Tr key={`${cr.cupId}-${cr.roundNumero}-${i}`}>
                            <Table.Td>
                              {m.homeTeamName ?? 'BYE'}{' '}
                              <Text span c="dimmed" size="xs">
                                vs
                              </Text>{' '}
                              {m.awayTeamName ?? 'BYE'}
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  )}
                </Paper>
              ))}
            </Stack>
          )}
        </Paper>
      )}

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
                      style={{
                        borderLeft: isTop3 ? '3px solid #10B981' : '3px solid transparent',
                        transition: 'border-color 0.15s',
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
