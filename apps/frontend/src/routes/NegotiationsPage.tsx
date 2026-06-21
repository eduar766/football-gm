import { Box, Group, Paper, Skeleton, Stack, Text } from '@mantine/core';
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

const STAGE_CONFIG: Record<EngineNegotiationState, { color: string; icon: string; order: number }> = {
  gathering_requirements: { color: '#3B82F6', icon: '01', order: 0 },
  offer: { color: '#F59E0B', icon: '02', order: 1 },
  accepted: { color: '#10B981', icon: '03', order: 2 },
  effective: { color: '#10B981', icon: '04', order: 3 },
  rejected: { color: '#EF4444', icon: '✗', order: 4 },
};

const STEPS = ['gathering_requirements', 'offer', 'accepted', 'effective'] as const;

export function NegotiationsPage() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);
  const negs = useQuery({
    queryKey: ['negotiations', id],
    queryFn: () => api.negotiations(id),
  });

  if (negs.isLoading) {
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
        <Group gap="sm">
          <IconArrowsExchange size={22} color="#10B981" />
          <Text
            fw={800}
            style={{
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              fontSize: '28px',
              color: '#F9FAFB',
            }}
          >
            Negociaciones
          </Text>
        </Group>
        <Text size="sm" c="dimmed" mt="xs" ml={34}>
          Ciclo: requisitos (1–3 años) → oferta → aceptada → efectiva dos años
          después de aceptar (§4.2).
        </Text>
      </Paper>

      {negs.data && negs.data.length === 0 ? (
        <Paper p="md" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          <Text c="dimmed">
            Sin negociaciones. Inicia una desde el Mercado.
          </Text>
        </Paper>
      ) : (
        <Stack gap="md">
          {negs.data?.map((n, i) => {
            const cfg = STAGE_CONFIG[n.state];
            const currentIdx = STEPS.indexOf(n.state as typeof STEPS[number]);

            return (
              <Paper
                key={n.id}
                p="md"
                className="stagger-item"
                style={{
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderLeft: `3px solid ${cfg.color}`,
                  background: n.state !== 'rejected' ? 'rgba(255,255,255,0.02)' : 'transparent',
                  animationDelay: `${i * 50}ms`,
                }}
              >
                <Group justify="space-between" mb="md">
                  <div>
                    <Text fw={700} size="lg">{n.targetTeamName}</Text>
                    <Text size="sm" c="dimmed">Desde {n.fromFederationName}</Text>
                  </div>
                  <Box
                    style={{
                      padding: '4px 14px',
                      borderRadius: 14,
                      background: `${cfg.color}20`,
                      color: cfg.color,
                      fontWeight: 700,
                      fontSize: '13px',
                    }}
                  >
                    {LABEL[n.state]}
                  </Box>
                </Group>

                <Group gap={0} mb="sm">
                  {STEPS.map((step, i) => {
                    const isActive = step === n.state;
                    const isCompleted = currentIdx > i;
                    const isRejected = n.state === 'rejected';
                    const color = isRejected ? '#EF4444' : isCompleted || isActive ? '#10B981' : 'rgba(255,255,255,0.15)';

                    return (
                      <Group key={step} gap={0} style={{ flex: 1 }}>
                        <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <Box
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              background: isActive
                                ? `${cfg.color}30`
                                : isCompleted
                                  ? 'rgba(16,185,129,0.15)'
                                  : 'rgba(255,255,255,0.06)',
                              border: `2px solid ${color}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              animation: isActive ? 'pulse 2s ease-in-out infinite' : undefined,
                            }}
                          >
                            <Text fw={700} style={{ fontFamily: '"Geist Mono", monospace', fontSize: '11px', color }}>
                              {isCompleted ? '✓' : i + 1}
                            </Text>
                          </Box>
                          <Text size="xs" c="dimmed" style={{ fontSize: '10px', textAlign: 'center', maxWidth: 60 }}>
                            {step === 'gathering_requirements' ? 'Req.' : step === 'offer' ? 'Oferta' : step === 'accepted' ? 'Acept.' : 'Efect.'}
                          </Text>
                        </Box>
                        {i < STEPS.length - 1 && (
                          <Box
                            style={{
                              flex: 1,
                              height: 2,
                              background: isCompleted ? '#10B981' : 'rgba(255,255,255,0.1)',
                              margin: '0 4px',
                              marginBottom: 18,
                            }}
                          />
                        )}
                      </Group>
                    );
                  })}
                </Group>

                <Group gap="md" mt="sm">
                  <Text size="xs" c="dimmed">
                    Inicio:{' '}
                    <span style={{ fontFamily: '"Geist Mono", monospace', color: '#F9FAFB' }}>
                      {n.startedYear}
                    </span>
                  </Text>
                  {n.state === 'gathering_requirements' && (
                    <Text size="xs" c="dimmed">
                      Req. restantes:{' '}
                      <span style={{ fontFamily: '"Geist Mono", monospace', color: '#F59E0B' }}>
                        {n.requirementsSeasonsLeft}
                      </span>
                    </Text>
                  )}
                  {n.acceptedYear && (
                    <Text size="xs" c="dimmed">
                      Aceptada:{' '}
                      <span style={{ fontFamily: '"Geist Mono", monospace', color: '#10B981' }}>
                        {n.acceptedYear}
                      </span>
                    </Text>
                  )}
                  {n.effectiveYear && (
                    <Text size="xs" c="dimmed">
                      Efectiva:{' '}
                      <span style={{ fontFamily: '"Geist Mono", monospace', color: '#10B981' }}>
                        {n.effectiveYear}
                      </span>
                    </Text>
                  )}
                </Group>
              </Paper>
            );
          })}
        </Stack>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.4); }
          50% { box-shadow: 0 0 0 8px rgba(16,185,129,0); }
        }
      `}</style>
    </div>
  );
}
