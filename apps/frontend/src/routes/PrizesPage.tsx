import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
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
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { IconCheck, IconDeviceFloppy, IconMedal, IconMinus, IconPlus, IconTrophy, IconTrash, IconX } from '@tabler/icons-react';
import { api } from '../api';
import { money } from '../utils/format';

const POSITION_MEDALS = ['#F59E0B', '#9CA3AF', '#D97706'];
const POSITION_LABELS = ['1º', '2º', '3º', '4º', '5º', '6º', '7º', '8º', '9º', '10º', '11º', '12º', '13º', '14º', '15º', '16º'];

function ShareEditor({
  shares,
  onChange,
  disabled,
  color,
}: {
  shares: number[];
  onChange: (next: number[]) => void;
  disabled: boolean;
  color: string;
}) {
  const total = shares.reduce((a, b) => a + b, 0);
  const overBudget = total > 100;

  const update = (i: number, v: number) => {
    const next = [...shares];
    next[i] = Math.max(0, v);
    onChange(next);
  };
  const addPos = () => onChange([...shares, 0]);
  const removePos = (i: number) => onChange(shares.filter((_, j) => j !== i));
  const equalize = () => {
    const n = shares.length;
    const each = Math.floor(100 / n);
    const remainder = 100 - each * n;
    onChange(shares.map((_, i) => (i < n - 1 ? each : each + remainder)));
  };

  return (
    <Stack gap="xs">
      <Group gap="xs" wrap="nowrap">
        {shares.map((s, i) => (
          <Box key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <Text size="xs" c="dimmed" style={{ fontFamily: '"Geist Mono", monospace' }}>
              {POSITION_LABELS[i] ?? `${i + 1}º`}
            </Text>
            <NumberInput
              value={s}
              onChange={(v) => update(i, Number(v) || 0)}
              min={0}
              max={100}
              step={5}
              disabled={disabled}
              hideControls
              styles={{
                input: {
                  width: 52,
                  textAlign: 'center',
                  fontFamily: '"Geist Mono", monospace',
                  fontSize: '13px',
                  fontWeight: 700,
                  background: overBudget ? 'rgba(239,68,68,0.08)' : undefined,
                  borderColor: overBudget ? '#EF4444' : undefined,
                },
              }}
            />
            {!disabled && shares.length > 1 && (
              <Button
                size="compact-xxs"
                variant="subtle"
                color="red"
                onClick={() => removePos(i)}
                style={{ padding: 0, minWidth: 16, height: 16 }}
              >
                <IconMinus size={10} />
              </Button>
            )}
          </Box>
        ))}
        {!disabled && shares.length < 16 && (
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            onClick={addPos}
            leftSection={<IconPlus size={12} />}
            style={{ alignSelf: 'flex-end' }}
          >
            Pos.
          </Button>
        )}
      </Group>

      {/* Visual distribution bar */}
      <Group gap={2} style={{ height: 20 }}>
        {shares.map((s, i) => {
          if (s <= 0) return null;
          return (
            <Box
              key={i}
              style={{
                width: Math.max(20, (s / Math.max(total, 1)) * 200),
                height: 20,
                borderRadius: 4,
                background: POSITION_MEDALS[i] ?? color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'width 0.2s',
              }}
            >
              <Text style={{ fontSize: '9px', fontWeight: 700, color: '#fff' }}>
                {s}%
              </Text>
            </Box>
          );
        })}
      </Group>

      <Group gap="xs" align="center">
        <Text
          size="xs"
          fw={600}
          style={{
            fontFamily: '"Geist Mono", monospace',
            color: overBudget ? '#EF4444' : total === 100 ? '#10B981' : '#9CA3AF',
          }}
        >
          Total: {total}%
        </Text>
        {overBudget && (
          <Text size="xs" c="red">
            — excede 100%, se normalizará al pagar
          </Text>
        )}
        {!disabled && (
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            onClick={equalize}
          >
            Repartir equitativamente
          </Button>
        )}
      </Group>
    </Stack>
  );
}

export function PrizesPage() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);
  const qc = useQueryClient();

  const summary = useQuery({ queryKey: ['summary', id], queryFn: () => api.summary(id) });
  const prizes = useQuery({ queryKey: ['prizes', id], queryFn: () => api.prizes(id) });
  const cups = useQuery({ queryKey: ['cups', id], queryFn: () => api.cups(id) });

  const invalidate = () =>
    qc.invalidateQueries({
      predicate: (q) => ['prizes', 'economy', 'summary'].includes(q.queryKey[0] as string),
    });

  const isPreseason = summary.data?.phase === 'pretemporada';

  const [leaguePool, setLeaguePool] = useState(0);
  const [leagueShares, setLeagueShares] = useState<number[]>([50, 30, 20]);
  const [selectedCup, setSelectedCup] = useState<string | null>(null);
  const [cupPool, setCupPool] = useState(0);
  const [cupShares, setCupShares] = useState<number[]>([50, 25, 12.5, 12.5]);

  useEffect(() => {
    if (!prizes.data) return;
    const liga = prizes.data.prizes.find((p) => p.kind === 'liga');
    if (liga) {
      setLeaguePool(liga.pool);
      setLeagueShares(liga.shares);
    }
  }, [prizes.data]);

  const saveLeague = useMutation({
    mutationFn: () => api.setLeaguePrize(id, leaguePool, leagueShares),
    onSuccess: () => {
      notifications.show({ color: 'green', icon: <IconCheck size={18} />, title: 'Éxito', message: 'Premio de liga guardado' });
      invalidate();
    },
    onError: (error: Error) => {
      notifications.show({ color: 'red', icon: <IconX size={18} />, title: 'Error', message: error.message });
    },
  });
  const saveCup = useMutation({
    mutationFn: () => {
      if (!selectedCup) throw new Error('Elige una copa');
      return api.setCupPrize(id, Number(selectedCup), cupPool, cupShares);
    },
    onSuccess: () => {
      notifications.show({ color: 'green', icon: <IconCheck size={18} />, title: 'Éxito', message: 'Premio de copa guardado' });
      invalidate();
    },
    onError: (error: Error) => {
      notifications.show({ color: 'red', icon: <IconX size={18} />, title: 'Error', message: error.message });
    },
  });
  const remove = useMutation({
    mutationFn: (prizeId: number) => api.removePrize(id, prizeId),
    onSuccess: () => {
      notifications.show({ color: 'green', icon: <IconCheck size={18} />, title: 'Éxito', message: 'Premio eliminado' });
      invalidate();
    },
    onError: (error: Error) => {
      notifications.show({ color: 'red', icon: <IconX size={18} />, title: 'Error', message: error.message });
    },
  });

  if (prizes.isLoading || !prizes.data) {
    return (
      <div className="page-enter">
        <Skeleton height={120} radius="md" mb="md" />
        <Grid>
          <Grid.Col span={{ base: 12, md: 6 }}><Skeleton height={250} radius="md" /></Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}><Skeleton height={250} radius="md" /></Grid.Col>
        </Grid>
      </div>
    );
  }

  const ligaPrize = prizes.data.prizes.find((p) => p.kind === 'liga');
  const cupPrizes = prizes.data.prizes.filter((p) => p.kind === 'copa');
  const cupOptions = (cups.data?.cups ?? []).map((c) => ({ value: String(c.id), label: c.name }));

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
          <IconTrophy size={22} color="#F59E0B" />
          <Text
            fw={800}
            style={{
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              fontSize: '28px',
              color: '#F9FAFB',
            }}
          >
            Premios
          </Text>
        </Group>
      </Paper>

      {!isPreseason && (
        <Alert color="yellow" variant="light" mb="md">
          Los premios solo se editan en pretemporada. Vuelve al{' '}
          <em>Resumen</em> y espera al cierre de temporada.
        </Alert>
      )}

      <Grid>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card
            p="md"
            style={{
              border: '1px solid rgba(255,255,255,0.06)',
              borderLeft: '3px solid #F59E0B',
            }}
          >
            <Group gap="sm" mb="xs">
              <IconMedal size={18} color="#F59E0B" />
              <Text fw={700}>Liga (1ª división)</Text>
            </Group>
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
                styles={{ input: { fontFamily: '"Geist Mono", monospace' } }}
              />
              <ShareEditor
                shares={leagueShares}
                onChange={setLeagueShares}
                disabled={!isPreseason}
                color="#F59E0B"
              />
              <Group>
                <Button
                  onClick={() => saveLeague.mutate()}
                  loading={saveLeague.isPending}
                  disabled={!isPreseason}
                  leftSection={<IconDeviceFloppy size={16} />}
                  variant="gradient"
                  gradient={{ from: '#F59E0B', to: '#D97706' }}
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
                          <Text size="sm">¿Estás seguro de que quieres eliminar el premio de liga? Esta acción no se puede deshacer.</Text>
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
                <Group gap="xs">
                  <Text size="xs" c="dimmed">Activo:</Text>
                  <Text size="xs" fw={600} style={{ fontFamily: '"Geist Mono", monospace', color: '#F59E0B' }}>
                    {money(ligaPrize.pool)}
                  </Text>
                  <Text size="xs" c="dimmed">·</Text>
                  {ligaPrize.shares.map((s, i) => (
                    <Box
                      key={i}
                      style={{
                        width: Math.max(16, s),
                        height: 16,
                        borderRadius: 4,
                        background: POSITION_MEDALS[i] ?? '#6B7280',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontSize: '9px', fontWeight: 700, color: '#fff' }}>{s}%</Text>
                    </Box>
                  ))}
                </Group>
              )}
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card
            p="md"
            style={{
              border: '1px solid rgba(255,255,255,0.06)',
              borderLeft: '3px solid #8B5CF6',
            }}
          >
            <Group gap="sm" mb="xs">
              <IconTrophy size={18} color="#8B5CF6" />
              <Text fw={700}>Copa</Text>
            </Group>
            <Text size="xs" c="dimmed" mb="sm">
              Premio que se paga al coronarse al campeón. Eliminatoria: 1=campeón, 2=subcampeón, 3-4=semifinalistas.
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
                styles={{ input: { fontFamily: '"Geist Mono", monospace' } }}
              />
              <ShareEditor
                shares={cupShares}
                onChange={setCupShares}
                disabled={!isPreseason}
                color="#8B5CF6"
              />
              <Button
                onClick={() => saveCup.mutate()}
                loading={saveCup.isPending}
                disabled={!isPreseason || !selectedCup}
                leftSection={<IconDeviceFloppy size={16} />}
                variant="gradient"
                gradient={{ from: '#8B5CF6', to: '#7C3AED' }}
              >
                Guardar premio de copa
              </Button>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {cupPrizes.length > 0 && (
        <Paper p="md" mt="md" style={{ border: '1px solid rgba(255,255,255,0.06)', borderLeft: '3px solid #8B5CF6' }}>
          <Text fw={700} mb="sm">Premios de copa activos</Text>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Copa</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Bolsa</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reparto</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {cupPrizes.map((p, i) => (
                <Table.Tr key={p.id} className="stagger-item" style={{ animationDelay: `${i * 50}ms` }}>
                  <Table.Td fw={600}>{p.cupName ?? '—'}</Table.Td>
                  <Table.Td ta="right">
                    <Text fw={600} style={{ fontFamily: '"Geist Mono", monospace', color: '#8B5CF6' }}>
                      {money(p.pool)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {p.shares.map((s, i) => (
                        <Box
                          key={i}
                          style={{
                            width: Math.max(16, s),
                            height: 16,
                            borderRadius: 4,
                            background: POSITION_MEDALS[i] ?? '#6B7280',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text style={{ fontSize: '9px', fontWeight: 700, color: '#fff' }}>{s}%</Text>
                        </Box>
                      ))}
                    </Group>
                  </Table.Td>
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
                            <Text size="sm">¿Estás seguro de que quieres eliminar el premio de {p.cupName}? Esta acción no se puede deshacer.</Text>
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

      <Paper p="md" mt="md" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
        <Group justify="space-between" mb="sm">
          <Text fw={700}>Pagos efectuados</Text>
          {prizes.data.latestPaidYear > 0 && (
            <Box
              style={{
                padding: '2px 12px',
                borderRadius: 14,
                background: 'linear-gradient(135deg, #059669, #10B981)',
                color: '#fff',
                fontFamily: '"Geist Mono", monospace',
                fontWeight: 700,
                fontSize: '12px',
              }}
            >
              Último año pagado: {prizes.data.latestPaidYear}
            </Box>
          )}
        </Group>
        {prizes.data.payments.length === 0 ? (
          <Text c="dimmed" size="sm">Aún no se ha cerrado ninguna competición con premio.</Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Año</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Competición</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Pos.</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Equipo</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Premio</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {[...prizes.data.payments]
                .sort((a, b) => b.year - a.year || a.competitionLabel.localeCompare(b.competitionLabel) || a.position - b.position)
                .map((p, i) => (
                  <Table.Tr
                    key={`${p.year}-${p.competitionLabel}-${p.position}-${i}`}
                    className="stagger-item"
                    style={{
                      borderLeft: `3px solid ${POSITION_MEDALS[p.position - 1] ?? 'transparent'}`,
                      background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                      animationDelay: `${i * 50}ms`,
                    }}
                  >
                    <Table.Td>
                      <Text style={{ fontFamily: '"Geist Mono", monospace' }}>{p.year}</Text>
                    </Table.Td>
                    <Table.Td fw={500}>{p.competitionLabel}</Table.Td>
                    <Table.Td ta="right">
                      <Text fw={700} style={{ fontFamily: '"Geist Mono", monospace', color: POSITION_MEDALS[p.position - 1] ?? '#F9FAFB' }}>
                        {p.position}º
                      </Text>
                    </Table.Td>
                    <Table.Td fw={600}>{p.teamName}</Table.Td>
                    <Table.Td ta="right">
                      <Text fw={700} style={{ fontFamily: '"Geist Mono", monospace', color: '#10B981' }}>
                        {money(p.amount)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </div>
  );
}
