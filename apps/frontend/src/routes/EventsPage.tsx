import { Box, Button, Group, Paper, Skeleton, Stack, Table, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { IconAlertTriangle, IconEye, IconEyeOff } from '@tabler/icons-react';
import { EmptyState } from '../components/EmptyState';
import type { EventAction, EventStatus, EventType } from '@football-gm/contracts';
import { api } from '../api';
import { useMutationWithFeedback } from '../useMutationWithFeedback';
import { QK } from '../query-keys';
import { PageHero } from '../components/PageHero';

const TIPO_LABEL: Record<EventType, string> = {
  arbitraje_dudoso: 'Polémica arbitral',
  incidente_aficion: 'Incidente de afición',
  declaraciones_polemicas: 'Declaraciones polémicas',
  doping_positivo: 'Dopaje positivo',
  conflicto_jugadores: 'Conflicto de jugadores',
  crisis_economica_club: 'Crisis económica del club',
  escandalo_directiva: 'Escándalo de directiva',
  manipulacion_resultados: 'Manipulación de resultados',
};

const TIPO_COLOR: Record<EventType, string> = {
  arbitraje_dudoso: '#F59E0B',
  incidente_aficion: '#EF4444',
  declaraciones_polemicas: '#8B5CF6',
  doping_positivo: '#EF4444',
  conflicto_jugadores: '#F97316',
  crisis_economica_club: '#DC2626',
  escandalo_directiva: '#8B5CF6',
  manipulacion_resultados: '#EF4444',
};

function ignorePrestigeCost(severity: string): number {
  if (severity === 'alta') return 4;
  if (severity === 'media') return 2;
  return 1;
}

const STATUS_LABEL: Record<EventStatus, string> = {
  pendiente: 'Pendiente',
  resuelto_actuar: 'Resuelto (actuaste)',
  resuelto_ignorar: 'Resuelto (ignoraste)',
  caducado: 'Caducado',
};

const STATUS_CONFIG: Record<EventStatus, { color: string; gradient: string }> = {
  pendiente: { color: '#F59E0B', gradient: 'linear-gradient(135deg, #D97706, #F59E0B)' },
  resuelto_actuar: { color: '#10B981', gradient: 'linear-gradient(135deg, #059669, #10B981)' },
  resuelto_ignorar: { color: '#6B7280', gradient: 'linear-gradient(135deg, #4B5563, #6B7280)' },
  caducado: { color: '#EF4444', gradient: 'linear-gradient(135deg, #DC2626, #EF4444)' },
};

export function EventsPage() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);

  const evs = useQuery({ queryKey: QK.events(id), queryFn: () => api.events(id) });

  const resolve = useMutationWithFeedback({
    mutationFn: (v: { eventId: number; action: EventAction }) =>
      api.resolveEvent(id, v.eventId, v.action),
    queryKeyToInvalidate: ['events', 'summary', 'economy', 'teams', 'federation'],
    successMessage: 'Evento resuelto',
  });

  if (evs.isLoading) {
    return (
      <div className="page-enter">
        <Skeleton height={120} radius="md" mb="md" />
        <Skeleton height={200} radius="md" mb="md" />
        <Skeleton height={200} radius="md" />
      </div>
    );
  }

  const pending = evs.data?.pending ?? [];
  const recent = evs.data?.recent ?? [];

  return (
    <div className="page-enter">
      <PageHero
        icon={IconAlertTriangle}
        iconColor="#F59E0B"
        title="Eventos y polémicas"
        subtitle="Conflictos puntuales que el comisionado resuelve. Actuar cuesta dinero (1 M€) y arraigo del equipo; ignorar resta prestigio. Si los dejas pendientes al cierre, caducan y la imagen sufre más."
      />

      <Paper p="md" mb="md" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
        <Group justify="space-between" mb="sm">
          <Text fw={700}>Pendientes</Text>
          <Box
            style={{
              padding: '2px 12px',
              borderRadius: 14,
              background: 'rgba(245,158,11,0.15)',
              color: '#F59E0B',
              fontFamily: 'var(--mantine-font-family-monospace)',
              fontWeight: 700,
              fontSize: '13px',
            }}
          >
            {pending.length}
          </Box>
        </Group>
        {pending.length === 0 ? (
          <EmptyState
            icon={IconEye}
            title="Sin incidentes abiertos"
            description="No hay polémicas pendientes de resolver. Aparecerán aquí durante la temporada."
          />
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Año/Jorn.</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tipo</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Equipo</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Detalle</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Acción</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {pending.map((e, i) => {
                const severityColor = e.severity === 'alta' ? '#EF4444' : e.severity === 'media' ? '#F97316' : '#F59E0B';
                const borderColor = e.severity === 'alta' ? '#EF4444' : e.severity === 'media' ? '#F97316' : TIPO_COLOR[e.tipo];
                return (
                  <Table.Tr
                    key={e.id}
                    className="stagger-item"
                    style={{
                      borderLeft: `3px solid ${borderColor}`,
                      background: 'rgba(245,158,11,0.04)',
                      animationDelay: `${i * 50}ms`,
                    }}
                  >
                    <Table.Td>
                      <Text style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>{e.year} / J{e.matchday}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        <Box
                          style={{
                            display: 'inline-flex',
                            padding: '2px 10px',
                            borderRadius: 12,
                            background: `${TIPO_COLOR[e.tipo]}20`,
                            color: TIPO_COLOR[e.tipo],
                            fontWeight: 600,
                            fontSize: '12px',
                          }}
                        >
                          {TIPO_LABEL[e.tipo]}
                        </Box>
                        {e.severity && (
                          <Box
                            style={{
                              display: 'inline-flex',
                              padding: '2px 8px',
                              borderRadius: 12,
                              background: `${severityColor}20`,
                              color: severityColor,
                              fontWeight: 600,
                              fontSize: '11px',
                            }}
                          >
                            {e.severity}
                          </Box>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td fw={500}>{e.teamName ?? '—'}</Table.Td>
                    <Table.Td>
                      <Stack gap={2}>
                        <Text c="dimmed" size="sm">{e.message}</Text>
                        {e.status === 'pendiente' && (
                          <Text size="xs" fw={600} style={{ color: '#F59E0B' }}>
                            {e.effectDescription}
                          </Text>
                        )}
                        {e.chainedFromId != null && (
                          <Text size="xs" c="dimmed" ml="md" style={{ fontStyle: 'italic' }}>
                            Cadena de: evento #{e.chainedFromId}
                          </Text>
                        )}
                      </Stack>
                    </Table.Td>
                  <Table.Td ta="right">
                    <Group gap="xs" justify="flex-end">
                      <Button
                        size="compact-xs"
                        variant="gradient"
                        gradient={{ from: '#3B82F6', to: '#2563EB' }}
                        loading={resolve.isPending && resolve.variables?.eventId === e.id && resolve.variables?.action === 'actuar'}
                        leftSection={<IconEye size={12} />}
                        onClick={() =>
                          modals.openConfirmModal({
                            title: 'Actuar sobre el evento',
                            children: (
                              <Text size="sm">{e.effectDescription} ¿Continuar?</Text>
                            ),
                            labels: { confirm: 'Actuar', cancel: 'Volver' },
                            confirmProps: { color: 'blue' },
                            onConfirm: () => resolve.mutate({ eventId: e.id, action: 'actuar' }),
                          })
                        }
                      >
                        Actuar (−1 M€)
                      </Button>
                      <Button
                        size="compact-xs"
                        color="gray"
                        variant="subtle"
                        loading={resolve.isPending && resolve.variables?.eventId === e.id && resolve.variables?.action === 'ignorar'}
                        leftSection={<IconEyeOff size={12} />}
                        onClick={() =>
                          modals.openConfirmModal({
                            title: 'Ignorar el evento',
                            children: (
                              <Text size="sm">Ignorar resta {ignorePrestigeCost(e.severity)} punto{ignorePrestigeCost(e.severity) > 1 ? 's' : ''} de prestigio y puede afectar la imagen de la federación. ¿Continuar?</Text>
                            ),
                            labels: { confirm: 'Ignorar', cancel: 'Volver' },
                            confirmProps: { color: 'gray' },
                            onConfirm: () => resolve.mutate({ eventId: e.id, action: 'ignorar' }),
                          })
                        }
                      >
                        Ignorar (−{ignorePrestigeCost(e.severity)} prestigio)
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
              })}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      <Paper p="md" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
        <Text fw={700} mb="sm">
          Resueltos recientes
        </Text>
        {recent.length === 0 ? (
          <Text c="dimmed" size="sm">Sin historial todavía.</Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Año/Jorn.</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tipo</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Equipo</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Desenlace</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {recent.map((e, i) => {
                const sc = STATUS_CONFIG[e.status];
                const severityColor = e.severity === 'alta' ? '#EF4444' : e.severity === 'media' ? '#F97316' : '#F59E0B';
                return (
                  <Table.Tr
                    key={e.id}
                    className="stagger-item"
                    style={{
                      borderLeft: `3px solid ${sc.color}40`,
                      animationDelay: `${i * 50}ms`,
                    }}
                  >
                    <Table.Td>
                      <Text style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>{e.year} / J{e.matchday}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        <Box
                          style={{
                            display: 'inline-flex',
                            padding: '2px 10px',
                            borderRadius: 12,
                            background: `${TIPO_COLOR[e.tipo]}20`,
                            color: TIPO_COLOR[e.tipo],
                            fontWeight: 600,
                            fontSize: '12px',
                          }}
                        >
                          {TIPO_LABEL[e.tipo]}
                        </Box>
                        {e.severity && (
                          <Box
                            style={{
                              display: 'inline-flex',
                              padding: '2px 8px',
                              borderRadius: 12,
                              background: `${severityColor}20`,
                              color: severityColor,
                              fontWeight: 600,
                              fontSize: '11px',
                            }}
                          >
                            {e.severity}
                          </Box>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td fw={500}>{e.teamName ?? '—'}</Table.Td>
                    <Table.Td>
                      <Stack gap={2}>
                        <Box
                          style={{
                            display: 'inline-flex',
                            padding: '2px 10px',
                            borderRadius: 12,
                            background: sc.gradient,
                            color: '#fff',
                            fontWeight: 600,
                            fontSize: '12px',
                            alignSelf: 'flex-start',
                          }}
                        >
                          {STATUS_LABEL[e.status]}
                        </Box>
                        {e.chainedFromId != null && (
                          <Text size="xs" c="dimmed" ml="md" style={{ fontStyle: 'italic' }}>
                            Cadena de: evento #{e.chainedFromId}
                          </Text>
                        )}
                      </Stack>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </div>
  );
}
