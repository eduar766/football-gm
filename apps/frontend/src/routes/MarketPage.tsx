import { Box, Button, Group, Paper, Skeleton, Table, Text } from '@mantine/core';
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
    return (
      <div className="page-enter">
        <Skeleton height={120} radius="md" mb="md" />
        <Skeleton height={300} radius="md" />
      </div>
    );
  }

  return (
    <div className="page-enter">
      <Paper
        p="xl"
        mb="md"
        style={{
          background: 'linear-gradient(135deg, #111820 0%, #0D2818 100%)',
          border: '1px solid rgba(16,185,129,0.2)',
        }}
      >
        <Group justify="space-between">
          <div>
            <Text
              fw={800}
              style={{
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                fontSize: '28px',
                color: '#F9FAFB',
              }}
            >
              Mercado de adhesiones
            </Text>
            <Text size="sm" c="dimmed" mt="xs">
              Solo puedes negociar equipos de tu tier o inferior (§4.1). Adherir un
              equipo tarda años y mueve prestigio entre federaciones.
            </Text>
          </div>
          <Box
            style={{
              padding: '6px 16px',
              borderRadius: 16,
              background: 'linear-gradient(135deg, #D97706, #F59E0B)',
              color: '#fff',
              fontFamily: '"Geist Mono", monospace',
              fontWeight: 700,
              fontSize: '14px',
            }}
          >
            Tier {market.data?.playerTier ?? '—'}
          </Box>
        </Group>
      </Paper>

      {market.data && market.data.teams.length === 0 ? (
        <Paper p="md" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          <Text c="dimmed">
            No hay equipos negociables ahora mismo (sube de tier o espera).
          </Text>
        </Paper>
      ) : (
        <Paper p="md" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Equipo</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Federación actual</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Tier</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Fuerza</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Arraigo</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {market.data?.teams.map((t, i) => (
                <Table.Tr
                  key={t.teamId}
                  className="stagger-item"
                  style={{
                    borderLeft: '3px solid transparent',
                    transition: 'border-color 0.15s, background 0.15s',
                    background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                    animationDelay: `${i * 50}ms`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderLeftColor = '#10B981';
                    e.currentTarget.style.background = 'rgba(16,185,129,0.04)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderLeftColor = 'transparent';
                    e.currentTarget.style.background = i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent';
                  }}
                >
                  <Table.Td fw={600}>{t.name}</Table.Td>
                  <Table.Td c="dimmed">{t.currentFederationName}</Table.Td>
                  <Table.Td ta="right">
                    <Box
                      style={{
                        display: 'inline-flex',
                        padding: '2px 10px',
                        borderRadius: 12,
                        background: 'rgba(107,114,128,0.15)',
                        color: '#9CA3AF',
                        fontFamily: '"Geist Mono", monospace',
                        fontWeight: 700,
                        fontSize: '13px',
                      }}
                    >
                      {t.tier}
                    </Box>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text fw={700} style={{ fontFamily: '"Geist Mono", monospace', color: t.strength >= 70 ? '#10B981' : t.strength >= 50 ? '#F59E0B' : '#EF4444' }}>
                      {t.strength}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Group gap="xs" justify="flex-end" wrap="nowrap">
                      <Box
                        style={{
                          width: 60,
                          height: 6,
                          borderRadius: 3,
                          background: 'rgba(255,255,255,0.08)',
                          overflow: 'hidden',
                          flexShrink: 0,
                        }}
                      >
                        <Box
                          style={{
                            width: `${t.arraigo}%`,
                            height: '100%',
                            borderRadius: 3,
                            background: t.arraigo >= 70
                              ? 'linear-gradient(90deg, #DC2626, #EF4444)'
                              : t.arraigo >= 40
                                ? 'linear-gradient(90deg, #D97706, #F59E0B)'
                                : 'linear-gradient(90deg, #059669, #10B981)',
                          }}
                        />
                      </Box>
                      <Text fw={600} style={{ fontFamily: '"Geist Mono", monospace', fontSize: '13px', color: t.arraigo >= 70 ? '#EF4444' : t.arraigo >= 40 ? '#F59E0B' : '#10B981' }}>
                        {t.arraigo}
                      </Text>
                    </Group>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Button
                      size="xs"
                      variant="gradient"
                      gradient={{ from: '#10B981', to: '#059669' }}
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
        </Paper>
      )}
    </div>
  );
}
