import { Button, Group, Paper, Text } from '@mantine/core';
import { useNavigate } from '@tanstack/react-router';
import { IconGavel } from '@tabler/icons-react';

// Fase 17C: shown in place of the old unilateral action wherever a decision
// now requires an assembly vote (norms, reparto, recurring cups, division
// expansion, league format). The read-only parts of these pages (lists,
// tables) stay untouched — only the mutating action moves to the Assembly.
export function AssemblyRedirectBanner({ gameId, message }: { gameId: string; message: string }) {
  const navigate = useNavigate();
  return (
    <Paper p="md" style={{ border: '1px solid rgba(139,92,246,0.25)', borderLeft: '3px solid #8B5CF6', background: 'rgba(139,92,246,0.05)' }}>
      <Group justify="space-between" wrap="wrap">
        <Group gap="sm">
          <IconGavel size={18} color="#8B5CF6" />
          <Text size="sm">{message}</Text>
        </Group>
        <Button
          onClick={() => navigate({ to: '/games/$gameId/assembly', params: { gameId } })}
          size="xs"
          variant="light"
          color="grape"
          leftSection={<IconGavel size={13} />}
        >
          Ir a la Asamblea
        </Button>
      </Group>
    </Paper>
  );
}
