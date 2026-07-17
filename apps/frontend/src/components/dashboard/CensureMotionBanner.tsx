import { Alert, Button, Group, Text } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import type { CensureMotionDto, GameSummary } from '@football-gm/contracts';
import { api } from '../../api';
import { useMutationWithFeedback } from '../../useMutationWithFeedback';

// Fase 17G: blocks the next closeSeason until resolved. Always visible once
// open — no dedicated query, GameSummary already carries it.
export function CensureMotionBanner({
  gameId,
  motion,
  politicalCapital,
}: {
  gameId: string;
  motion: CensureMotionDto;
  politicalCapital: number;
}) {
  const id = Number(gameId);

  const resolve = useMutationWithFeedback({
    mutationFn: (mode: 'gastar_pc' | 'defensa_meritos' | 'aceptar') => api.resolveCensureMotion(id, mode),
    queryKeyToInvalidate: ['summary'],
    successMessage: 'Moción resuelta',
    onSuccess: (data: GameSummary) => {
      if (data.gameOver) window.location.reload();
    },
  });

  return (
    <Alert
      color="red"
      icon={<IconAlertTriangle size={18} />}
      title={`Moción de censura (año ${motion.year})`}
      mb="md"
    >
      <Text size="sm" mb="sm">
        La junta ha abierto una moción de censura contra tu gestión. Debes resolverla antes de
        poder cerrar la próxima temporada.
      </Text>
      <Group gap="sm">
        <Button
          size="xs"
          variant="outline"
          color="red"
          disabled={politicalCapital < 6}
          loading={resolve.isPending}
          onClick={() => resolve.mutate('gastar_pc')}
        >
          Gastar 6 PC ({politicalCapital} disponibles)
        </Button>
        <Button
          size="xs"
          variant="outline"
          color="red"
          loading={resolve.isPending}
          onClick={() => resolve.mutate('defensa_meritos')}
        >
          Defensa por méritos
        </Button>
        <Button
          size="xs"
          variant="subtle"
          color="gray"
          loading={resolve.isPending}
          onClick={() => resolve.mutate('aceptar')}
        >
          Aceptar destitución
        </Button>
      </Group>
    </Alert>
  );
}
