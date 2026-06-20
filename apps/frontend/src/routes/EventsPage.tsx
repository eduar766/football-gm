import { Badge, Button, Group, Paper, Skeleton, Table, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { IconCheck, IconEye, IconEyeOff, IconX } from '@tabler/icons-react';
import type { EventAction, EventStatus, EventType } from '@football-gm/contracts';
import { api } from '../api';

const TIPO_LABEL: Record<EventType, string> = {
  arbitraje_dudoso: 'Polémica arbitral',
  incidente_aficion: 'Incidente de afición',
  declaraciones_polemicas: 'Declaraciones polémicas',
};

const STATUS_LABEL: Record<EventStatus, string> = {
  pendiente: 'Pendiente',
  resuelto_actuar: 'Resuelto (actuaste)',
  resuelto_ignorar: 'Resuelto (ignoraste)',
  caducado: 'Caducado',
};

const STATUS_COLOR: Record<EventStatus, string> = {
  pendiente: 'yellow',
  resuelto_actuar: 'green',
  resuelto_ignorar: 'gray',
  caducado: 'red',
};

export function EventsPage() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);
  const qc = useQueryClient();

  const evs = useQuery({ queryKey: ['events', id], queryFn: () => api.events(id) });

  const resolve = useMutation({
    mutationFn: (v: { eventId: number; action: EventAction }) =>
      api.resolveEvent(id, v.eventId, v.action),
    onSuccess: () => {
      notifications.show({
        color: 'green',
        icon: <IconCheck size={18} />,
        title: 'Éxito',
        message: 'Evento resuelto',
      });
      qc.invalidateQueries({
        predicate: (q) =>
          ['events', 'summary', 'economy', 'teams', 'federation'].includes(
            q.queryKey[0] as string,
          ),
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

  if (evs.isLoading) {
    return (
      <>
        <Skeleton height={60} radius="md" mb="md" />
        <Skeleton height={200} radius="md" mb="md" />
        <Skeleton height={200} radius="md" />
      </>
    );
  }

  const pending = evs.data?.pending ?? [];
  const recent = evs.data?.recent ?? [];

  return (
    <div className="page-enter">
      <Paper withBorder p="md" mb="md">
        <Text fw={700}>Eventos y polémicas (§1, §2)</Text>
        <Text size="xs" c="dimmed">
          Conflictos puntuales que el comisionado resuelve. Actuar cuesta dinero
          (1 M€) y arraigo del equipo; ignorar resta prestigio. Si los dejas
          pendientes al cierre, caducan y la imagen sufre más.
        </Text>
      </Paper>

      <Paper withBorder p="md" mb="md">
        <Group justify="space-between" mb="sm">
          <Text fw={700}>Pendientes</Text>
          <Badge color="yellow" variant="light">
            {pending.length}
          </Badge>
        </Group>
        {pending.length === 0 ? (
          <Text c="dimmed" size="sm">
            Sin incidentes abiertos.
          </Text>
        ) : (
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Año/Jorn.</Table.Th>
                <Table.Th>Tipo</Table.Th>
                <Table.Th>Equipo</Table.Th>
                <Table.Th>Detalle</Table.Th>
                <Table.Th ta="right">Acción</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {pending.map((e) => (
                <Table.Tr key={e.id}>
                  <Table.Td>
                    {e.year} / J{e.matchday}
                  </Table.Td>
                  <Table.Td>{TIPO_LABEL[e.tipo]}</Table.Td>
                  <Table.Td>{e.teamName ?? '—'}</Table.Td>
                  <Table.Td>{e.message}</Table.Td>
                  <Table.Td ta="right">
                    <Group gap="xs" justify="flex-end">
                      <Button
                        size="compact-xs"
                        color="blue"
                        variant="light"
                        loading={
                          resolve.isPending &&
                          resolve.variables?.eventId === e.id &&
                          resolve.variables?.action === 'actuar'
                        }
                        leftSection={<IconEye size={12} />}
                        onClick={() =>
                          modals.openConfirmModal({
                            title: 'Actuar sobre el evento',
                            children: (
                              <Text size="sm">
                                Actuar costará 1 M€ y reducirá el arraigo del equipo. ¿Continuar?
                              </Text>
                            ),
                            labels: { confirm: 'Actuar', cancel: 'Volver' },
                            confirmProps: { color: 'blue' },
                            onConfirm: () =>
                              resolve.mutate({ eventId: e.id, action: 'actuar' }),
                          })
                        }
                      >
                        Actuar (−1 M€)
                      </Button>
                      <Button
                        size="compact-xs"
                        color="gray"
                        variant="subtle"
                        loading={
                          resolve.isPending &&
                          resolve.variables?.eventId === e.id &&
                          resolve.variables?.action === 'ignorar'
                        }
                        leftSection={<IconEyeOff size={12} />}
                        onClick={() =>
                          modals.openConfirmModal({
                            title: 'Ignorar el evento',
                            children: (
                              <Text size="sm">
                                Ignorar resta 1 punto de prestigio y puede afectar la imagen de la federación. ¿Continuar?
                              </Text>
                            ),
                            labels: { confirm: 'Ignorar', cancel: 'Volver' },
                            confirmProps: { color: 'gray' },
                            onConfirm: () =>
                              resolve.mutate({ eventId: e.id, action: 'ignorar' }),
                          })
                        }
                      >
                        Ignorar (−1 prestigio)
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      <Paper withBorder p="md">
        <Text fw={700} mb="sm">
          Resueltos recientes
        </Text>
        {recent.length === 0 ? (
          <Text c="dimmed" size="sm">
            Sin historial todavía.
          </Text>
        ) : (
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Año/Jorn.</Table.Th>
                <Table.Th>Tipo</Table.Th>
                <Table.Th>Equipo</Table.Th>
                <Table.Th>Desenlace</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {recent.map((e) => (
                <Table.Tr key={e.id}>
                  <Table.Td>
                    {e.year} / J{e.matchday}
                  </Table.Td>
                  <Table.Td>{TIPO_LABEL[e.tipo]}</Table.Td>
                  <Table.Td>{e.teamName ?? '—'}</Table.Td>
                  <Table.Td>
                    <Badge size="sm" variant="light" color={STATUS_COLOR[e.status]}>
                      {STATUS_LABEL[e.status]}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </div>
  );
}
