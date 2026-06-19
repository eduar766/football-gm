import { Badge, Grid, Group, Paper, Skeleton, Table, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { IconHistory } from '@tabler/icons-react';
import type { AwardType } from '@football-gm/contracts';
import { api } from '../api';
import { PalmaresChart } from '../components/PalmaresChart';

const AWARD_LABEL: Record<AwardType, string> = {
  max_goleador: 'Máximo goleador',
  max_asistente: 'Máximo asistente',
  mejor_portero: 'Mejor portero',
};

export function HistoryPage() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);
  const hist = useQuery({ queryKey: ['history', id], queryFn: () => api.history(id) });

  if (hist.isLoading) {
    return (
      <>
        <Grid>
          <Grid.Col span={{ base: 12, md: 7 }}>
            <Skeleton height={250} radius="md" />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 5 }}>
            <Skeleton height={250} radius="md" />
          </Grid.Col>
        </Grid>
        <Grid mt="md">
          <Grid.Col span={{ base: 12, md: 7 }}>
            <Skeleton height={250} radius="md" />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 5 }}>
            <Skeleton height={250} radius="md" />
          </Grid.Col>
        </Grid>
      </>
    );
  }

  const records = hist.data?.records ?? [];
  const palmares = hist.data?.palmares ?? [];
  const awards = hist.data?.awards ?? [];
  const topScorers = hist.data?.topScorers ?? [];

  return (
    <>
      <Grid>
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Paper withBorder p="md">
            <Group gap="sm" mb="sm">
              <IconHistory size={20} />
              <Text fw={700}>Actas de temporada</Text>
            </Group>
            {records.length === 0 ? (
              <Text c="dimmed" size="sm">
                Aún no se ha cerrado ninguna temporada.
              </Text>
            ) : (
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Año</Table.Th>
                    <Table.Th>Campeón</Table.Th>
                    <Table.Th>División</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {records.map((r) => (
                    <Table.Tr key={`${r.anio}-${r.championTeamId}`}>
                      <Table.Td>{r.anio}</Table.Td>
                      <Table.Td>
                        <Link
                          to="/games/$gameId/teams/$teamId"
                          params={{ gameId, teamId: String(r.championTeamId) }}
                        >
                          {r.championName}
                        </Link>
                      </Table.Td>
                      <Table.Td>{r.divisionName ?? '—'}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 5 }}>
          <Paper withBorder p="md">
            <Text fw={700} mb="sm">
              Palmarés
            </Text>
            <Text size="xs" c="dimmed" mb="sm">
              Vista derivada de las actas (no se almacena).
            </Text>
            {palmares.length === 0 ? (
              <Text c="dimmed" size="sm">
                Sin títulos todavía.
              </Text>
            ) : (
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Equipo</Table.Th>
                    <Table.Th ta="right">Títulos</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {palmares.map((p) => (
                    <Table.Tr key={p.teamId}>
                      <Table.Td>{p.teamName}</Table.Td>
                      <Table.Td ta="right" fw={700}>
                        {p.titles}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Paper>
        </Grid.Col>
      </Grid>

      {palmares.length > 0 && (
        <PalmaresChart data={palmares} />
      )}

      <Grid mt="md">
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Paper withBorder p="md">
            <Text fw={700} mb="sm">
              Galardones por temporada (§6)
            </Text>
            {awards.length === 0 ? (
              <Text c="dimmed" size="sm">
                Aún no se han otorgado galardones.
              </Text>
            ) : (
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Año</Table.Th>
                    <Table.Th>Premio</Table.Th>
                    <Table.Th>Jugador</Table.Th>
                    <Table.Th>Equipo</Table.Th>
                    <Table.Th ta="right">Valor</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {awards.map((a, i) => (
                    <Table.Tr key={`${a.year}-${a.tipo}-${i}`}>
                      <Table.Td>{a.year}</Table.Td>
                      <Table.Td>
                        <Badge size="sm" variant="light" color="yellow">
                          {AWARD_LABEL[a.tipo]}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{a.playerName}</Table.Td>
                      <Table.Td>{a.teamName}</Table.Td>
                      <Table.Td ta="right" fw={700}>
                        {a.valor}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 5 }}>
          <Paper withBorder p="md">
            <Text fw={700} mb="sm">
              Ranking histórico de goleadores
            </Text>
            <Text size="xs" c="dimmed" mb="sm">
              Vista derivada de los galardones (no se almacena).
            </Text>
            {topScorers.length === 0 ? (
              <Text c="dimmed" size="sm">
                Sin ranking todavía.
              </Text>
            ) : (
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Jugador</Table.Th>
                    <Table.Th>Equipo</Table.Th>
                    <Table.Th ta="right">Pichichis</Table.Th>
                    <Table.Th ta="right">Goles tot.</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {topScorers.map((r) => (
                    <Table.Tr key={r.playerId}>
                      <Table.Td>{r.playerName}</Table.Td>
                      <Table.Td>{r.teamName}</Table.Td>
                      <Table.Td ta="right">{r.seasonsWon}</Table.Td>
                      <Table.Td ta="right" fw={700}>
                        {r.totalGoles}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Paper>
        </Grid.Col>
      </Grid>
    </>
  );
}
