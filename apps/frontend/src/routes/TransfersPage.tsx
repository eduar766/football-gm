import { useMemo, useState } from 'react';
import {
  Badge,
  Group,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { IconArrowRight } from '@tabler/icons-react';
import { api } from '../api';

export function TransfersPage() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);

  const q = useQuery({
    queryKey: ['transfers', id],
    queryFn: () => api.transfers(id),
  });

  const years = useMemo(() => {
    if (!q.data) return [] as number[];
    const set = new Set<number>(q.data.history.map((t) => t.year));
    return Array.from(set).sort((a, b) => b - a);
  }, [q.data]);

  const [year, setYear] = useState<number | null>(null);
  const activeYear = year ?? q.data?.year ?? null;
  const entries = useMemo(() => {
    if (!q.data || activeYear == null) return [];
    return q.data.history.filter((t) => t.year === activeYear);
  }, [q.data, activeYear]);

  if (q.isLoading || !q.data) {
    return (
      <Stack>
        <Skeleton height={200} radius="md" />
        <Skeleton height={150} radius="md" />
      </Stack>
    );
  }

  if (q.data.history.length === 0) {
    return (
      <Paper withBorder p="md">
        <Group gap="sm" mb="xs">
          <IconArrowRight size={20} />
          <Text fw={700}>Fichajes</Text>
        </Group>
        <Text c="dimmed" size="sm">
          Aún no se ha celebrado ninguna ventana de fichajes. Cierra una
          temporada para que los clubes muevan jugadores entre sí.
        </Text>
      </Paper>
    );
  }

  return (
    <Stack>
      <Paper withBorder p="md">
        <Group justify="space-between" mb="sm">
          <div>
            <Text fw={700}>Ventana de fichajes</Text>
            <Text size="xs" c="dimmed">
              Movimientos reales entre clubes en la pretemporada (§4.8). Los
              clubes son autónomos: el comisionado no firma fichajes, los
              observa.
            </Text>
          </div>
          <Group gap="sm">
            <Select
              size="xs"
              w={120}
              data={years.map((y) => ({ value: String(y), label: `Año ${y}` }))}
              value={activeYear != null ? String(activeYear) : null}
              onChange={(v) => setYear(v ? Number(v) : null)}
            />
            <Badge variant="light" color="grape">
              {entries.length} movimientos
            </Badge>
          </Group>
        </Group>
        {entries.length === 0 ? (
          <Text c="dimmed" size="sm">
            Sin movimientos en este año.
          </Text>
        ) : (
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Jugador</Table.Th>
                <Table.Th ta="right">Cal.</Table.Th>
                <Table.Th>Desde</Table.Th>
                <Table.Th>Hacia</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {entries.map((e) => (
                <Table.Tr key={`${e.year}-${e.playerId}`}>
                  <Table.Td>{e.playerName}</Table.Td>
                  <Table.Td ta="right">{e.calidad}</Table.Td>
                  <Table.Td c="dimmed">{e.fromTeamName}</Table.Td>
                  <Table.Td fw={500}>{e.toTeamName}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      <Paper withBorder p="md">
        <Text fw={700} mb="sm">
          Histórico total
        </Text>
        <Text size="xs" c="dimmed" mb="sm">
          Resumen de movimientos por año desde el comienzo.
        </Text>
        <Table>
          <Table.Tbody>
            {years.map((y) => {
              const count = q.data!.history.filter((t) => t.year === y).length;
              return (
                <Table.Tr key={y}>
                  <Table.Td fw={500}>Año {y}</Table.Td>
                  <Table.Td ta="right">{count} movimientos</Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Paper>
    </Stack>
  );
}
