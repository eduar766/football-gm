import { Badge, Button, Group, Paper, Skeleton, Table, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { IconCheck, IconUserPlus, IconX } from '@tabler/icons-react';
import { api } from '../api';

export function MarketPage() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);
  const qc = useQueryClient();

  const market = useQuery({ queryKey: ['market', id], queryFn: () => api.market(id) });

  const start = useMutation({
    mutationFn: (teamId: number) => api.startNegotiation(id, teamId),
    onSuccess: () => {
      notifications.show({
        color: 'green',
        icon: <IconCheck size={18} />,
        title: 'Éxito',
        message: 'Negociación iniciada',
      });
      qc.invalidateQueries({
        predicate: (q) =>
          ['market', 'negotiations', 'summary'].includes(q.queryKey[0] as string),
      });
    },
    onError: (error: Error) => {
      notifications.show({
        color: 'red',
        icon: <IconX size={18} />,
        title: 'Error',
        message: error.message,
      });
    },
  });

  if (market.isLoading) {
    return <Skeleton height={300} radius="md" />;
  }

  return (
    <Paper withBorder p="md">
      <Group justify="space-between" mb="sm">
        <Text fw={700}>Mercado de adhesiones</Text>
        <Badge variant="light" color="yellow">
          Tu tier: {market.data?.playerTier ?? '—'}
        </Badge>
      </Group>
      <Text size="xs" c="dimmed" mb="md">
        Solo puedes negociar equipos de tu tier o inferior (§4.1). Adherir un
        equipo tarda años y mueve prestigio entre federaciones.
      </Text>

      {market.data && market.data.teams.length === 0 ? (
        <Text c="dimmed">
          No hay equipos negociables ahora mismo (sube de tier o espera).
        </Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Equipo</Table.Th>
              <Table.Th>Federación actual</Table.Th>
              <Table.Th ta="right">Tier</Table.Th>
              <Table.Th ta="right">Fuerza</Table.Th>
              <Table.Th ta="right">Arraigo</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {market.data?.teams.map((t) => (
              <Table.Tr key={t.teamId}>
                <Table.Td>{t.name}</Table.Td>
                <Table.Td>{t.currentFederationName}</Table.Td>
                <Table.Td ta="right">{t.tier}</Table.Td>
                <Table.Td ta="right">{t.strength}</Table.Td>
                <Table.Td ta="right">
                  <Badge
                    size="sm"
                    variant="light"
                    color={t.arraigo >= 70 ? 'red' : t.arraigo >= 40 ? 'yellow' : 'green'}
                  >
                    {t.arraigo}
                  </Badge>
                </Table.Td>
                <Table.Td ta="right">
                  <Button
                    size="xs"
                    variant="light"
                    loading={start.isPending && start.variables === t.teamId}
                    leftSection={<IconUserPlus size={14} />}
                    onClick={() => start.mutate(t.teamId)}
                  >
                    Iniciar negociación
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Paper>
  );
}
