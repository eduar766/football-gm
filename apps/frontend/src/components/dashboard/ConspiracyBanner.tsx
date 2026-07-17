import { Badge, Button, Group, List, Paper, Skeleton, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { IconFlag } from '@tabler/icons-react';
import { api } from '../../api';
import { useMutationWithFeedback } from '../../useMutationWithFeedback';
import { QK } from '../../query-keys';
import { CONSPIRACY_DEMAND_LABEL, CONSPIRACY_PHASE_LABEL } from '../../domain-labels';

// Visible from phase 'organizada' onward only — 'rumor' has no dedicated UI
// by design (narrative signals only: federationLog + mailbox).
export function ConspiracyBanner({ gameId }: { gameId: string }) {
  const id = Number(gameId);
  const conspiracy = useQuery({ queryKey: QK.conspiracy(id), queryFn: () => api.conspiracy(id) });

  const expel = useMutationWithFeedback({
    mutationFn: () => api.expelRingleader(id),
    queryKeyToInvalidate: ['conspiracy', 'summary', 'federation'],
    successMessage: 'Cabecilla expulsado. La conspiración se disuelve.',
    confirmModal: {
      title: 'Expulsar al cabecilla',
      message: 'El club será apartado de inmediato y perderás prestigio y opinión pública. Los demás miembros quedarán resentidos, pero la conspiración se desactiva. ¿Continuar?',
      labels: { confirm: 'Expulsar', cancel: 'Cancelar' },
    },
  });

  if (conspiracy.isLoading) return <Skeleton height={60} radius="md" mb="md" />;
  const c = conspiracy.data?.conspiracy;
  if (!c) return null;

  return (
    <Paper
      p="md"
      mb="md"
      style={{ border: '1px solid rgba(239,68,68,0.3)', borderLeft: '3px solid #EF4444' }}
    >
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Group gap="xs" mb={4}>
            <IconFlag size={16} color="#EF4444" />
            <Text fw={700} size="sm">La conspiración de la Superliga</Text>
            <Badge size="xs" color="red">{CONSPIRACY_PHASE_LABEL[c.phase]}</Badge>
          </Group>
          <Text size="xs" c="dimmed" mb={4}>
            {c.memberTeamNames.join(', ')} — cabecilla: {c.ringleaderTeamName}
          </Text>
          {c.phase === 'ultimatum' && (
            <>
              <Text size="xs" c="dimmed" mb={4}>
                Ultimátum hasta la temporada {c.deadlineYear}. Cumple al menos 2 demandas:
              </Text>
              <List size="xs" spacing={2}>
                {c.demands.map((d) => (
                  <List.Item key={d.kind}>
                    <Text span size="xs" c={d.met ? 'green' : 'dimmed'}>
                      {d.met ? '✓ ' : '○ '}{CONSPIRACY_DEMAND_LABEL[d.kind]}
                    </Text>
                  </List.Item>
                ))}
              </List>
            </>
          )}
        </div>
        <Button size="xs" color="red" variant="outline" onClick={() => expel.mutateWithConfirm(undefined)}>
          Expulsar al cabecilla
        </Button>
      </Group>
    </Paper>
  );
}
