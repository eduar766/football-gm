import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Group,
  List,
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
  IconFlag,
  IconPlayerPlay,
  IconPlayerStop,
  IconSparkles,
  IconTrophy,
  IconClipboardList,
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
      <Paper withBorder p="md" mb="md">
        {isPreseason ? (
          <Stack>
            <Group justify="space-between" align="flex-start">
              <div>
                <Group gap="sm">
                  <IconSparkles size={24} color="var(--mantine-color-yellow-5)" />
                  <Text fw={700} size="lg">
                    Pretemporada · Año {summary.data?.year ?? '—'}
                  </Text>
                </Group>
                <Text size="sm" c="dimmed" ml={36}>
                  Monta la nueva temporada antes de que ruede el balón (§4.8).
                  Las copas, ligas juveniles y formato deben quedar decididos
                  aquí porque el calendario se construye al comenzar.
                </Text>
              </div>
              <Button
                size="md"
                leftSection={<IconPlayerPlay size={18} />}
                onClick={() => mStart.mutate()}
                loading={mStart.isPending}
              >
                Comenzar temporada
              </Button>
            </Group>
            <List size="sm" spacing="xs" ml={36}>
              <List.Item
                onClick={() => navigate({ to: '/games/$gameId/cups', params: { gameId } })}
                style={{ cursor: 'pointer' }}
                icon={<IconTrophy size={16} color="var(--mantine-color-orange-5)" />}
              >
                <Text component="span" fw={600}>
                  Copas y ligas juveniles —
                </Text>{' '}
                créalas en <em>Copas</em>; cualquier participante que añadas
                quedará incluido en el calendario.
              </List.Item>
              <List.Item
                onClick={() => navigate({ to: '/games/$gameId/structure', params: { gameId } })}
                style={{ cursor: 'pointer' }}
                icon={<IconCircleCheck size={16} color="var(--mantine-color-green-5)" />}
              >
                <Text component="span" fw={600}>
                  Estructura de la liga —
                </Text>{' '}
                formato de liga (ida / ida y vuelta), liga de nivelación si
                tienes equipos pendientes, y creación de equipos propios.
              </List.Item>
              <List.Item
                onClick={() => navigate({ to: '/games/$gameId/economy', params: { gameId } })}
                style={{ cursor: 'pointer' }}
                icon={<IconSparkles size={16} color="var(--mantine-color-yellow-5)" />}
              >
                <Text component="span" fw={600}>
                  Economía y contratos —
                </Text>{' '}
                firma patrocinios y revisa la inversión en talento.
              </List.Item>
              <List.Item
                onClick={() => navigate({ to: '/games/$gameId/prizes', params: { gameId } })}
                style={{ cursor: 'pointer' }}
                icon={<IconTrophy size={16} color="var(--mantine-color-yellow-5)" />}
              >
                <Text component="span" fw={600}>
                  Premios por competición —
                </Text>{' '}
                define la bolsa y el reparto para la liga y cada copa que
                organices.
              </List.Item>
              <List.Item
                onClick={() => navigate({ to: '/games/$gameId/norms', params: { gameId } })}
                style={{ cursor: 'pointer' }}
                icon={<IconAlertTriangle size={16} color="var(--mantine-color-red-5)" />}
              >
                <Text component="span" fw={600}>
                  Normas —
                </Text>{' '}
                ajusta topes y mínimos competitivos que regirán la próxima
                temporada.
              </List.Item>
              <List.Item
                onClick={() => navigate({ to: '/games/$gameId/transfers', params: { gameId } })}
                style={{ cursor: 'pointer' }}
                icon={<IconFlag size={16} color="var(--mantine-color-blue-5)" />}
              >
                <Text component="span" fw={600}>
                  Fichajes —
                </Text>{' '}
                revisa la ventana de movimientos que han firmado los clubes
                entre la temporada anterior y la próxima.
              </List.Item>
            </List>
          </Stack>
        ) : (
          <>
            <Group>
              <Button
                leftSection={<IconPlayerPlay size={16} />}
                onClick={() => mAdvanceMd.mutate()}
                disabled={over || busy || blocked}
                loading={mAdvanceMd.isPending}
              >
                Avanzar jornada
              </Button>
              <Button
                variant="light"
                leftSection={<IconSparkles size={16} />}
                onClick={() => mAdvanceSeason.mutate()}
                disabled={over || busy || blocked}
                loading={mAdvanceSeason.isPending}
              >
                Avanzar temporada
              </Button>
              <Button
                color="yellow"
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
                    confirmProps: { color: 'yellow' },
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
          <Table>
            <Table.Tbody>
              {nextFixtures.data.fixtures.map((f) => {
                const noImpulses = nextFixtures.data!.impulsesRemaining <= 0 && f.favoredTeamId == null;
                return (
                  <Table.Tr key={`${f.homeTeamId}-${f.awayTeamId}`}>
                    <Table.Td>
                      {f.homeTeamName}{' '}
                      <Text span c="dimmed" size="xs">
                        vs
                      </Text>{' '}
                      {f.awayTeamName}
                    </Table.Td>
                    <Table.Td ta="right">
                      <Group gap="xs" justify="flex-end">
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
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
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
            <Table striped highlightOnHover>
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
                {standings.data?.rows.map((r, i) => (
                  <Table.Tr key={r.teamId}>
                    <Table.Td>{i + 1}</Table.Td>
                    <Table.Td>
                      <Link
                        to="/games/$gameId/teams/$teamId"
                        params={{ gameId, teamId: String(r.teamId) }}
                      >
                        {r.name}
                      </Link>
                    </Table.Td>
                    <Table.Td ta="right">{r.played}</Table.Td>
                    <Table.Td ta="right">{r.won}</Table.Td>
                    <Table.Td ta="right">{r.drawn}</Table.Td>
                    <Table.Td ta="right">{r.lost}</Table.Td>
                    <Table.Td ta="right">{r.goalsFor}</Table.Td>
                    <Table.Td ta="right">{r.goalsAgainst}</Table.Td>
                    <Table.Td ta="right">
                      {r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}
                    </Table.Td>
                    <Table.Td ta="right" fw={700}>
                      {r.points}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Paper>
      )}
    </div>
  );
}
