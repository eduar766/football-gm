import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Grid,
  Group,
  NumberInput,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { IconCheck, IconDeviceFloppy, IconTrash, IconX } from '@tabler/icons-react';
import { api } from '../api';
import { money } from '../utils/format';

const parseShares = (raw: string): number[] =>
  raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => !Number.isNaN(n) && n >= 0);

export function PrizesPage() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);
  const qc = useQueryClient();

  const summary = useQuery({
    queryKey: ['summary', id],
    queryFn: () => api.summary(id),
  });
  const prizes = useQuery({
    queryKey: ['prizes', id],
    queryFn: () => api.prizes(id),
  });
  const cups = useQuery({
    queryKey: ['cups', id],
    queryFn: () => api.cups(id),
  });

  const invalidate = () =>
    qc.invalidateQueries({
      predicate: (q) =>
        ['prizes', 'economy', 'summary'].includes(q.queryKey[0] as string),
    });

  const isPreseason = summary.data?.phase === 'pretemporada';

  const [leaguePool, setLeaguePool] = useState(0);
  const [leagueShares, setLeagueShares] = useState('50, 30, 20');
  const [selectedCup, setSelectedCup] = useState<string | null>(null);
  const [cupPool, setCupPool] = useState(0);
  const [cupShares, setCupShares] = useState('50, 25, 12.5, 12.5');

  useEffect(() => {
    if (!prizes.data) return;
    const liga = prizes.data.prizes.find((p) => p.kind === 'liga');
    if (liga) {
      setLeaguePool(liga.pool);
      setLeagueShares(liga.shares.join(', '));
    }
  }, [prizes.data]);

  const saveLeague = useMutation({
    mutationFn: () =>
      api.setLeaguePrize(id, leaguePool, parseShares(leagueShares)),
    onSuccess: () => {
      notifications.show({
        color: 'green',
        icon: <IconCheck size={18} />,
        title: 'Éxito',
        message: 'Premio de liga guardado',
      });
      invalidate();
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
  const saveCup = useMutation({
    mutationFn: () => {
      if (!selectedCup) throw new Error('Elige una copa');
      return api.setCupPrize(
        id,
        Number(selectedCup),
        cupPool,
        parseShares(cupShares),
      );
    },
    onSuccess: () => {
      notifications.show({
        color: 'green',
        icon: <IconCheck size={18} />,
        title: 'Éxito',
        message: 'Premio de copa guardado',
      });
      invalidate();
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
  const remove = useMutation({
    mutationFn: (prizeId: number) => api.removePrize(id, prizeId),
    onSuccess: () => {
      notifications.show({
        color: 'green',
        icon: <IconCheck size={18} />,
        title: 'Éxito',
        message: 'Premio eliminado',
      });
      invalidate();
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

  if (prizes.isLoading || !prizes.data) {
    return (
      <Stack>
        <Grid>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Skeleton height={250} radius="md" />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Skeleton height={250} radius="md" />
          </Grid.Col>
        </Grid>
        <Skeleton height={200} radius="md" />
      </Stack>
    );
  }

  const ligaPrize = prizes.data.prizes.find((p) => p.kind === 'liga');
  const cupPrizes = prizes.data.prizes.filter((p) => p.kind === 'copa');
  const cupOptions = (cups.data?.cups ?? []).map((c) => ({
    value: String(c.id),
    label: c.name,
  }));

  return (
    <Stack>
      {!isPreseason && (
        <Alert color="yellow" variant="light">
          Los premios solo se editan en pretemporada. Vuelve al{' '}
          <em>Resumen</em> y espera al cierre de temporada.
        </Alert>
      )}

      <Grid>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder>
            <Text fw={700} mb="xs">Liga (1ª división)</Text>
            <Text size="xs" c="dimmed" mb="sm">
              Premio que se reparte por posición final de la temporada.
            </Text>
            <Stack>
              <NumberInput
                label="Bolsa total (€)"
                value={leaguePool}
                onChange={(v) => setLeaguePool(Number(v) || 0)}
                min={0}
                step={500_000}
                thousandSeparator="."
                decimalSeparator=","
                disabled={!isPreseason}
              />
              <TextInput
                label="Reparto por posición (%)"
                description="Por ejemplo 50, 30, 20 (1º/2º/3º). Se normaliza al pagar."
                value={leagueShares}
                onChange={(e) => setLeagueShares(e.currentTarget.value)}
                disabled={!isPreseason}
              />
              <Group>
                <Button
                  onClick={() => saveLeague.mutate()}
                  loading={saveLeague.isPending}
                  disabled={!isPreseason}
                  leftSection={<IconDeviceFloppy size={16} />}
                >
                  Guardar premio de liga
                </Button>
                {ligaPrize && (
                  <Button
                    variant="subtle"
                    color="red"
                    leftSection={<IconTrash size={14} />}
                    onClick={() =>
                      modals.openConfirmModal({
                        title: 'Quitar premio de liga',
                        children: (
                          <Text size="sm">
                            ¿Estás seguro de que quieres eliminar el premio de liga? Esta acción no se puede deshacer.
                          </Text>
                        ),
                        labels: { confirm: 'Quitar', cancel: 'Cancelar' },
                        confirmProps: { color: 'red' },
                        onConfirm: () => remove.mutate(ligaPrize.id),
                      })
                    }
                    disabled={!isPreseason}
                  >
                    Quitar
                  </Button>
                )}
              </Group>
              {ligaPrize && (
                <Text size="xs" c="dimmed">
                  Activo: {money(ligaPrize.pool)} · {ligaPrize.shares.join('/')}
                </Text>
              )}
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder>
            <Text fw={700} mb="xs">Copa</Text>
            <Text size="xs" c="dimmed" mb="sm">
              Premio que se paga al coronarse al campeón. Eliminatoria: 1=campeón, 2=subcampeón, 3-4=semifinalistas. Liga: por posición final.
            </Text>
            <Stack>
              <Select
                label="Copa"
                placeholder="Selecciona una copa"
                data={cupOptions}
                value={selectedCup}
                onChange={setSelectedCup}
                disabled={!isPreseason || cupOptions.length === 0}
              />
              <NumberInput
                label="Bolsa total (€)"
                value={cupPool}
                onChange={(v) => setCupPool(Number(v) || 0)}
                min={0}
                step={250_000}
                thousandSeparator="."
                decimalSeparator=","
                disabled={!isPreseason}
              />
              <TextInput
                label="Reparto por posición (%)"
                description="Por ejemplo 50, 25, 12.5, 12.5"
                value={cupShares}
                onChange={(e) => setCupShares(e.currentTarget.value)}
                disabled={!isPreseason}
              />
              <Button
                onClick={() => saveCup.mutate()}
                loading={saveCup.isPending}
                disabled={!isPreseason || !selectedCup}
                leftSection={<IconDeviceFloppy size={16} />}
              >
                Guardar premio de copa
              </Button>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {cupPrizes.length > 0 && (
        <Paper withBorder p="md">
          <Text fw={700} mb="sm">Premios de copa activos</Text>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Copa</Table.Th>
                <Table.Th ta="right">Bolsa</Table.Th>
                <Table.Th>Reparto</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {cupPrizes.map((p) => (
                <Table.Tr key={p.id}>
                  <Table.Td>{p.cupName ?? '—'}</Table.Td>
                  <Table.Td ta="right">{money(p.pool)}</Table.Td>
                  <Table.Td>{p.shares.join(' / ')}</Table.Td>
                  <Table.Td ta="right">
                    <Button
                      size="xs"
                      variant="subtle"
                      color="red"
                      leftSection={<IconTrash size={12} />}
                      onClick={() =>
                        modals.openConfirmModal({
                          title: 'Quitar premio de copa',
                          children: (
                            <Text size="sm">
                              ¿Estás seguro de que quieres eliminar el premio de {p.cupName}? Esta acción no se puede deshacer.
                            </Text>
                          ),
                          labels: { confirm: 'Quitar', cancel: 'Cancelar' },
                          confirmProps: { color: 'red' },
                          onConfirm: () => remove.mutate(p.id),
                        })
                      }
                      disabled={!isPreseason}
                    >
                      Quitar
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      <Paper withBorder p="md">
        <Group justify="space-between" mb="sm">
          <Text fw={700}>Pagos efectuados</Text>
          {prizes.data.latestPaidYear > 0 && (
            <Badge variant="light" color="green">
              Último año pagado: {prizes.data.latestPaidYear}
            </Badge>
          )}
        </Group>
        {prizes.data.payments.length === 0 ? (
          <Text c="dimmed" size="sm">
            Aún no se ha cerrado ninguna competición con premio.
          </Text>
        ) : (
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Año</Table.Th>
                <Table.Th>Competición</Table.Th>
                <Table.Th ta="right">Pos.</Table.Th>
                <Table.Th>Equipo</Table.Th>
                <Table.Th ta="right">Premio</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {[...prizes.data.payments]
                .sort(
                  (a, b) =>
                    b.year - a.year ||
                    a.competitionLabel.localeCompare(b.competitionLabel) ||
                    a.position - b.position,
                )
                .map((p, i) => (
                  <Table.Tr key={`${p.year}-${p.competitionLabel}-${p.position}-${i}`}>
                    <Table.Td>{p.year}</Table.Td>
                    <Table.Td>{p.competitionLabel}</Table.Td>
                    <Table.Td ta="right">{p.position}</Table.Td>
                    <Table.Td>{p.teamName}</Table.Td>
                    <Table.Td ta="right">{money(p.amount)}</Table.Td>
                  </Table.Tr>
                ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </Stack>
  );
}
