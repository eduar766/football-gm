import { Badge, Group, Paper, Skeleton, Table, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { IconArrowsExchange } from '@tabler/icons-react';
import type { EngineNegotiationState } from '@football-gm/contracts';
import { api } from '../api';

const LABEL: Record<EngineNegotiationState, string> = {
  gathering_requirements: 'Recogiendo requisitos',
  offer: 'Oferta',
  accepted: 'Aceptada (pendiente adhesión)',
  effective: 'Adhesión efectiva',
  rejected: 'Rechazada',
};

const COLOR: Record<EngineNegotiationState, string> = {
  gathering_requirements: 'blue',
  offer: 'yellow',
  accepted: 'teal',
  effective: 'green',
  rejected: 'red',
};

export function NegotiationsPage() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);
  const negs = useQuery({
    queryKey: ['negotiations', id],
    queryFn: () => api.negotiations(id),
  });

  if (negs.isLoading) {
    return <Skeleton height={300} radius="md" />;
  }

  return (
    <Paper withBorder p="md" className="page-enter">
      <Group gap="sm" mb="sm">
        <IconArrowsExchange size={20} />
        <Text fw={700}>Negociaciones</Text>
      </Group>
      <Text size="xs" c="dimmed" mb="md">
        Ciclo: requisitos (1–3 años) → oferta → aceptada → efectiva dos años
        después de aceptar (§4.2).
      </Text>
      {negs.data && negs.data.length === 0 ? (
        <Text c="dimmed">
          Sin negociaciones. Inicia una desde el Mercado.
        </Text>
      ) : (
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Objetivo</Table.Th>
              <Table.Th>Desde</Table.Th>
              <Table.Th>Estado</Table.Th>
              <Table.Th ta="right">Inicio</Table.Th>
              <Table.Th ta="right">Req. restantes</Table.Th>
              <Table.Th ta="right">Aceptada</Table.Th>
              <Table.Th ta="right">Efectiva</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {negs.data?.map((n) => (
              <Table.Tr key={n.id}>
                <Table.Td>{n.targetTeamName}</Table.Td>
                <Table.Td>{n.fromFederationName}</Table.Td>
                <Table.Td>
                  <Badge variant="light" color={COLOR[n.state]}>
                    {LABEL[n.state]}
                  </Badge>
                </Table.Td>
                <Table.Td ta="right">{n.startedYear}</Table.Td>
                <Table.Td ta="right">
                  {n.state === 'gathering_requirements'
                    ? n.requirementsSeasonsLeft
                    : '—'}
                </Table.Td>
                <Table.Td ta="right">{n.acceptedYear ?? '—'}</Table.Td>
                <Table.Td ta="right">{n.effectiveYear ?? '—'}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Paper>
  );
}
