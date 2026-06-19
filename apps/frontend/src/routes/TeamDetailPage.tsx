import {
  Badge,
  Card,
  Grid,
  Group,
  Paper,
  SimpleGrid,
  Skeleton,
  Table,
  Text,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { IconTrophy } from '@tabler/icons-react';
import { api } from '../api';
import { money as fmtMoney } from '../utils/format';

const num = (n: number) => n.toLocaleString('es-ES');

function Attr({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <Text size="xs" c="dimmed" tt="uppercase">
        {label}
      </Text>
      <Text fw={600}>{value}</Text>
    </div>
  );
}

export function TeamDetailPage() {
  const { gameId, teamId } = useParams({ strict: false }) as {
    gameId: string;
    teamId: string;
  };
  const id = Number(gameId);
  const tid = Number(teamId);
  const team = useQuery({
    queryKey: ['team', id, tid],
    queryFn: () => api.team(id, tid),
  });

  if (team.isLoading || !team.data) {
    return (
      <Grid>
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Skeleton height={300} radius="md" />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Skeleton height={250} radius="md" mb="md" />
          <Skeleton height={150} radius="md" />
        </Grid.Col>
      </Grid>
    );
  }

  const t = team.data;

  return (
    <Grid>
      <Grid.Col span={{ base: 12, md: 5 }}>
        <Card withBorder>
          <Group gap="sm">
            <IconTrophy size={20} />
            <Text size="xl" fw={800}>
              {t.name}
            </Text>
          </Group>
          <Text size="sm" c="dimmed" mb="md">
            {t.federationName ?? 'Sin federación'} · {t.divisionName ?? 'Sin división'}
          </Text>
          <SimpleGrid cols={2} spacing="sm">
            <Attr label="Fuerza" value={t.strength} />
            <Attr label="Prestigio" value={t.prestige} />
            <Attr label="Arraigo" value={t.arraigo} />
            <Attr label="Presupuesto" value={fmtMoney(t.presupuesto)} />
            <Attr label="Afición" value={num(t.aficion)} />
            <Attr
              label="Estadio"
              value={`${t.estadioNombre ?? '—'} (${num(t.estadioAforo ?? 0)})`}
            />
          </SimpleGrid>
          <Text size="xs" c="dimmed" tt="uppercase" mt="md" mb={4}>
            Estructura del club
          </Text>
          <SimpleGrid cols={2} spacing="sm">
            <Attr label="Cantera" value={t.academiaRating} />
            <Attr label="Cuerpo médico" value={t.medicoRating} />
            <Attr label="Ojeadores" value={t.ojeadoresRating} />
            <Attr label="Cuerpo técnico" value={t.cuerpoTecnicoRating} />
          </SimpleGrid>
        </Card>
      </Grid.Col>

      <Grid.Col span={{ base: 12, md: 7 }}>
        <Paper withBorder p="md" mb="md">
          <Group justify="space-between" mb="sm">
            <Text fw={700}>Plantilla</Text>
            <Text size="sm" c="dimmed">
              {t.squad.length} jugadores
            </Text>
          </Group>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Pos</Table.Th>
                <Table.Th>Jugador</Table.Th>
                <Table.Th ta="right">Calidad</Table.Th>
                <Table.Th ta="right">TA</Table.Th>
                <Table.Th ta="right">TR</Table.Th>
                <Table.Th ta="right">Estado</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {t.squad.map((p) => {
                const unavailable =
                  p.matchesSuspendedLeft > 0 || p.injuredMatchesLeft > 0;
                return (
                  <Table.Tr key={p.id} c={unavailable ? 'red' : undefined}>
                    <Table.Td>{p.posicion}</Table.Td>
                    <Table.Td>{p.name}</Table.Td>
                    <Table.Td ta="right" fw={600}>
                      {p.calidad}
                    </Table.Td>
                    <Table.Td ta="right">{p.yellowCardsThisSeason || ''}</Table.Td>
                    <Table.Td ta="right">{p.redCardsThisSeason || ''}</Table.Td>
                    <Table.Td ta="right">
                      {p.injuredMatchesLeft > 0 ? (
                        <Badge size="xs" color="red" variant="light">
                          Lesionado ({p.injuredMatchesLeft})
                        </Badge>
                      ) : p.matchesSuspendedLeft > 0 ? (
                        <Badge size="xs" color="orange" variant="light">
                          Sancionado ({p.matchesSuspendedLeft})
                        </Badge>
                      ) : null}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Paper>

        <Paper withBorder p="md">
          <Text fw={700} mb="sm">
            Trayectoria
          </Text>
          {t.trajectory.length === 0 ? (
            <Text c="dimmed" size="sm">
              Sin temporadas cerradas todavía.
            </Text>
          ) : (
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Año</Table.Th>
                  <Table.Th>División</Table.Th>
                  <Table.Th ta="right">Puesto</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {t.trajectory.map((r) => (
                  <Table.Tr key={r.anio}>
                    <Table.Td>{r.anio}</Table.Td>
                    <Table.Td>{r.divisionOrden ?? '—'}</Table.Td>
                    <Table.Td ta="right">{r.puestoFinal}º</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Paper>
      </Grid.Col>
    </Grid>
  );
}
