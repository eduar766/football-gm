import { Badge, Button, Group, Paper, Stack, Text } from '@mantine/core';
import { IconGavel } from '@tabler/icons-react';
import type { BoardMandateDto, MandateDifficulty } from '@football-gm/contracts';
import { api } from '../../api';
import { useMutationWithFeedback } from '../../useMutationWithFeedback';

const DIFFICULTY_LABEL: Record<MandateDifficulty, { label: string; color: string }> = {
  facil: { label: 'Fácil', color: 'gray' },
  medio: { label: 'Medio', color: 'blue' },
  dificil: { label: 'Difícil', color: 'red' },
};

// Fase 17G: non-blocking pretemporada choice — if the commissioner never
// picks, startSeason auto-commits the 'medio' option.
export function MandatePicker({ gameId, options }: { gameId: string; options: BoardMandateDto[] }) {
  const id = Number(gameId);

  const choose = useMutationWithFeedback({
    mutationFn: (mandateId: number) => api.chooseMandate(id, mandateId),
    queryKeyToInvalidate: ['summary', 'preseason'],
    successMessage: 'Mandato aceptado',
  });

  if (options.length === 0) return null;

  return (
    <Paper
      p="md"
      ml={52}
      mb="md"
      style={{ border: '1px solid rgba(255,255,255,0.06)', borderLeft: '3px solid #F59E0B' }}
    >
      <Group gap="xs" mb="sm">
        <IconGavel size={18} color="#F59E0B" />
        <Text fw={700} size="sm">Mandato de la junta</Text>
        <Text size="xs" c="dimmed">Opcional: si no eliges, se asume el intermedio.</Text>
      </Group>
      <Stack gap="xs">
        {options.map((m) => {
          const cfg = DIFFICULTY_LABEL[m.difficulty];
          return (
            <Group key={m.id} justify="space-between" wrap="nowrap" gap="sm">
              <Group gap="xs" wrap="nowrap">
                <Badge size="sm" color={cfg.color}>{cfg.label}</Badge>
                <Text size="sm">{m.description}</Text>
              </Group>
              <Button
                size="xs"
                variant="outline"
                loading={choose.isPending}
                onClick={() => choose.mutate(m.id)}
              >
                Elegir
              </Button>
            </Group>
          );
        })}
      </Stack>
    </Paper>
  );
}
