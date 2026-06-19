import { Badge, Card, Group, Paper, Skeleton, Table, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { IconBuilding } from '@tabler/icons-react';
import { api } from '../api';

export function FederationPage() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);
  const fed = useQuery({
    queryKey: ['federation', id],
    queryFn: () => api.federation(id),
  });

  if (fed.isLoading || !fed.data) {
    return (
      <>
        <Skeleton height={120} radius="md" mb="md" />
        <Skeleton height={200} radius="md" />
      </>
    );
  }

  const f = fed.data;

  return (
    <>
      <Card withBorder mb="md">
        <Group justify="space-between">
          <div>
            <Group gap="sm">
              <IconBuilding size={20} />
              <Text size="xl" fw={800}>
                {f.name}
              </Text>
            </Group>
            <Text size="sm" c="dimmed">
              {f.leagueName ?? 'Sin liga'} · {f.teamCount} equipos
            </Text>
          </div>
          <Group>
            <Badge size="lg" variant="light">
              Prestigio {f.prestige}
            </Badge>
            <Badge size="lg" color="yellow" variant="light">
              Tier {f.tier}
            </Badge>
            {f.isPlayer && <Badge size="lg">Tu federación</Badge>}
          </Group>
        </Group>
      </Card>

      <Paper withBorder p="md">
        <Text fw={700} mb="sm">
          Divisiones
        </Text>
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th ta="right">Orden</Table.Th>
              <Table.Th>Nombre</Table.Th>
              <Table.Th ta="right">Plazas</Table.Th>
              <Table.Th ta="right">Equipos</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {f.divisions.map((d) => (
              <Table.Tr key={d.id}>
                <Table.Td ta="right">{d.orden}</Table.Td>
                <Table.Td>{d.name}</Table.Td>
                <Table.Td ta="right">{d.plazas}</Table.Td>
                <Table.Td ta="right">{d.teamCount}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>
    </>
  );
}
