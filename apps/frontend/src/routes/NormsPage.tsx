import { useState } from 'react';
import {
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
import { IconCheck, IconGavel, IconPlus, IconTrash, IconX } from '@tabler/icons-react';
import type { NormType } from '@football-gm/contracts';
import { api } from '../api';
import { money } from '../utils/format';

const TIPO_LABEL: Record<NormType, string> = {
  tope_plantilla: 'Tope de plantilla',
  minimo_competitivo: 'Mínimo competitivo',
  tope_salarial: 'Tope salarial',
  tope_extrangeros: 'Tope de extranjeros',
  minimo_cantera: 'Mínimo cantera',
  tope_edad_media: 'Tope de edad media',
};

const DEFAULT_VALOR: Record<NormType, number> = {
  tope_plantilla: 75,
  minimo_competitivo: 50,
  tope_salarial: 1_000_000,
  tope_extrangeros: 5,
  minimo_cantera: 5,
  tope_edad_media: 28,
};

const formatValor = (tipo: NormType, valor: number) =>
  tipo === 'tope_salarial' ? money(valor) : String(valor);

export function NormsPage() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);
  const qc = useQueryClient();

  const norms = useQuery({ queryKey: ['norms', id], queryFn: () => api.norms(id) });

  const [tipo, setTipo] = useState<NormType>('tope_plantilla');
  const [valor, setValor] = useState(65);

  const invalidate = () =>
    qc.invalidateQueries({
      predicate: (q) =>
        ['norms', 'summary', 'standings', 'compliance'].includes(q.queryKey[0] as string),
    });

  const add = useMutation({
    mutationFn: () => api.addNorm(id, tipo, valor),
    onSuccess: () => {
      notifications.show({ color: 'green', icon: <IconCheck size={18} />, title: 'Éxito', message: 'Norma guardada correctamente' });
      invalidate();
    },
    onError: (error: Error) => {
      notifications.show({ color: 'red', icon: <IconX size={18} />, title: 'Error', message: error.message });
    },
  });
  const remove = useMutation({
    mutationFn: (normId: number) => api.removeNorm(id, normId),
    onSuccess: () => {
      notifications.show({ color: 'green', icon: <IconCheck size={18} />, title: 'Éxito', message: 'Norma eliminada' });
      invalidate();
    },
    onError: (error: Error) => {
      notifications.show({ color: 'red', icon: <IconX size={18} />, title: 'Error', message: error.message });
    },
  });
  const sanction = useMutation({
    mutationFn: (v: { teamId: number; normId: number }) => api.sanction(id, v.teamId, v.normId),
    onSuccess: () => {
      notifications.show({ color: 'green', icon: <IconCheck size={18} />, title: 'Éxito', message: 'Sanción aplicada' });
      invalidate();
    },
    onError: (error: Error) => {
      notifications.show({ color: 'red', icon: <IconX size={18} />, title: 'Error', message: error.message });
    },
  });

  if (norms.isLoading) {
    return (
      <div className="page-enter">
        <Grid>
          <Grid.Col span={{ base: 12, md: 5 }}>
            <Skeleton height={200} radius="md" />
            <Skeleton height={150} radius="md" mt="md" />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 7 }}>
            <Skeleton height={200} radius="md" />
            <Skeleton height={150} radius="md" mt="md" />
          </Grid.Col>
        </Grid>
      </div>
    );
  }

  const d = norms.data;

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
          <IconGavel size={22} color="#EF4444" />
          <Text
            fw={800}
            style={{
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              fontSize: '28px',
              color: '#F9FAFB',
            }}
          >
            Normas
          </Text>
        </Group>
        <Text size="sm" c="dimmed" mt="xs" ml={34}>
          Los equipos son autónomos: pueden incumplir. Tú decides si sancionas
          (§4.7). Dejar incumplimientos sin sancionar resta prestigio.
        </Text>
      </Paper>

      <Grid>
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Card
            p="md"
            mb="md"
            style={{
              border: '1px solid rgba(255,255,255,0.06)',
              borderLeft: '3px solid #10B981',
            }}
          >
            <Text fw={700} mb="sm">Definir norma</Text>
            <Stack>
              <Select
                label="Tipo"
                data={[
                  { value: 'tope_plantilla', label: 'Tope de plantilla (máx. fuerza)' },
                  { value: 'minimo_competitivo', label: 'Mínimo competitivo (mín. fuerza)' },
                  { value: 'tope_salarial', label: 'Tope salarial (masa salarial máx. €)' },
                  { value: 'tope_extrangeros', label: 'Tope de extranjeros (máx. jugadores)' },
                  { value: 'minimo_cantera', label: 'Mínimo cantera (mín. canteranos)' },
                  { value: 'tope_edad_media', label: 'Tope de edad media (máx. años)' },
                ]}
                value={tipo}
                onChange={(v) => {
                  if (!v) return;
                  const next = v as NormType;
                  setTipo(next);
                  setValor(DEFAULT_VALOR[next]);
                }}
              />
              {tipo === 'tope_salarial' ? (
                <NumberInput
                  label="Tope salarial anual (€)"
                  description="Masa salarial máxima por equipo (suma de salarios)."
                  value={valor}
                  onChange={(v) => setValor(Number(v) || 0)}
                  min={0}
                  step={100_000}
                  thousandSeparator="."
                  decimalSeparator=","
                  styles={{ input: { fontFamily: '"Geist Mono", monospace' } }}
                />
              ) : tipo === 'tope_edad_media' ? (
                <NumberInput
                  label="Edad media máxima"
                  description="Edad media máxima del plantel."
                  value={valor}
                  onChange={(v) => setValor(Number(v) || 0)}
                  min={16}
                  max={40}
                  styles={{ input: { fontFamily: '"Geist Mono", monospace' } }}
                />
              ) : tipo === 'tope_extrangeros' || tipo === 'minimo_cantera' ? (
                <NumberInput
                  label={tipo === 'tope_extrangeros' ? 'Máximo de extranjeros' : 'Mínimo de canteranos'}
                  description={tipo === 'tope_extrangeros'
                    ? 'Número máximo de jugadores extranjeros en plantilla.'
                    : 'Número mínimo de jugadores canteranos en plantilla.'}
                  value={valor}
                  onChange={(v) => setValor(Number(v) || 0)}
                  min={1}
                  max={25}
                  styles={{ input: { fontFamily: '"Geist Mono", monospace' } }}
                />
              ) : (
                <NumberInput
                  label="Valor (fuerza 1–100)"
                  value={valor}
                  onChange={(v) => setValor(Number(v) || 0)}
                  min={1}
                  max={100}
                  styles={{ input: { fontFamily: '"Geist Mono", monospace' } }}
                />
              )}
              <Button
                onClick={() => add.mutate()}
                loading={add.isPending}
                leftSection={<IconPlus size={16} />}
                variant="gradient"
                gradient={{ from: '#10B981', to: '#059669' }}
              >
                Añadir / reemplazar
              </Button>
            </Stack>
          </Card>

          <Paper p="md" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <Text fw={700} mb="sm">Normas activas</Text>
            {d && d.norms.length > 0 ? (
              <Table>
                <Table.Tbody>
                  {d.norms.map((n, i) => (
                    <Table.Tr
                      key={n.id}
                      className="stagger-item"
                      style={{
                        borderLeft: '3px solid #10B981',
                        background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                        animationDelay: `${i * 50}ms`,
                      }}
                    >
                      <Table.Td fw={600}>{TIPO_LABEL[n.tipo]}</Table.Td>
                      <Table.Td ta="right">
                        <Text fw={700} style={{ fontFamily: '"Geist Mono", monospace', color: '#10B981' }}>
                          {formatValor(n.tipo, n.valor)}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Button
                          size="xs"
                          variant="subtle"
                          color="red"
                          leftSection={<IconTrash size={14} />}
                          onClick={() =>
                            modals.openConfirmModal({
                              title: 'Quitar norma',
                              children: (
                                <Text size="sm">¿Estás seguro de que quieres eliminar la norma "{TIPO_LABEL[n.tipo]}"?</Text>
                              ),
                              labels: { confirm: 'Quitar', cancel: 'Cancelar' },
                              confirmProps: { color: 'red' },
                              onConfirm: () => remove.mutate(n.id),
                            })
                          }
                        >
                          Quitar
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <Text c="dimmed" size="sm">Sin normas. La liga no tiene reglas que hacer cumplir.</Text>
            )}
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 7 }}>
          <Paper p="md" mb="md" style={{ border: '1px solid rgba(255,255,255,0.06)', borderLeft: '3px solid #EF4444' }}>
            <Text fw={700} mb="sm">Incumplimientos</Text>
            {d && d.breaches.length > 0 ? (
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Equipo</Table.Th>
                    <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Norma</Table.Th>
                    <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Actual / Límite</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {d.breaches.map((b, i) => (
                    <Table.Tr
                      key={`${b.teamId}-${b.normId}`}
                      className="stagger-item"
                      style={{
                        borderLeft: b.sanctioned ? '3px solid #EF4444' : '3px solid #F59E0B',
                        background: b.sanctioned ? 'rgba(239,68,68,0.04)' : 'rgba(245,158,11,0.04)',
                        animationDelay: `${i * 50}ms`,
                      }}
                    >
                      <Table.Td fw={600}>{b.teamName}</Table.Td>
                      <Table.Td c="dimmed">{TIPO_LABEL[b.tipo]}</Table.Td>
                      <Table.Td ta="right">
                        <Group gap={4} justify="flex-end">
                          <Text fw={700} style={{ fontFamily: '"Geist Mono", monospace', color: '#EF4444' }}>
                            {formatValor(b.tipo, b.valorActual)}
                          </Text>
                          <Text c="dimmed" style={{ fontFamily: '"Geist Mono", monospace' }}>/</Text>
                          <Text style={{ fontFamily: '"Geist Mono", monospace' }}>
                            {formatValor(b.tipo, b.valor)}
                          </Text>
                        </Group>
                      </Table.Td>
                      <Table.Td ta="right">
                        {b.sanctioned ? (
                          <Box
                            style={{
                              display: 'inline-flex',
                              padding: '2px 10px',
                              borderRadius: 12,
                              background: 'linear-gradient(135deg, #DC2626, #EF4444)',
                              color: '#fff',
                              fontWeight: 600,
                              fontSize: '12px',
                            }}
                          >
                            Sancionado
                          </Box>
                        ) : (
                          <Button
                            size="xs"
                            variant="gradient"
                            gradient={{ from: '#EF4444', to: '#DC2626' }}
                            loading={sanction.isPending}
                            leftSection={<IconGavel size={14} />}
                            onClick={() =>
                              modals.openConfirmModal({
                                title: 'Sancionar equipo',
                                children: (
                                  <Text size="sm">¿Estás seguro de que quieres sancionar a {b.teamName} por incumplir la norma "{TIPO_LABEL[b.tipo]}"?</Text>
                                ),
                                labels: { confirm: 'Sancionar', cancel: 'Cancelar' },
                                confirmProps: { color: 'red' },
                                onConfirm: () => sanction.mutate({ teamId: b.teamId, normId: b.normId }),
                              })
                            }
                          >
                            Sancionar
                          </Button>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <Text c="dimmed" size="sm">Ningún equipo incumple las normas actuales.</Text>
            )}
          </Paper>

          <Paper p="md" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <Text fw={700} mb="sm">Sanciones aplicadas</Text>
            {d && d.sanctions.length > 0 ? (
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Año</Table.Th>
                    <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Equipo</Table.Th>
                    <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Motivo</Table.Th>
                    <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Castigo</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {d.sanctions.map((sa, i) => (
                    <Table.Tr
                      key={sa.id}
                      className="stagger-item"
                      style={{
                        borderLeft: '3px solid #EF4444',
                        background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                        animationDelay: `${i * 50}ms`,
                      }}
                    >
                      <Table.Td>
                        <Text style={{ fontFamily: '"Geist Mono", monospace' }}>{sa.year}</Text>
                      </Table.Td>
                      <Table.Td fw={600}>{sa.teamName}</Table.Td>
                      <Table.Td c="dimmed">{sa.motivo}</Table.Td>
                      <Table.Td ta="right">
                        <Text fw={700} style={{ fontFamily: '"Geist Mono", monospace', color: '#EF4444' }}>
                          {sa.castigo}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <Text c="dimmed" size="sm">Sin sanciones todavía.</Text>
            )}
          </Paper>
        </Grid.Col>
      </Grid>
    </div>
  );
}
