import { useState } from 'react';
import { Badge, Box, Button, Group, Paper, SegmentedControl, Skeleton, Stack, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { IconInbox, IconChecks, IconArrowRight } from '@tabler/icons-react';
import type { MailboxCategory, MailboxMessageDto } from '@football-gm/contracts';
import { api } from '../api';
import { useMutationWithFeedback } from '../useMutationWithFeedback';
import { QK } from '../query-keys';
import { PageHero } from '../components/PageHero';

const CATEGORY_STYLE: Record<MailboxCategory, { label: string; emoji: string; color: string }> = {
  peticion: { label: 'Petición', emoji: '📩', color: 'orange' },
  evento: { label: 'Evento', emoji: '⚠️', color: 'red' },
  aviso: { label: 'Aviso', emoji: '📢', color: 'blue' },
  hito: { label: 'Hito', emoji: '⭐', color: 'yellow' },
  financiero: { label: 'Financiero', emoji: '💰', color: 'green' },
};

// Fase 17G: "el mailbox agrupa por circunscripción" — a best-effort bucket
// derived from actionKind (precise) falling back to category (coarse), since
// messages don't carry a dedicated constituency field.
type Constituency = 'junta' | 'clubes' | 'aficion' | 'casos';
const CONSTITUENCY_LABEL: Record<Constituency, string> = {
  junta: 'Junta', clubes: 'Clubes', aficion: 'Afición', casos: 'Casos',
};
function constituencyOf(m: MailboxMessageDto): Constituency {
  switch (m.actionKind) {
    case 'integrity_case': return 'casos';
    case 'rescue_request':
    case 'demand':
    case 'conspiracy': return 'clubes';
    case 'censura': return 'junta';
    case 'event': return 'aficion';
    default: break;
  }
  if (m.category === 'financiero' || m.category === 'hito') return 'junta';
  return 'aficion';
}

type Filter = 'todos' | 'sin_leer';
type ConstituencyFilter = 'todas' | Constituency;

export function MailboxPage() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('todos');
  const [constituency, setConstituency] = useState<ConstituencyFilter>('todas');

  const mailbox = useQuery({ queryKey: QK.mailbox(id), queryFn: () => api.mailbox(id) });

  const markRead = useMutationWithFeedback({
    mutationFn: (msgId: number) => api.markMailRead(id, msgId),
    queryKeyToInvalidate: ['mailbox', 'summary'],
  });
  const markAllRead = useMutationWithFeedback({
    mutationFn: () => api.markAllMailRead(id),
    queryKeyToInvalidate: ['mailbox', 'summary'],
    successMessage: 'Todo marcado como leído',
  });
  const resolveDemand = useMutationWithFeedback({
    mutationFn: ({ demandId, mode }: { demandId: number; mode: 'aceptar' | 'rechazar' | 'contraoferta' }) =>
      api.resolveDemand(id, demandId, mode),
    queryKeyToInvalidate: ['mailbox', 'summary', 'teams', 'economy', 'structure'],
    successMessage: 'Petición resuelta',
  });

  if (mailbox.isLoading) {
    return (
      <div className="page-enter">
        <Skeleton height={80} radius="md" mb="md" />
        <Skeleton height={300} radius="md" />
      </div>
    );
  }

  const all = mailbox.data?.messages ?? [];
  const unread = mailbox.data?.unread ?? 0;
  const messages = all
    .filter((m) => filter !== 'sin_leer' || m.status === 'sin_leer')
    .filter((m) => constituency === 'todas' || constituencyOf(m) === constituency);
  const demandById = new Map((mailbox.data?.demands ?? []).map((d) => [d.id, d]));

  const onOpen = (m: MailboxMessageDto) => {
    if (m.status === 'sin_leer') markRead.mutate(m.id);
    if (m.actionKind === 'event') navigate({ to: '/games/$gameId/events', params: { gameId } });
    if (m.actionKind === 'integrity_case') navigate({ to: '/games/$gameId/norms', params: { gameId } });
    if (m.actionKind === 'conspiracy') navigate({ to: '/games/$gameId', params: { gameId } });
  };

  return (
    <div className="page-enter">
      <PageHero
        icon={IconInbox}
        iconColor="#3B82F6"
        title="Buzón del Comisionado"
        subtitle={unread > 0 ? `${unread} mensaje(s) sin leer` : 'Bandeja al día'}
      />

      <Group justify="space-between" mb="md" wrap="wrap">
        <Group gap="sm" wrap="wrap">
          <SegmentedControl
            value={filter}
            onChange={(v) => setFilter(v as Filter)}
            data={[
              { label: 'Todos', value: 'todos' },
              { label: `Sin leer (${unread})`, value: 'sin_leer' },
            ]}
          />
          <SegmentedControl
            value={constituency}
            onChange={(v) => setConstituency(v as ConstituencyFilter)}
            data={[
              { label: 'Todas', value: 'todas' },
              ...(Object.keys(CONSTITUENCY_LABEL) as Constituency[]).map((c) => ({
                label: CONSTITUENCY_LABEL[c],
                value: c,
              })),
            ]}
          />
        </Group>
        <Button
          variant="light"
          leftSection={<IconChecks size={16} />}
          disabled={unread === 0}
          loading={markAllRead.isPending}
          onClick={() => markAllRead.mutate(undefined as void)}
        >
          Marcar todo leído
        </Button>
      </Group>

      {messages.length === 0 ? (
        <Paper p="xl" radius="md" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <Text c="dimmed" ta="center">
            {filter === 'sin_leer' ? 'No tienes mensajes sin leer.' : 'Tu buzón está vacío.'}
          </Text>
        </Paper>
      ) : (
        <Stack gap="xs">
          {messages.map((m) => {
            const style = CATEGORY_STYLE[m.category];
            const unreadRow = m.status === 'sin_leer';
            const actionable = m.actionKind === 'event' && m.status !== 'resuelto' && m.status !== 'caducado';
            const demand =
              (m.actionKind === 'rescue_request' || m.actionKind === 'demand') && m.refId != null
                ? demandById.get(m.refId)
                : undefined;
            return (
              <Paper
                key={m.id}
                p="sm"
                radius="md"
                onClick={() => onOpen(m)}
                style={{
                  cursor: 'pointer',
                  background: unreadRow ? 'rgba(59,130,246,0.06)' : 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderLeft: `3px solid var(--mantine-color-${style.color}-6)`,
                  opacity: m.status === 'resuelto' || m.status === 'caducado' ? 0.6 : 1,
                }}
              >
                <Group justify="space-between" wrap="nowrap" align="flex-start">
                  <Group gap="sm" wrap="nowrap" align="flex-start">
                    <Text size="lg">{style.emoji}</Text>
                    <Box>
                      <Group gap={6}>
                        <Text fw={unreadRow ? 700 : 600} size="sm">
                          {m.title}
                        </Text>
                        <Badge size="xs" variant="light" color={style.color}>
                          {style.label}
                        </Badge>
                        {m.status === 'resuelto' && (
                          <Badge size="xs" variant="outline" color="green">Resuelto</Badge>
                        )}
                        {m.status === 'caducado' && (
                          <Badge size="xs" variant="outline" color="gray">Caducado</Badge>
                        )}
                      </Group>
                      <Text size="xs" c="dimmed" mt={2}>
                        {m.body}
                      </Text>
                    </Box>
                  </Group>
                  <Stack gap={4} align="flex-end">
                    <Text size="xs" c="dimmed">
                      {m.matchday > 0 ? `Año ${m.year} · J${m.matchday}` : `Año ${m.year}`}
                    </Text>
                    {actionable && (
                      <Badge size="sm" color="red" variant="light" rightSection={<IconArrowRight size={12} />}>
                        Resolver
                      </Badge>
                    )}
                  </Stack>
                </Group>

                {demand && (
                  <Group justify="space-between" mt="sm" pl={40} wrap="nowrap">
                    <Text size="xs" c="dimmed">
                      Arraigo actual: <b>{demand.teamArraigo}</b>
                      {demand.amount != null && ` · Coste: ${demand.amount.toLocaleString('es-ES')} €`}
                      {' · '}Si ignoras: <b style={{ color: 'var(--mantine-color-red-5)' }}>−12 arraigo</b>
                    </Text>
                    <Group gap="xs" wrap="nowrap">
                      <Button
                        size="xs"
                        color="green"
                        loading={resolveDemand.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          resolveDemand.mutate({ demandId: demand.id, mode: 'aceptar' });
                        }}
                      >
                        Atender
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        color="yellow"
                        title="Solo disponible con una propuesta de asamblea activa"
                        loading={resolveDemand.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          resolveDemand.mutate({ demandId: demand.id, mode: 'contraoferta' });
                        }}
                      >
                        Contraoferta
                      </Button>
                      <Button
                        size="xs"
                        variant="default"
                        onClick={(e) => {
                          e.stopPropagation();
                          resolveDemand.mutate({ demandId: demand.id, mode: 'rechazar' });
                        }}
                      >
                        Rechazar
                      </Button>
                    </Group>
                  </Group>
                )}
              </Paper>
            );
          })}
        </Stack>
      )}
    </div>
  );
}
