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
import { modals } from '@mantine/modals';
import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import {
  IconFileInvoice,
  IconPlayerPlay,
  IconArrowUp,
  IconArrowDown,
  IconArrowRight,
} from '@tabler/icons-react';
import type { FinancialHealth } from '@football-gm/contracts';
import { api } from '../api';
import { useMutationWithFeedback } from '../useMutationWithFeedback';
import { QK } from '../query-keys';
import { money } from '../utils/format';
import { EconomyChart } from '../components/EconomyChart';

const HEALTH: Record<FinancialHealth, { label: string; color: string; gradient: string }> = {
  saneada: { label: 'Saneada', color: 'green', gradient: 'linear-gradient(135deg, #059669, #10B981)' },
  ajustada: { label: 'Ajustada', color: 'blue', gradient: 'linear-gradient(135deg, #2563EB, #3B82F6)' },
  en_riesgo: { label: 'En riesgo', color: 'yellow', gradient: 'linear-gradient(135deg, #D97706, #F59E0B)' },
  quiebra: { label: 'Quiebra', color: 'red', gradient: 'linear-gradient(135deg, #DC2626, #EF4444)' },
};

const CONTRACT_COLORS: Record<string, string> = {
  patrocinio: '#10B981',
  publicidad: '#3B82F6',
  TV: '#8B5CF6',
  streaming: '#F97316',
  otro: '#6B7280',
};

function contractColor(tipo: string) {
  return CONTRACT_COLORS[tipo] ?? '#6B7280';
}

export function EconomyPage() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);

  const eco = useQuery({ queryKey: QK.economy(id), queryFn: () => api.economy(id) });
  const compliance = useQuery({
    queryKey: QK.compliance(id),
    queryFn: () => api.compliance(id),
  });
  const transfersData = useQuery({
    queryKey: QK.transfers(id),
    queryFn: () => api.transfers(id),
  });

  const [talent, setTalent] = useState(0);
  useEffect(() => {
    if (eco.data) {
      setTalent(eco.data.policy.talentInvestment);
    }
  }, [eco.data]);

  const savePolicy = useMutationWithFeedback({
    mutationFn: () =>
      api.setEconomyPolicy(id, { talentInvestment: talent }),
    queryKeyToInvalidate: ['economy', 'summary', 'structure', 'teams'],
    successMessage: 'Política económica guardada',
  });
  const sign = useMutationWithFeedback({
    mutationFn: (offerId: number) => api.signContract(id, offerId),
    queryKeyToInvalidate: ['economy', 'summary', 'structure', 'teams'],
    successMessage: 'Contrato firmado',
  });
  const cancel = useMutationWithFeedback({
    mutationFn: (contractId: number) => api.cancelContract(id, contractId),
    queryKeyToInvalidate: ['economy', 'summary', 'structure', 'teams'],
    successMessage: 'Contrato cancelado',
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
          {/* Treasury Hero */}
          <Card
            p="xl"
            radius="lg"
            style={{
              background: 'linear-gradient(135deg, #111820 0%, #1A2332 100%)',
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: e.treasury > 0
                ? '0 0 30px rgba(16,185,129,0.1)'
                : '0 0 30px rgba(239,68,68,0.1)',
            }}
          >
            <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="xs">
              Tesorería
            </Text>
            <Text
              fw={800}
              style={{
                fontFamily: '"Geist Mono", monospace',
                fontSize: '36px',
                color: e.treasury >= 0 ? '#10B981' : '#EF4444',
                lineHeight: 1,
              }}
            >
              {e.treasury >= 0 ? '+' : '−'}{money(Math.abs(e.treasury))}
            </Text>
            <Badge
              size="lg"
              variant="filled"
              mt="sm"
              style={{ background: h.gradient }}
            >
              {h.label}
            </Badge>
            <Text size="sm" c="dimmed" mt="md">
              Coste operativo actual:{' '}
              <span style={{ fontFamily: '"Geist Mono", monospace' }}>
                {money(e.operatingCostNow)}
              </span>{' '}
              / año (escala con equipos y divisiones).
            </Text>
            {e.treasury < 0 && (
              <Alert color="red" mt="sm">
                En números rojos: no podrás celebrar una liga de nivelación hasta
                sanear las cuentas.
              </Alert>
            )}
          </Card>

          {/* Last Season Breakdown */}
          <Paper withBorder p="md" mt="md">
            <Text fw={700} mb="sm">
              Última temporada{e.last ? ` (año ${e.last.year})` : ''}
            </Text>
            {e.last ? (
              <Table>
                <Table.Tbody>
                  <Table.Tr>
                    <Table.Td>
                      <Group gap="xs">
                        <IconArrowUp size={14} color="#10B981" />
                        Ingresos comerciales
                      </Group>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text
                        fw={600}
                        style={{ fontFamily: '"Geist Mono", monospace', color: '#10B981' }}
                      >
                        +{money(e.last.income)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>
                      <Group gap="xs">
                        <IconArrowDown size={14} color="#EF4444" />
                        Coste operativo
                      </Group>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text
                        fw={600}
                        style={{ fontFamily: '"Geist Mono", monospace', color: '#EF4444' }}
                      >
                        −{money(e.last.operatingCost)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>
                      <Group gap="xs">
                        <IconArrowDown size={14} color="#EF4444" />
                        Premios
                      </Group>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text
                        fw={600}
                        style={{ fontFamily: '"Geist Mono", monospace', color: '#EF4444' }}
                      >
                        −{money(e.last.prizes)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>
                      <Group gap="xs">
                        <IconArrowDown size={14} color="#EF4444" />
                        Inversión en talento
                      </Group>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text
                        fw={600}
                        style={{ fontFamily: '"Geist Mono", monospace', color: '#EF4444' }}
                      >
                        −{money(e.last.talent)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td
                      fw={700}
                      style={{
                        background: e.last.net >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                      }}
                    >
                      Neto
                    </Table.Td>
                    <Table.Td
                      ta="right"
                      fw={700}
                      style={{
                        fontFamily: '"Geist Mono", monospace',
                        fontSize: '15px',
                        color: e.last.net >= 0 ? '#10B981' : '#EF4444',
                        background: e.last.net >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                      }}
                    >
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
          {/* Next-season treasury projection */}
          {(() => {
            const projectedIncome = e.contracts
              .filter((c) => c.yearsLeft > 0)
              .reduce((sum, c) => sum + c.valorAnual, 0);
            const projectedCosts = e.operatingCostNow + e.policy.talentInvestment;
            const projectedNet = projectedIncome - projectedCosts;
            const projectedTreasury = e.treasury + projectedNet;
            return (
              <Paper withBorder p="md" mt="md">
                <Text fw={700} mb="sm">Proyección próxima temporada</Text>
                <Table>
                  <Table.Tbody>
                    <Table.Tr>
                      <Table.Td><Group gap="xs"><IconArrowUp size={14} color="#10B981" />Ingresos (contratos activos)</Group></Table.Td>
                      <Table.Td ta="right"><Text fw={600} style={{ fontFamily: '"Geist Mono", monospace', color: '#10B981' }}>+{money(projectedIncome)}</Text></Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td><Group gap="xs"><IconArrowDown size={14} color="#EF4444" />Coste operativo</Group></Table.Td>
                      <Table.Td ta="right"><Text fw={600} style={{ fontFamily: '"Geist Mono", monospace', color: '#EF4444' }}>−{money(e.operatingCostNow)}</Text></Table.Td>
                    </Table.Tr>
                    {e.policy.talentInvestment > 0 && (
                      <Table.Tr>
                        <Table.Td><Group gap="xs"><IconArrowDown size={14} color="#EF4444" />Inversión talento</Group></Table.Td>
                        <Table.Td ta="right"><Text fw={600} style={{ fontFamily: '"Geist Mono", monospace', color: '#EF4444' }}>−{money(e.policy.talentInvestment)}</Text></Table.Td>
                      </Table.Tr>
                    )}
                    <Table.Tr>
                      <Table.Td fw={700} style={{ background: projectedNet >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)' }}>
                        <Group gap="xs">
                          {projectedNet >= 0
                            ? <IconArrowRight size={14} color="#10B981" />
                            : <IconArrowRight size={14} color="#EF4444" />}
                          Neto estimado
                        </Group>
                      </Table.Td>
                      <Table.Td ta="right" fw={700} style={{ fontFamily: '"Geist Mono", monospace', fontSize: '15px', color: projectedNet >= 0 ? '#10B981' : '#EF4444', background: projectedNet >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)' }}>
                        {projectedNet >= 0 ? '+' : '−'}{money(Math.abs(projectedNet))}
                      </Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={700}>Tesorería estimada</Table.Td>
                      <Table.Td ta="right" fw={800} style={{ fontFamily: '"Geist Mono", monospace', fontSize: '15px', color: projectedTreasury >= 0 ? '#10B981' : '#EF4444' }}>
                        {projectedTreasury >= 0 ? '+' : '−'}{money(Math.abs(projectedTreasury))}
                      </Table.Td>
                    </Table.Tr>
                  </Table.Tbody>
                </Table>
                {projectedTreasury < 0 && (
                  <Alert color="red" mt="sm" icon={<IconArrowDown size={14} />}>
                    Proyección negativa. Firma nuevos contratos o reduce la inversión en talento para evitar quiebra.
                  </Alert>
                )}
              </Paper>
            );
          })()}
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 7 }}>
          {/* Policy */}
          <Card withBorder p="md" mb="md">
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
                styles={{
                  input: { fontFamily: '"Geist Mono", monospace' },
                }}
              />
              <Group>
                <Button
                  onClick={() => savePolicy.mutate(undefined as void)}
                  loading={savePolicy.isPending}
                  leftSection={<IconFileInvoice size={16} />}
                  variant="gradient"
                  gradient={{ from: '#10B981', to: '#059669' }}
                  size="md"
                >
                  Guardar política
                </Button>
              </Group>
            </Stack>
          </Card>

          {/* Active Contracts */}
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
                    <Table.Th>Patrocinador</Table.Th>
                    <Table.Th>Tipo</Table.Th>
                    <Table.Th ta="right">Valor anual</Table.Th>
                    <Table.Th ta="right">Años</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {e.contracts.map((c, i) => (
                    <Table.Tr key={c.id} className="stagger-item" style={{ animationDelay: `${i * 50}ms` }}>
                      <Table.Td fw={600}>{c.nombre}</Table.Td>
                      <Table.Td>
                        <Badge
                          size="sm"
                          variant="light"
                          style={{
                            backgroundColor: `${contractColor(c.tipo)}1A`,
                            color: contractColor(c.tipo),
                          }}
                        >
                          {c.tipo}
                        </Badge>
                      </Table.Td>
                      <Table.Td ta="right" fw={600} style={{ fontFamily: '"Geist Mono", monospace' }}>
                        {money(c.valorAnual)}
                      </Table.Td>
                      <Table.Td ta="right" style={{ fontFamily: '"Geist Mono", monospace' }}>
                        {c.yearsLeft}
                      </Table.Td>
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
                                  ¿Estás seguro de que quieres cancelar el contrato con {c.nombre} ({c.tipo})? Esto puede tener consecuencias financieras.
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

          {/* Offers */}
          <Paper withBorder p="md">
            <Text fw={700} mb="sm">
              Ofertas disponibles
            </Text>
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Patrocinador</Table.Th>
                  <Table.Th>Tipo</Table.Th>
                  <Table.Th ta="right">Valor anual</Table.Th>
                  <Table.Th ta="right">Años</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {e.offers.map((o, i) => (
                  <Table.Tr key={o.id} className="stagger-item" style={{ animationDelay: `${i * 50}ms` }}>
                    <Table.Td fw={600}>{o.nombre}</Table.Td>
                    <Table.Td>
                      <Badge
                        size="sm"
                        variant="light"
                        style={{
                          backgroundColor: `${contractColor(o.tipo)}1A`,
                          color: contractColor(o.tipo),
                        }}
                      >
                        {o.tipo}
                      </Badge>
                    </Table.Td>
                    <Table.Td ta="right" fw={600} style={{ fontFamily: '"Geist Mono", monospace' }}>
                      {money(o.valorAnual)}
                    </Table.Td>
                    <Table.Td ta="right" style={{ fontFamily: '"Geist Mono", monospace' }}>
                      {o.years}
                    </Table.Td>
                    <Table.Td ta="right">
                      <Button
                        size="xs"
                        variant="gradient"
                        gradient={{ from: '#10B981', to: '#059669' }}
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

      {/* Compliance */}
      <Paper withBorder p="md">
        <Group justify="space-between" mb="sm">
          <Text fw={700}>Cumplimiento del tope salarial</Text>
          {compliance.data?.cap == null ? (
            <Badge color="gray" variant="light">Sin tope definido</Badge>
          ) : (
            <Badge color="grape" variant="light">
              Tope{' '}
              <span style={{ fontFamily: '"Geist Mono", monospace' }}>
                {money(compliance.data.cap)}
              </span>
            </Badge>
          )}
        </Group>
        <Text size="xs" c="dimmed" mb="sm">
          Masa salarial anual por equipo (derivada de la calidad de la plantilla).
          Crea o ajusta la norma <em>tope_salarial</em> en Normas para fijar el límite.
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
              {compliance.data.rows.map((r, i) => {
                return (
                  <Table.Tr key={r.teamId} className="stagger-item" style={{ animationDelay: `${i * 50}ms` }}>
                    <Table.Td>{r.teamName}</Table.Td>
                    <Table.Td c="dimmed">{r.divisionName ?? '—'}</Table.Td>
                    <Table.Td ta="right" fw={600} style={{ fontFamily: '"Geist Mono", monospace' }}>
                      {money(r.wageBill)}
                    </Table.Td>
                    <Table.Td ta="right">
                      {r.cap == null ? (
                        <Badge color="gray" variant="light" size="sm">—</Badge>
                      ) : r.complies ? (
                        <Badge color="green" variant="light" size="sm">Cumple</Badge>
                      ) : (
                        <Badge color="red" variant="light" size="sm">
                          Excede +<span style={{ fontFamily: '"Geist Mono", monospace' }}>{money(r.wageBill - r.cap)}</span>
                        </Badge>
                      )}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      {/* Transfer Activity */}
      <Paper withBorder p="md">
        <Text fw={700} mb="sm">
          Actividad de fichajes
        </Text>
        <Text size="xs" c="dimmed" mb="sm">
          Movimientos de la temporada actual con sus comisiones.
        </Text>
        {transfersData.data?.entries && transfersData.data.entries.length > 0 ? (
          (() => {
            const totalFeesPaid = transfersData.data!.entries.reduce((sum, t) => sum + (Number((t as Record<string, unknown>).transferFee) || 0), 0);
            return (
              <>
                <Table striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Jugador</Table.Th>
                      <Table.Th>Desde</Table.Th>
                      <Table.Th />
                      <Table.Th>Hacia</Table.Th>
                      <Table.Th ta="right">Comisión</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {transfersData.data!.entries.map((t, i) => (
                      <Table.Tr key={`${t.year}-${t.playerId}`} className="stagger-item" style={{ animationDelay: `${i * 50}ms` }}>
                        <Table.Td>{t.playerName}</Table.Td>
                        <Table.Td c="dimmed">{t.fromTeamName}</Table.Td>
                        <Table.Td ta="center">
                          <IconArrowRight size={14} color="#5A6A7A" />
                        </Table.Td>
                        <Table.Td fw={500}>{t.toTeamName}</Table.Td>
                        <Table.Td ta="right">
                          {(() => {
                            const fee = Number((t as Record<string, unknown>).transferFee);
                            return fee > 0 ? (
                              <Text fw={600} style={{ fontFamily: '"Geist Mono", monospace', color: '#10B981' }}>
                                {(fee / 1_000_000).toFixed(1)} M€
                              </Text>
                            ) : (
                              <Text c="dimmed">—</Text>
                            );
                          })()}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
                {totalFeesPaid > 0 && (
                  <Group justify="flex-end" mt="sm">
                    <Text size="sm" c="dimmed">Total comisiones:</Text>
                    <Text fw={700} style={{ fontFamily: '"Geist Mono", monospace', color: '#10B981' }}>
                      {(totalFeesPaid / 1_000_000).toFixed(1)} M€
                    </Text>
                  </Group>
                )}
              </>
            );
          })()
        ) : (
          <Text c="dimmed" size="sm">
            Sin actividad de fichajes en la temporada actual.
          </Text>
        )}
      </Paper>

      {/* Wage Budget */}
      {compliance.data && compliance.data.rows.length > 0 && (
        <Paper withBorder p="md">
          <Text fw={700} mb="sm">
            Presupuesto salarial
          </Text>
          <Text size="xs" c="dimmed" mb="sm">
            Tope salarial por equipo y estado de cumplimiento.
          </Text>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Equipo</Table.Th>
                <Table.Th ta="right">Masa salarial</Table.Th>
                <Table.Th ta="right">Tope</Table.Th>
                <Table.Th ta="right">Estado</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {compliance.data.rows.map((r, i) => (
                <Table.Tr key={r.teamId} className="stagger-item" style={{ animationDelay: `${i * 50}ms` }}>
                  <Table.Td>{r.teamName}</Table.Td>
                  <Table.Td ta="right" fw={600} style={{ fontFamily: '"Geist Mono", monospace' }}>
                    {money(r.wageBill)}
                  </Table.Td>
                  <Table.Td ta="right" style={{ fontFamily: '"Geist Mono", monospace' }}>
                    {r.cap != null ? money(r.cap) : '—'}
                  </Table.Td>
                  <Table.Td ta="right">
                    {r.cap == null ? (
                      <Badge color="gray" variant="light" size="sm">Sin tope</Badge>
                    ) : r.complies ? (
                      <Badge color="green" variant="light" size="sm">Cumple</Badge>
                    ) : (
                      <Badge color="red" variant="light" size="sm">Excede</Badge>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}
    </Stack>
  );
}
