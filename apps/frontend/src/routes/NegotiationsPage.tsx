import { Box, Group, Paper, Skeleton, Stack, Tabs, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { IconArrowsExchange, IconCheck, IconHistory, IconRefresh, IconX } from '@tabler/icons-react';
import type { EngineNegotiationState, NegotiationDto } from '@football-gm/contracts';
import { api } from '../api';

const LABEL: Record<EngineNegotiationState, string> = {
  gathering_requirements: 'Recogiendo requisitos',
  offer: 'Oferta',
  accepted: 'Aceptada (pendiente adhesión)',
  effective: 'Adhesión efectiva',
  rejected: 'Rechazada',
};

const STAGE_CONFIG: Record<EngineNegotiationState, { color: string; order: number }> = {
  gathering_requirements: { color: '#3B82F6', order: 0 },
  offer: { color: '#F59E0B', order: 1 },
  accepted: { color: '#10B981', order: 2 },
  effective: { color: '#10B981', order: 3 },
  rejected: { color: '#EF4444', order: 4 },
};

const STEPS = ['gathering_requirements', 'offer', 'accepted', 'effective'] as const;

const ACTIVE_STATES = new Set<EngineNegotiationState>([
  'gathering_requirements',
  'offer',
  'accepted',
  'effective',
]);

function NegotiationCard({
  n,
  index,
  onRetry,
  retrying,
}: {
  n: NegotiationDto;
  index: number;
  onRetry?: (teamId: number) => void;
  retrying?: boolean;
}) {
  const cfg = STAGE_CONFIG[n.state];
  const currentIdx = STEPS.indexOf(n.state as (typeof STEPS)[number]);
  const isActive = ACTIVE_STATES.has(n.state);

  return (
    <Paper
      key={n.id}
      p="md"
      className="stagger-item"
      style={{
        border: '1px solid rgba(255,255,255,0.06)',
        borderLeft: `3px solid ${cfg.color}`,
        background: isActive ? 'rgba(255,255,255,0.02)' : 'transparent',
        animationDelay: `${index * 50}ms`,
      }}
    >
      <Group justify="space-between" mb="md">
        <div>
          <Text fw={700} size="lg">
            {n.targetTeamName}
          </Text>
          <Text size="sm" c="dimmed">
            Desde {n.fromFederationName}
          </Text>
        </div>
        <Group gap="sm">
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
          {n.state === 'rejected' && onRetry && (
            <Box
              component="button"
              onClick={() => onRetry(n.targetTeamId)}
              style={{
                padding: '4px 14px',
                borderRadius: 14,
                background: 'rgba(59,130,246,0.15)',
                color: '#3B82F6',
                border: '1px solid rgba(59,130,246,0.3)',
                fontWeight: 700,
                fontSize: '13px',
                cursor: retrying ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                opacity: retrying ? 0.5 : 1,
              }}
              disabled={retrying}
            >
              <IconRefresh size={13} />
              Reintentar
            </Box>
          )}
        </Group>
      </Group>

      {isActive && (
        <Group gap={0} mb="sm">
          {STEPS.map((step, i) => {
            const isStepActive = step === n.state;
            const isCompleted = currentIdx > i;
            const color = isCompleted || isStepActive ? '#10B981' : 'rgba(255,255,255,0.15)';

            return (
              <Group key={step} gap={0} style={{ flex: 1 }}>
                <Box
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Box
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: isStepActive
                        ? `${cfg.color}30`
                        : isCompleted
                          ? 'rgba(16,185,129,0.15)'
                          : 'rgba(255,255,255,0.06)',
                      border: `2px solid ${color}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      animation: isStepActive ? 'pulse 2s ease-in-out infinite' : undefined,
                    }}
                  >
                    <Text
                      fw={700}
                      style={{
                        fontFamily: '"Geist Mono", monospace',
                        fontSize: '11px',
                        color,
                      }}
                    >
                      {isCompleted ? '✓' : i + 1}
                    </Text>
                  </Box>
                  <Text
                    size="xs"
                    c="dimmed"
                    style={{ fontSize: '10px', textAlign: 'center', maxWidth: 60 }}
                  >
                    {step === 'gathering_requirements'
                      ? 'Req.'
                      : step === 'offer'
                        ? 'Oferta'
                        : step === 'accepted'
                          ? 'Acept.'
                          : 'Efect.'}
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
      )}

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

      {n.state === 'rejected' && (
        <Text size="xs" c="dimmed" mt="sm" style={{ fontStyle: 'italic' }}>
          Puedes reintentar desde aquí o desde el Mercado de adhesiones.
        </Text>
      )}
    </Paper>
  );
}

export function NegotiationsPage() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);
  const qc = useQueryClient();

  const negs = useQuery({
    queryKey: ['negotiations', id],
    queryFn: () => api.negotiations(id),
  });

  const retry = useMutation({
    mutationFn: (targetTeamId: number) => api.startNegotiation(id, targetTeamId),
    onSuccess: () => {
      notifications.show({
        color: 'green',
        icon: <IconCheck size={18} />,
        title: 'Éxito',
        message: 'Negociación reintentada',
      });
      qc.invalidateQueries({
        predicate: (q) =>
          ['negotiations', 'market', 'summary'].includes(q.queryKey[0] as string),
      });
    },
    onError: (e: Error) => {
      notifications.show({
        color: 'red',
        icon: <IconX size={18} />,
        title: 'Error',
        message: e.message,
      });
    },
  });

  if (negs.isLoading) {
    return (
      <div className="page-enter">
        <Skeleton height={120} radius="md" mb="md" />
        <Skeleton height={300} radius="md" />
      </div>
    );
  }

  const active = negs.data?.filter((n) => ACTIVE_STATES.has(n.state)) ?? [];
  const history = negs.data?.filter((n) => !ACTIVE_STATES.has(n.state)) ?? [];

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
          {history.length > 0 && (
            <Box
              style={{
                padding: '2px 10px',
                borderRadius: 12,
                background: 'rgba(239,68,68,0.15)',
                color: '#EF4444',
                fontFamily: '"Geist Mono", monospace',
                fontWeight: 700,
                fontSize: '12px',
              }}
            >
              {history.length} rechazadas
            </Box>
          )}
        </Group>
        <Text size="sm" c="dimmed" mt="xs" ml={34}>
          Ciclo: requisitos (1–3 años) → oferta → aceptada → efectiva dos años
          después de aceptar (§4.2).
        </Text>
      </Paper>

      {negs.data && negs.data.length === 0 ? (
        <Paper p="md" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          <Text c="dimmed">Sin negociaciones. Inicia una desde el Mercado.</Text>
        </Paper>
      ) : (
        <Tabs defaultValue="active" variant="pills" mb="md">
          <Tabs.List
            style={{
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 12,
              padding: 4,
              marginBottom: 16,
            }}
          >
            <Tabs.Tab
              value="active"
              leftSection={<IconArrowsExchange size={14} />}
              style={{
                borderRadius: 10,
                fontWeight: 600,
                fontFamily: '"DM Sans", sans-serif',
              }}
            >
              Activas ({active.length})
            </Tabs.Tab>
            <Tabs.Tab
              value="history"
              leftSection={<IconHistory size={14} />}
              style={{
                borderRadius: 10,
                fontWeight: 600,
                fontFamily: '"DM Sans", sans-serif',
              }}
            >
              Historial ({history.length})
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="active">
            {active.length === 0 ? (
              <Paper p="md" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                <Text c="dimmed">No hay negociaciones activas.</Text>
              </Paper>
            ) : (
              <Stack gap="md">
                {active.map((n, i) => (
                  <NegotiationCard key={n.id} n={n} index={i} />
                ))}
              </Stack>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="history">
            {history.length === 0 ? (
              <Paper p="md" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                <Text c="dimmed">Sin historial de negociaciones.</Text>
              </Paper>
            ) : (
              <Stack gap="md">
                {history.map((n, i) => (
                  <NegotiationCard
                    key={n.id}
                    n={n}
                    index={i}
                    onRetry={(teamId) => retry.mutate(teamId)}
                    retrying={retry.isPending}
                  />
                ))}
              </Stack>
            )}
          </Tabs.Panel>
        </Tabs>
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
