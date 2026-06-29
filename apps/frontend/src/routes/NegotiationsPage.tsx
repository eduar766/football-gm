import { useState } from 'react';
import { Box, Button, Group, NumberInput, Paper, Skeleton, Stack, Tabs, Text, Tooltip } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import {
  IconArrowsExchange,
  IconCheck,
  IconCircleCheck,
  IconCircleX,
  IconClock,
  IconHistory,
  IconRefresh,
} from '@tabler/icons-react';
import type { EngineNegotiationState, NegotiationDto, NegotiationRequirementDto } from '@football-gm/contracts';
import { api } from '../api';
import { useMutationWithFeedback } from '../useMutationWithFeedback';
import { QK } from '../query-keys';
import { PageHero } from '../components/PageHero';

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

const REQ_LABEL: Record<string, string> = {
  prestigio: 'Prestigio federativo',
  estadio: 'Capacidad media de estadio',
  reparto: '% de ingresos ofrecido',
};

const REQ_UNIT: Record<string, string> = {
  prestigio: 'pts',
  estadio: 'espectadores',
  reparto: '%',
};

function RequirementRow({ req }: { req: NegotiationRequirementDto }) {
  if (!req.revealed) {
    return (
      <Group gap="xs" py={4}>
        <IconClock size={14} color="rgba(255,255,255,0.3)" />
        <Text size="xs" c="dimmed" style={{ fontStyle: 'italic' }}>
          Requisito pendiente de revelar…
        </Text>
      </Group>
    );
  }
  return (
    <Group gap="xs" py={4}>
      {req.cumplido ? (
        <IconCircleCheck size={16} color="#10B981" />
      ) : (
        <IconCircleX size={16} color="#EF4444" />
      )}
      <Text size="xs" style={{ flex: 1 }}>
        {REQ_LABEL[req.tipo] ?? req.tipo}
      </Text>
      <Text
        size="xs"
        fw={700}
        style={{
          fontFamily: 'var(--mantine-font-family-monospace)',
          color: req.cumplido ? '#10B981' : '#EF4444',
        }}
      >
        ≥ {req.objetivo.toLocaleString()} {REQ_UNIT[req.tipo] ?? ''}
      </Text>
    </Group>
  );
}

function NegotiationCard({
  n,
  index,
  onRetry,
  retrying,
  onSetOffer,
  settingOffer,
}: {
  n: NegotiationDto;
  index: number;
  onRetry?: (teamId: number) => void;
  retrying?: boolean;
  onSetOffer?: (negId: number, value: number) => void;
  settingOffer?: boolean;
}) {
  const [localOffer, setLocalOffer] = useState(n.offerValue);
  const cfg = STAGE_CONFIG[n.state];
  const currentIdx = STEPS.indexOf(n.state as (typeof STEPS)[number]);
  const isActive = ACTIVE_STATES.has(n.state);
  const hasReparto = n.requirements.some((r) => r.revealed && r.tipo === 'reparto');
  const canEditOffer = onSetOffer && (n.state === 'gathering_requirements' || n.state === 'offer');

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
                        fontFamily: 'var(--mantine-font-family-monospace)',
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

      {/* Requirements checklist */}
      {n.requirements.length > 0 && (
        <Box
          mt="sm"
          p="sm"
          style={{
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={6} style={{ letterSpacing: '0.05em' }}>
            Condiciones del equipo
          </Text>
          <Stack gap={0}>
            {n.requirements.map((req, i) => (
              <RequirementRow key={i} req={req} />
            ))}
            {/* Unrevealed slots */}
            {Array.from({ length: n.requirements.length - n.revealedCount }).map((_, i) => (
              <Group key={`hidden-${i}`} gap="xs" py={4}>
                <IconClock size={14} color="rgba(255,255,255,0.2)" />
                <Text size="xs" c="dimmed" style={{ fontStyle: 'italic', opacity: 0.5 }}>
                  Condición oculta — se revela en {n.requirementsSeasonsLeft - i} temporada(s)
                </Text>
              </Group>
            ))}
          </Stack>

          {/* Revenue share input — shown when reparto requirement is revealed */}
          {hasReparto && canEditOffer && (
            <Group gap="xs" mt="sm" align="flex-end">
              <NumberInput
                label="Tu oferta de reparto (%)"
                description="% de tus ingresos comerciales anuales comprometidos con este equipo."
                value={localOffer}
                onChange={(v) => setLocalOffer(Number(v) || 0)}
                min={0}
                max={30}
                step={1}
                suffix="%"
                size="xs"
                style={{ flex: 1 }}
                styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' } }}
              />
              <Tooltip label="Guardar oferta de reparto">
                <Button
                  size="xs"
                  variant="outline"
                  style={{ borderColor: '#10B981', color: '#10B981' }}
                  leftSection={<IconCheck size={13} />}
                  onClick={() => onSetOffer!(n.id, localOffer)}
                  loading={settingOffer}
                >
                  Confirmar
                </Button>
              </Tooltip>
            </Group>
          )}
        </Box>
      )}

      <Group gap="md" mt="sm">
        <Text size="xs" c="dimmed">
          Inicio:{' '}
          <span style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: '#F9FAFB' }}>
            {n.startedYear}
          </span>
        </Text>
        {n.state === 'gathering_requirements' && (
          <Text size="xs" c="dimmed">
            Temporadas restantes:{' '}
            <span style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: '#F59E0B' }}>
              {n.requirementsSeasonsLeft}
            </span>
          </Text>
        )}
        {n.acceptedYear && (
          <Text size="xs" c="dimmed">
            Aceptada:{' '}
            <span style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: '#10B981' }}>
              {n.acceptedYear}
            </span>
          </Text>
        )}
        {n.effectiveYear && (
          <Text size="xs" c="dimmed">
            Efectiva:{' '}
            <span style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: '#10B981' }}>
              {n.effectiveYear}
            </span>
          </Text>
        )}
      </Group>

      {n.state === 'rejected' && (
        <Text size="xs" c="dimmed" mt="sm" style={{ fontStyle: 'italic' }}>
          Puedes reintentar desde aquí o desde el Mercado. Espera al menos una temporada.
        </Text>
      )}
    </Paper>
  );
}

export function NegotiationsPage() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);

  const negs = useQuery({
    queryKey: QK.negotiations(id),
    queryFn: () => api.negotiations(id),
  });

  const retry = useMutationWithFeedback({
    mutationFn: (targetTeamId: number) => api.startNegotiation(id, targetTeamId),
    queryKeyToInvalidate: ['negotiations', 'market', 'summary'],
    successMessage: 'Negociación reintentada',
  });

  const setOffer = useMutationWithFeedback({
    mutationFn: ({ negId, offerValue }: { negId: number; offerValue: number }) =>
      api.setOfferValue(id, negId, offerValue),
    queryKeyToInvalidate: ['negotiations', 'market', 'summary'],
    successMessage: 'Oferta de reparto guardada',
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
      <PageHero
        icon={IconArrowsExchange}
        iconColor="#10B981"
        title="Negociaciones"
        subtitle="Ciclo: requisitos (1–3 años) → oferta → aceptada → efectiva dos años después de aceptar."
      />

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
                  <NegotiationCard
                    key={n.id}
                    n={n}
                    index={i}
                    onSetOffer={(negId, value) => setOffer.mutate({ negId, offerValue: value })}
                    settingOffer={setOffer.isPending}
                  />
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
