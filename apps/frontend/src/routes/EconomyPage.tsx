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
  Skeleton,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { IconCheck, IconFileInvoice, IconPlayerPlay, IconX } from '@tabler/icons-react';
import type { FinancialHealth } from '@football-gm/contracts';
import { api } from '../api';
import { money } from '../utils/format';
import { EconomyChart } from '../components/EconomyChart';

const HEALTH: Record<FinancialHealth, { label: string; color: string }> = {
  saneada: { label: 'Saneada', color: 'green' },
  ajustada: { label: 'Ajustada', color: 'blue' },
  en_riesgo: { label: 'En riesgo', color: 'yellow' },
  quiebra: { label: 'Quiebra', color: 'red' },
};

export function EconomyPage() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);
  const qc = useQueryClient();

  const eco = useQuery({ queryKey: ['economy', id], queryFn: () => api.economy(id) });
  const compliance = useQuery({
    queryKey: ['compliance', id],
    queryFn: () => api.compliance(id),
  });

  const [talent, setTalent] = useState(0);
  useEffect(() => {
    if (eco.data) {
      setTalent(eco.data.policy.talentInvestment);
    }
  }, [eco.data]);

  const invalidate = () =>
    qc.invalidateQueries({
      predicate: (q) =>
        ['economy', 'summary', 'structure', 'teams'].includes(
          q.queryKey[0] as string,
        ),
    });

  const savePolicy = useMutation({
    mutationFn: () =>
      api.setEconomyPolicy(id, { talentInvestment: talent }),
    onSuccess: () => {
      notifications.show({
        color: 'green',
        icon: <IconCheck size={18} />,
        title: 'Éxito',
        message: 'Política económica guardada',
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
  const sign = useMutation({
    mutationFn: (offerId: number) => api.signContract(id, offerId),
    onSuccess: () => {
      notifications.show({
        color: 'green',
        icon: <IconCheck size={18} />,
        title: 'Éxito',
        message: 'Contrato firmado',
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
  const cancel = useMutation({
    mutationFn: (contractId: number) => api.cancelContract(id, contractId),
    onSuccess: () => {
      notifications.show({
        color: 'green',
        icon: <IconCheck size={18} />,
        title: 'Éxito',
        message: 'Contrato cancelado',
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

  if (eco.isLoading || !eco.data) {
    return (
      <Stack>
        <Grid>
          <Grid.Col span={{ base: 12, md: 5 }}>
            <Skeleton height={160} radius="md" />
            <Skeleton height={150} radius="md" mt="md" />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 7 }}>
            <Skeleton height={160} radius="md" />
            <Skeleton height={150} radius="md" mt="md" />
            <Skeleton height={150} radius="md" mt="md" />
          </Grid.Col>
        </Grid>
        <Skeleton height={200} radius="md" />
      </Stack>
    );
  }

  const e = eco.data;
  const h = HEALTH[e.financialHealth];

  return (
    <Stack className="page-enter">
    <Grid>
      <Grid.Col span={{ base: 12, md: 5 }}>
        <Card withBorder mb="md">
          <Text size="xs" c="dimmed" tt="uppercase">
            Tesorería
          </Text>
          <Group justify="space-between" align="center">
            <Text size="28px" fw={800} c={e.treasury < 0 ? 'red' : undefined}>
              {money(e.treasury)}
            </Text>
            <Badge size="lg" color={h.color} variant="light">
              {h.label}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed" mt="xs">
            Coste operativo actual: {money(e.operatingCostNow)} / año (escala con
            equipos y divisiones — §5).
          </Text>
          {e.treasury < 0 && (
            <Alert color="red" mt="sm">
              En números rojos: no podrás celebrar una liga de nivelación hasta
              sanear las cuentas.
            </Alert>
          )}
        </Card>

        <Paper withBorder p="md">
          <Text fw={700} mb="sm">
            Última temporada{e.last ? ` (año ${e.last.year})` : ''}
          </Text>
          {e.last ? (
            <Table>
              <Table.Tbody>
                <Table.Tr>
                  <Table.Td>Ingresos comerciales</Table.Td>
                  <Table.Td ta="right" c="green">
                    +{money(e.last.income)}
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Coste operativo</Table.Td>
                  <Table.Td ta="right" c="red">
                    −{money(e.last.operatingCost)}
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Premios</Table.Td>
                  <Table.Td ta="right" c="red">
                    −{money(e.last.prizes)}
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Inversión en talento</Table.Td>
                  <Table.Td ta="right" c="red">
                    −{money(e.last.talent)}
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td fw={700}>Neto</Table.Td>
                  <Table.Td ta="right" fw={700} c={e.last.net < 0 ? 'red' : 'green'}>
                    {e.last.net >= 0 ? '+' : '−'}
                    {money(Math.abs(e.last.net))}
                  </Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>
          ) : (
            <Text c="dimmed" size="sm">
              Aún no se ha cerrado ninguna temporada.
            </Text>
          )}
        </Paper>
      </Grid.Col>

      <Grid.Col span={{ base: 12, md: 7 }}>
        <Card withBorder mb="md">
          <Text fw={700} mb="sm">
            Política económica
          </Text>
          <Text size="xs" c="dimmed" mb="sm">
            Los premios se definen por competición en la pestaña{' '}
            <em>Premios</em>; aquí solo queda la inversión en talento.
          </Text>
          <Stack>
            <NumberInput
              label="Inversión en formación de talento (€)"
              description="Sube poco a poco la calidad de los equipos de la liga."
              value={talent}
              onChange={(v) => setTalent(Number(v) || 0)}
              min={0}
              step={1_000_000}
              thousandSeparator="."
              decimalSeparator=","
            />
            <Group>
              <Button
                onClick={() => savePolicy.mutate()}
                loading={savePolicy.isPending}
                leftSection={<IconFileInvoice size={16} />}
              >
                Guardar política
              </Button>
            </Group>
          </Stack>
        </Card>

        <Paper withBorder p="md" mb="md">
          <Text fw={700} mb="sm">
            Contratos activos
          </Text>
          {e.contracts.length === 0 ? (
            <Text c="dimmed" size="sm">
              Sin contratos. Firma alguna oferta abajo.
            </Text>
          ) : (
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Tipo</Table.Th>
                  <Table.Th ta="right">Valor anual</Table.Th>
                  <Table.Th ta="right">Años</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {e.contracts.map((c) => (
                  <Table.Tr key={c.id}>
                    <Table.Td>{c.tipo}</Table.Td>
                    <Table.Td ta="right">{money(c.valorAnual)}</Table.Td>
                    <Table.Td ta="right">{c.yearsLeft}</Table.Td>
                    <Table.Td ta="right">
                      <Button
                        size="xs"
                        variant="subtle"
                        color="red"
                        loading={cancel.isPending && cancel.variables === c.id}
                        onClick={() =>
                          modals.openConfirmModal({
                            title: 'Cancelar contrato',
                            children: (
                              <Text size="sm">
                                ¿Estás seguro de que quieres cancelar el contrato de {c.tipo}? Esto puede tener consecuencias financieras.
                              </Text>
                            ),
                            labels: { confirm: 'Cancelar', cancel: 'No cancelar' },
                            confirmProps: { color: 'red' },
                            onConfirm: () => cancel.mutate(c.id),
                          })
                        }
                      >
                        Cancelar
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Paper>

        <Paper withBorder p="md">
          <Text fw={700} mb="sm">
            Ofertas disponibles
          </Text>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Tipo</Table.Th>
                <Table.Th ta="right">Valor anual</Table.Th>
                <Table.Th ta="right">Años</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {e.offers.map((o) => (
                <Table.Tr key={o.id}>
                  <Table.Td>{o.tipo}</Table.Td>
                  <Table.Td ta="right">{money(o.valorAnual)}</Table.Td>
                  <Table.Td ta="right">{o.years}</Table.Td>
                  <Table.Td ta="right">
                    <Button
                      size="xs"
                      variant="light"
                      loading={sign.isPending && sign.variables === o.id}
                      leftSection={<IconPlayerPlay size={14} />}
                      onClick={() => sign.mutate(o.id)}
                    >
                      Firmar
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      </Grid.Col>
    </Grid>

    {e.last && (
      <EconomyChart
        data={{
          income: e.last.income,
          operatingCost: e.last.operatingCost,
          prizes: e.last.prizes,
          talent: e.last.talent,
          net: e.last.net,
        }}
      />
    )}

    <Paper withBorder p="md">
      <Group justify="space-between" mb="sm">
        <Text fw={700}>Cumplimiento del tope salarial</Text>
        {compliance.data?.cap == null ? (
          <Badge color="gray" variant="light">Sin tope definido</Badge>
        ) : (
          <Badge color="grape" variant="light">
            Tope {money(compliance.data.cap)}
          </Badge>
        )}
      </Group>
      <Text size="xs" c="dimmed" mb="sm">
        Masa salarial anual por equipo (derivada de la calidad de la plantilla).
        Crea o ajusta la norma <em>tope_salarial</em> en Normas para fijar el límite (§4.7).
      </Text>
      {!compliance.data || compliance.data.rows.length === 0 ? (
        <Text c="dimmed" size="sm">Sin equipos en competición.</Text>
      ) : (
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Equipo</Table.Th>
              <Table.Th>División</Table.Th>
              <Table.Th ta="right">Masa salarial</Table.Th>
              <Table.Th ta="right">Estado</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {compliance.data.rows.map((r) => (
              <Table.Tr key={r.teamId}>
                <Table.Td>{r.teamName}</Table.Td>
                <Table.Td c="dimmed">{r.divisionName ?? '—'}</Table.Td>
                <Table.Td ta="right">{money(r.wageBill)}</Table.Td>
                <Table.Td ta="right">
                  {r.cap == null ? (
                    <Badge color="gray" variant="light" size="sm">—</Badge>
                  ) : r.complies ? (
                    <Badge color="green" variant="light" size="sm">Cumple</Badge>
                  ) : (
                    <Badge color="red" variant="light" size="sm">
                      Excede +{money(r.wageBill - r.cap)}
                    </Badge>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Paper>
    </Stack>
  );
}
