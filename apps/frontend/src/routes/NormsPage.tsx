import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Grid,
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
};

const DEFAULT_VALOR: Record<NormType, number> = {
  tope_plantilla: 75,
  minimo_competitivo: 50,
  tope_salarial: 1_000_000,
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
        ['norms', 'summary', 'standings', 'compliance'].includes(
          q.queryKey[0] as string,
        ),
    });

  const add = useMutation({
    mutationFn: () => api.addNorm(id, tipo, valor),
    onSuccess: () => {
      notifications.show({
        color: 'green',
        icon: <IconCheck size={18} />,
        title: 'Éxito',
        message: 'Norma guardada correctamente',
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
    mutationFn: (normId: number) => api.removeNorm(id, normId),
    onSuccess: () => {
      notifications.show({
        color: 'green',
        icon: <IconCheck size={18} />,
        title: 'Éxito',
        message: 'Norma eliminada',
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
  const sanction = useMutation({
    mutationFn: (v: { teamId: number; normId: number }) =>
      api.sanction(id, v.teamId, v.normId),
    onSuccess: () => {
      notifications.show({
        color: 'green',
        icon: <IconCheck size={18} />,
        title: 'Éxito',
        message: 'Sanción aplicada',
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

  if (norms.isLoading) {
    return (
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
    );
  }

  const d = norms.data;

  return (
    <Grid className="page-enter">
      <Grid.Col span={{ base: 12, md: 5 }}>
        <Card withBorder mb="md">
          <Text fw={700} mb="sm">
            Definir norma
          </Text>
          <Text size="xs" c="dimmed" mb="sm">
            Los equipos son autónomos: pueden incumplir. Tú decides si sancionas
            (§4.7). Dejar incumplimientos sin sancionar resta prestigio.
          </Text>
          <Stack>
            <Select
              label="Tipo"
              data={[
                { value: 'tope_plantilla', label: 'Tope de plantilla (máx. fuerza)' },
                {
                  value: 'minimo_competitivo',
                  label: 'Mínimo competitivo (mín. fuerza)',
                },
                {
                  value: 'tope_salarial',
                  label: 'Tope salarial (masa salarial máx. €)',
                },
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
              />
            ) : (
              <NumberInput
                label="Valor (fuerza 1–100)"
                value={valor}
                onChange={(v) => setValor(Number(v) || 0)}
                min={1}
                max={100}
              />
            )}
            <Button onClick={() => add.mutate()} loading={add.isPending} leftSection={<IconPlus size={16} />}>
              Añadir / reemplazar
            </Button>
          </Stack>
        </Card>

        <Paper withBorder p="md">
          <Text fw={700} mb="sm">
            Normas activas
          </Text>
          {d && d.norms.length > 0 ? (
            <Table>
              <Table.Tbody>
                {d.norms.map((n) => (
                  <Table.Tr key={n.id}>
                    <Table.Td>{TIPO_LABEL[n.tipo]}</Table.Td>
                    <Table.Td ta="right">{formatValor(n.tipo, n.valor)}</Table.Td>
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
                              <Text size="sm">
                                ¿Estás seguro de que quieres eliminar la norma "{TIPO_LABEL[n.tipo]}"?
                              </Text>
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
            <Text c="dimmed" size="sm">
              Sin normas. La liga no tiene reglas que hacer cumplir.
            </Text>
          )}
        </Paper>
      </Grid.Col>

      <Grid.Col span={{ base: 12, md: 7 }}>
        <Paper withBorder p="md" mb="md">
          <Text fw={700} mb="sm">
            Incumplimientos
          </Text>
          {d && d.breaches.length > 0 ? (
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Equipo</Table.Th>
                  <Table.Th>Norma</Table.Th>
                  <Table.Th ta="right">Actual / Límite</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {d.breaches.map((b) => (
                  <Table.Tr key={`${b.teamId}-${b.normId}`}>
                    <Table.Td>{b.teamName}</Table.Td>
                    <Table.Td>{TIPO_LABEL[b.tipo]}</Table.Td>
                    <Table.Td ta="right">
                      {formatValor(b.tipo, b.valorActual)} /{' '}
                      {formatValor(b.tipo, b.valor)}
                    </Table.Td>
                    <Table.Td ta="right">
                      {b.sanctioned ? (
                        <Badge color="red" variant="light">
                          Sancionado
                        </Badge>
                      ) : (
                        <Button
                          size="xs"
                          color="red"
                          variant="light"
                          loading={sanction.isPending}
                          leftSection={<IconGavel size={14} />}
                          onClick={() =>
                            modals.openConfirmModal({
                              title: 'Sancionar equipo',
                              children: (
                                <Text size="sm">
                                  ¿Estás seguro de que quieres sancionar a {b.teamName} por incumplir la norma "{TIPO_LABEL[b.tipo]}"?
                                </Text>
                              ),
                              labels: { confirm: 'Sancionar', cancel: 'Cancelar' },
                              confirmProps: { color: 'red' },
                              onConfirm: () =>
                                sanction.mutate({
                                  teamId: b.teamId,
                                  normId: b.normId,
                                }),
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
            <Text c="dimmed" size="sm">
              Ningún equipo incumple las normas actuales.
            </Text>
          )}
        </Paper>

        <Paper withBorder p="md">
          <Text fw={700} mb="sm">
            Sanciones aplicadas
          </Text>
          {d && d.sanctions.length > 0 ? (
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Año</Table.Th>
                  <Table.Th>Equipo</Table.Th>
                  <Table.Th>Motivo</Table.Th>
                  <Table.Th ta="right">Castigo</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {d.sanctions.map((sa) => (
                  <Table.Tr key={sa.id}>
                    <Table.Td>{sa.year}</Table.Td>
                    <Table.Td>{sa.teamName}</Table.Td>
                    <Table.Td>{sa.motivo}</Table.Td>
                    <Table.Td ta="right">{sa.castigo}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <Text c="dimmed" size="sm">
              Sin sanciones todavía.
            </Text>
          )}
        </Paper>
      </Grid.Col>
    </Grid>
  );
}
