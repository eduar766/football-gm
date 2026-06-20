import { Group, Paper, Skeleton, Table, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { IconUsers } from '@tabler/icons-react';
import { api } from '../api';

export function TeamsPage() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);
  const teams = useQuery({ queryKey: ['teams', id], queryFn: () => api.teams(id) });

  if (teams.isLoading) {
    return (
      <Paper withBorder p="md">
        <Group gap="sm" mb="sm">
          <IconUsers size={20} />
          <Text fw={700}>Equipos</Text>
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
        <IconUsers size={20} />
        <Text fw={700}>Equipos</Text>
      </Group>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Equipo</Table.Th>
            <Table.Th>División</Table.Th>
            <Table.Th ta="right">Fuerza</Table.Th>
            <Table.Th ta="right">Prestigio</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {teams.data?.map((t) => (
            <Table.Tr key={t.id}>
              <Table.Td>
                <Link
                  to="/games/$gameId/teams/$teamId"
                  params={{ gameId, teamId: String(t.id) }}
                >
                  {t.name}
                </Link>
              </Table.Td>
              <Table.Td>{t.divisionName ?? '—'}</Table.Td>
              <Table.Td ta="right">{t.strength}</Table.Td>
              <Table.Td ta="right">{t.prestige}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}
