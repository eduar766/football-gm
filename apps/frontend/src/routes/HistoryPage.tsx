import { Badge, Box, Grid, Group, Paper, SimpleGrid, Skeleton, Table, Tabs, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { IconHistory, IconMedal, IconTrophy, IconWorld } from '@tabler/icons-react';
import type { AwardType, RecordBookDto, TeamTrajectoryData } from '@football-gm/contracts';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../api';
import { PalmaresChart } from '../components/PalmaresChart';
import { PageHero } from '../components/PageHero';

const AWARD_LABEL: Record<AwardType, string> = {
  max_goleador: 'Máximo goleador',
  max_asistente: 'Máximo asistente',
  mejor_portero: 'Mejor portero',
};

const AWARD_ICON: Record<AwardType, string> = {
  max_goleador: '⚽',
  max_asistente: '🅰️',
  mejor_portero: '🧤',
};

const MEDAL_COLORS = ['#F59E0B', '#9CA3AF', '#D97706'];

export function HistoryPage() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);
  const hist = useQuery({ queryKey: ['history', id], queryFn: () => api.history(id) });

  if (hist.isLoading) {
    return (
      <div className="page-enter">
        <Grid>
          <Grid.Col span={{ base: 12, md: 7 }}><Skeleton height={250} radius="md" /></Grid.Col>
          <Grid.Col span={{ base: 12, md: 5 }}><Skeleton height={250} radius="md" /></Grid.Col>
        </Grid>
        <Grid mt="md">
          <Grid.Col span={{ base: 12, md: 7 }}><Skeleton height={250} radius="md" /></Grid.Col>
          <Grid.Col span={{ base: 12, md: 5 }}><Skeleton height={250} radius="md" /></Grid.Col>
        </Grid>
      </div>
    );
  }

  const records = hist.data?.records ?? [];
  const palmares = hist.data?.palmares ?? [];
  const awards = hist.data?.awards ?? [];
  const topScorers = hist.data?.topScorers ?? [];
  const rivalChampions = hist.data?.rivalChampions ?? [];
  const trajectoryData = hist.data?.trajectoryData ?? [];
  const recordBook = hist.data?.recordBook ?? null;

  return (
    <div className="page-enter">
      <PageHero
        icon={IconHistory}
        iconColor="#10B981"
        title="Historial"
      />

      <Tabs defaultValue="mi-liga" variant="pills" radius="md">
        <Tabs.List
          mb="md"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10,
            padding: 4,
          }}
        >
          <Tabs.Tab
            value="mi-liga"
            leftSection={<IconTrophy size={16} />}
            style={{ fontWeight: 600 }}
          >
            Mi Liga
          </Tabs.Tab>
          <Tabs.Tab
            value="otras-federaciones"
            leftSection={<IconWorld size={16} />}
            style={{ fontWeight: 600 }}
          >
            Otras Federaciones
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="mi-liga">
          <Grid>
            <Grid.Col span={{ base: 12, md: 7 }}>
              <Paper p="md" style={{ border: '1px solid rgba(255,255,255,0.06)', borderLeft: '3px solid #F59E0B' }}>
                <Text fw={700} mb="sm">Actas de temporada</Text>
                {records.length === 0 ? (
                  <Text c="dimmed" size="sm">Aún no se ha cerrado ninguna temporada.</Text>
                ) : (
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Año</Table.Th>
                        <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Campeón</Table.Th>
                        <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Competición</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {records.map((r, i) => (
                        <Table.Tr
                          key={`${r.anio}-${r.championTeamId}`}
                          className="stagger-item"
                          style={{
                            borderLeft: `3px solid ${i < 3 ? MEDAL_COLORS[i] : 'transparent'}`,
                            background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                            animationDelay: `${i * 50}ms`,
                          }}
                        >
                          <Table.Td>
                            <Text fw={700} style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>{r.anio}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Link
                              to="/games/$gameId/teams/$teamId"
                              params={{ gameId, teamId: String(r.championTeamId) }}
                            >
                              <Group gap="xs">
                                {i < 3 && (
                                  <Box
                                    style={{
                                      width: 20,
                                      height: 20,
                                      borderRadius: '50%',
                                      background: MEDAL_COLORS[i],
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    <Text style={{ fontSize: '10px', fontWeight: 800, color: '#000' }}>
                                      {i + 1}
                                    </Text>
                                  </Box>
                                )}
                                <Text fw={600}>{r.championName}</Text>
                              </Group>
                            </Link>
                          </Table.Td>
                          <Table.Td>
                            {r.cupName ? (
                              <Badge
                                size="sm"
                                variant="light"
                                color="yellow"
                                leftSection={<IconTrophy size={10} />}
                                style={{ fontWeight: 600 }}
                              >
                                {r.cupName}
                              </Badge>
                            ) : (
                              <Text size="sm" c="dimmed">{r.divisionName ?? '—'}</Text>
                            )}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                )}
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 5 }}>
              <Paper p="md" style={{ border: '1px solid rgba(255,255,255,0.06)', borderLeft: '3px solid #F59E0B' }}>
                <Text fw={700} mb="sm">Palmarés</Text>
                <Text size="xs" c="dimmed" mb="sm">
                  Vista derivada de las actas (no se almacena).
                </Text>
                {palmares.length === 0 ? (
                  <Text c="dimmed" size="sm">Sin títulos todavía.</Text>
                ) : (
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Equipo</Table.Th>
                        <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Títulos</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {palmares.map((p, i) => (
                        <Table.Tr
                          key={p.teamId}
                          className="stagger-item"
                          style={{
                            borderLeft: `3px solid ${i < 3 ? MEDAL_COLORS[i] : 'transparent'}`,
                            animationDelay: `${i * 50}ms`,
                          }}
                        >
                          <Table.Td>
                            <Group gap="xs">
                              {i < 3 && (
                                <Box
                                  style={{
                                    width: 18,
                                    height: 18,
                                    borderRadius: '50%',
                                    background: MEDAL_COLORS[i],
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Text style={{ fontSize: '9px', fontWeight: 800, color: '#000' }}>
                                    {i + 1}
                                  </Text>
                                </Box>
                              )}
                              <Text fw={i < 3 ? 600 : 400}>{p.teamName}</Text>
                            </Group>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text fw={800} style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: '#F59E0B' }}>
                              {p.titles}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                )}
              </Paper>
            </Grid.Col>
          </Grid>

          {palmares.length > 0 && <PalmaresChart data={palmares} />}

          {trajectoryData.length > 0 && (
            <TrajectoryChart data={trajectoryData} />
          )}

          {recordBook && (
            <RecordBookPanel recordBook={recordBook} />
          )}

          <Grid mt="md">
            <Grid.Col span={{ base: 12, md: 7 }}>
              <Paper p="md" style={{ border: '1px solid rgba(255,255,255,0.06)', borderLeft: '3px solid #F59E0B' }}>
                <Text fw={700} mb="sm">Galardones por temporada</Text>
                {awards.length === 0 ? (
                  <Text c="dimmed" size="sm">Aún no se han otorgado galardones.</Text>
                ) : (
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Año</Table.Th>
                        <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Premio</Table.Th>
                        <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Jugador</Table.Th>
                        <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Equipo</Table.Th>
                        <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Valor</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {awards.map((a, i) => (
                        <Table.Tr
                          key={`${a.year}-${a.tipo}-${i}`}
                          className="stagger-item"
                          style={{
                            borderLeft: '3px solid transparent',
                            background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                            animationDelay: `${i * 50}ms`,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderLeftColor = '#F59E0B';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderLeftColor = 'transparent';
                          }}
                        >
                          <Table.Td>
                            <Text style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>{a.year}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Box
                              style={{
                                display: 'inline-flex',
                                padding: '2px 10px',
                                borderRadius: 12,
                                background: 'rgba(245,158,11,0.15)',
                                color: '#F59E0B',
                                fontWeight: 600,
                                fontSize: '12px',
                                gap: 4,
                              }}
                            >
                              {AWARD_ICON[a.tipo]} {AWARD_LABEL[a.tipo]}
                            </Box>
                          </Table.Td>
                          <Table.Td fw={500}>{a.playerName}</Table.Td>
                          <Table.Td c="dimmed">{a.teamName}</Table.Td>
                          <Table.Td ta="right">
                            <Text fw={700} style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: '#F59E0B' }}>
                              {a.valor}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                )}
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 5 }}>
              <Paper p="md" style={{ border: '1px solid rgba(255,255,255,0.06)', borderLeft: '3px solid #F59E0B' }}>
                <Text fw={700} mb="sm">Ranking histórico de goleadores</Text>
                <Text size="xs" c="dimmed" mb="sm">
                  Vista derivada de los galardones (no se almacena).
                </Text>
                {topScorers.length === 0 ? (
                  <Text c="dimmed" size="sm">Sin ranking todavía.</Text>
                ) : (
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Jugador</Table.Th>
                        <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Equipo</Table.Th>
                        <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Pichichis</Table.Th>
                        <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Goles tot.</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {topScorers.map((r, i) => (
                        <Table.Tr
                          key={r.playerId}
                          className="stagger-item"
                          style={{
                            borderLeft: `3px solid ${i < 3 ? MEDAL_COLORS[i] : 'transparent'}`,
                            background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                            animationDelay: `${i * 50}ms`,
                          }}
                        >
                          <Table.Td fw={600}>{r.playerName}</Table.Td>
                          <Table.Td c="dimmed">{r.teamName}</Table.Td>
                          <Table.Td ta="right">
                            <Text style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>{r.seasonsWon}</Text>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text fw={700} style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: '#10B981' }}>
                              {r.totalGoles}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                )}
              </Paper>
            </Grid.Col>
          </Grid>
        </Tabs.Panel>

        <Tabs.Panel value="otras-federaciones">
          <RivalChampionsPanel champions={rivalChampions} />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

const LINE_COLORS = [
  '#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444', '#F97316', '#06B6D4', '#EC4899',
];

function TrajectoryChart({ data }: { data: TeamTrajectoryData[] }) {
  // Build year-keyed data points. Only teams with ≥2 seasons, capped at 8.
  const eligible = data
    .filter(t => t.rows.length >= 2)
    .slice(0, 8);
  if (eligible.length === 0) return null;

  const allYears = [...new Set(eligible.flatMap(t => t.rows.map(r => r.anio)))].sort((a, b) => a - b);

  const chartData = allYears.map(year => {
    const point: Record<string, number | string> = { year };
    for (const team of eligible) {
      const row = team.rows.find(r => r.anio === year);
      if (row) point[team.teamName] = row.puestoFinal;
    }
    return point;
  });

  const maxPos = Math.max(...eligible.flatMap(t => t.rows.map(r => r.puestoFinal)));

  return (
    <Paper mt="md" p="md" style={{ border: '1px solid rgba(255,255,255,0.06)', borderLeft: '3px solid #10B981' }}>
      <Text fw={700} mb="sm">Trayectoria de equipos por temporada</Text>
      <Text size="xs" c="dimmed" mb="md">Posición final en su división (1 = campeón). Abajo = mejor.</Text>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="year"
            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: 'var(--mantine-font-family-monospace)' }}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickLine={false}
          />
          <YAxis
            reversed
            domain={[1, maxPos]}
            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={24}
          />
          <Tooltip
            contentStyle={{
              background: '#111820',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(value) => <span style={{ color: 'rgba(255,255,255,0.8)' }}>{value}</span>}
          />
          {eligible.map((team, i) => (
            <Line
              key={team.teamId}
              type="monotone"
              dataKey={team.teamName}
              stroke={LINE_COLORS[i % LINE_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3, fill: LINE_COLORS[i % LINE_COLORS.length] }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Paper>
  );
}

function RecordBookPanel({ recordBook }: { recordBook: RecordBookDto }) {
  const hasBigWin = recordBook.biggestWin !== null;
  const hasStreak = recordBook.longestWinStreak !== null;
  if (!hasBigWin && !hasStreak) return null;

  return (
    <Paper mt="md" p="md" style={{ border: '1px solid rgba(255,255,255,0.06)', borderLeft: '3px solid #8B5CF6' }}>
      <Group gap="sm" mb="md">
        <IconMedal size={18} color="#8B5CF6" />
        <Text fw={700}>Libro de récords</Text>
      </Group>
      <Grid>
        {hasBigWin && (
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Box
              p="md"
              style={{
                background: 'rgba(139,92,246,0.08)',
                borderRadius: 10,
                border: '1px solid rgba(139,92,246,0.2)',
              }}
            >
              <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb={4}>Mayor goleada</Text>
              <Text fw={800} size="xl" style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: '#8B5CF6' }}>
                {recordBook.biggestWin!.homeGoals} – {recordBook.biggestWin!.awayGoals}
              </Text>
              <Text size="sm" mt={2}>
                {recordBook.biggestWin!.homeName} vs {recordBook.biggestWin!.awayName}
              </Text>
              <Text size="xs" c="dimmed" mt={2}>Temporada {recordBook.biggestWin!.year}</Text>
            </Box>
          </Grid.Col>
        )}
        {hasStreak && (
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Box
              p="md"
              style={{
                background: 'rgba(16,185,129,0.08)',
                borderRadius: 10,
                border: '1px solid rgba(16,185,129,0.2)',
              }}
            >
              <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb={4}>Racha ganadora más larga</Text>
              <Text fw={800} size="xl" style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: '#10B981' }}>
                {recordBook.longestWinStreak!.count} victorias
              </Text>
              <Text size="sm" mt={2}>{recordBook.longestWinStreak!.teamName}</Text>
              <Text size="xs" c="dimmed" mt={2}>Temporada {recordBook.longestWinStreak!.year}</Text>
            </Box>
          </Grid.Col>
        )}
      </Grid>
    </Paper>
  );
}

function RivalChampionsPanel({ champions }: { champions: Array<{ year: number; federationName: string; championName: string; points: number }> }) {
  if (champions.length === 0) {
    return (
      <Paper p="xl" style={{ border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
        <IconWorld size={40} color="rgba(255,255,255,0.15)" style={{ marginBottom: 12 }} />
        <Text c="dimmed" fw={500}>Aún no hay campeonatos de otras federaciones.</Text>
        <Text size="sm" c="dimmed" mt={4}>Los resultados aparecerán después de cerrar una temporada.</Text>
      </Paper>
    );
  }

  const byFederation = new Map<string, typeof champions>();
  for (const c of champions) {
    const arr = byFederation.get(c.federationName) ?? [];
    arr.push(c);
    byFederation.set(c.federationName, arr);
  }

  const sortedFeds = [...byFederation.entries()].sort((a, b) => {
    const aLatest = Math.max(...a[1].map(c => c.year));
    const bLatest = Math.max(...b[1].map(c => c.year));
    return bLatest - aLatest;
  });

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
      {sortedFeds.map(([fedName, fedChamps]) => {
        const sorted = [...fedChamps].sort((a, b) => b.year - a.year);
        const latest = sorted[0];

        return (
          <Paper
            key={fedName}
            p="md"
            className="stagger-item"
            style={{
              border: '1px solid rgba(255,255,255,0.06)',
              borderLeft: '3px solid #3B82F6',
              background: 'rgba(59,130,246,0.03)',
            }}
          >
            <Group gap="xs" mb="md">
              <IconWorld size={14} color="#3B82F6" />
              <Text fw={700} size="sm" style={{ color: '#60A5FA' }}>{fedName}</Text>
              <Box ml="auto">
                <Text size="xs" c="dimmed">{fedChamps.length} {fedChamps.length === 1 ? 'temporada' : 'temporadas'}</Text>
              </Box>
            </Group>

            <Box
              style={{
                background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(59,130,246,0.02))',
                borderRadius: 8,
                padding: '12px 14px',
                marginBottom: 10,
              }}
            >
              <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={2}>Último campeón</Text>
              <Group gap="xs">
                <Box
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: '#F59E0B',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconTrophy size={12} color="#000" />
                </Box>
                <div>
                  <Text fw={700} size="sm" style={{ lineHeight: 1.2 }}>{latest.championName}</Text>
                  <Text size="xs" c="dimmed">Temporada {latest.year} · {latest.points} pts</Text>
                </div>
              </Group>
            </Box>

            {sorted.length > 1 && (
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={4}>Historial</Text>
                {sorted.map((c, i) => (
                  <Group
                    key={`${c.year}-${c.championName}`}
                    gap="xs"
                    py={3}
                    style={{
                      borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : undefined,
                    }}
                  >
                    <Text size="xs" style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: 'rgba(255,255,255,0.4)', minWidth: 28 }}>
                      {c.year}
                    </Text>
                    <Text size="xs" fw={500} style={{ flex: 1 }}>{c.championName}</Text>
                    <Text size="xs" c="dimmed" style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>
                      {c.points} pts
                    </Text>
                  </Group>
                ))}
              </Box>
            )}
          </Paper>
        );
      })}
    </SimpleGrid>
  );
}
