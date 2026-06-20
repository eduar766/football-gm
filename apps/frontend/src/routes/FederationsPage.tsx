import { Badge, Group, Paper, Skeleton, Table, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { IconBuilding } from '@tabler/icons-react';
import { api } from '../api';

export function FederationsPage() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);
  const feds = useQuery({
    queryKey: ['federations', id],
    queryFn: () => api.federations(id),
  });

  if (feds.isLoading) {
    return (
      <Paper withBorder p="md">
        <Group gap="sm" mb="sm">
          <IconBuilding size={20} />
          <Text fw={700}>Federaciones</Text>
        </Group>
        <Skeleton height={40} mb="xs" />
        <Skeleton height={40} mb="xs" />
        <Skeleton height={40} mb="xs" />
        <Skeleton height={40} mb="xs" />
        <Skeleton height={40} mb="xs" />
      </Paper>
    );
  }

  return (
    <Paper withBorder p="md" className="page-enter">
      <Group gap="sm" mb="sm">
        <IconBuilding size={20} />
        <Text fw={700}>Federaciones</Text>
      </Group>
      <Text size="xs" c="dimmed" mb="md">
        Tu federación y las rivales son el mismo modelo (§3). Robar un equipo
        mueve prestigio de una a otra.
      </Text>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Federación</Table.Th>
            <Table.Th ta="right">Prestigio</Table.Th>
            <Table.Th ta="right">Tier</Table.Th>
            <Table.Th ta="right">Equipos</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {feds.data?.map((f) => (
            <Table.Tr key={f.id}>
              <Table.Td fw={f.isPlayer ? 700 : 400}>{f.name}</Table.Td>
              <Table.Td ta="right">{f.prestige}</Table.Td>
              <Table.Td ta="right">
                <Badge size="sm" variant="light" color="yellow">
                  {f.tier}
                </Badge>
              </Table.Td>
              <Table.Td ta="right">{f.teamCount}</Table.Td>
              <Table.Td ta="right">
                {f.isPlayer && <Badge size="sm">Tú</Badge>}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}
