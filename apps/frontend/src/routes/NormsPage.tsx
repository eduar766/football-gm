import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Grid,
  Group,
  Paper,
  Skeleton,
  Table,
  Tabs,
  Text,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { IconAlertTriangle, IconGavel } from '@tabler/icons-react';
import { EmptyState } from '../components/EmptyState';
import { AssemblyRedirectBanner } from '../components/AssemblyRedirectBanner';
import type { NormType } from '@football-gm/contracts';
import { api } from '../api';
import { useMutationWithFeedback } from '../useMutationWithFeedback';
import { QK } from '../query-keys';
import { money } from '../utils/format';
import { PageHero } from '../components/PageHero';
import { CASE_STATUS_LABEL, EXPOSURE_LEVEL_LABEL } from '../domain-labels';

const TIPO_LABEL: Record<NormType, string> = {
  tope_plantilla: 'Tope de plantilla',
  minimo_competitivo: 'Mínimo competitivo',
  tope_salarial: 'Tope salarial',
  tope_extrangeros: 'Tope de extranjeros',
  minimo_cantera: 'Mínimo cantera',
  tope_edad_media: 'Tope de edad media',
  tope_deficit: 'Tope de déficit (FFP)',
};

const formatValor = (tipo: NormType, valor: number) =>
  tipo === 'tope_salarial' || tipo === 'tope_deficit' ? money(valor) : String(valor);

const REFEREE_TRAIT_LABEL: Record<string, string> = {
  estricto: 'Estricto',
  permisivo: 'Permisivo',
  estrella: 'Estrella',
  novato: 'Novato',
};

function RefereeTable({ gameId }: { gameId: string }) {
  const id = Number(gameId);
  const desk = useQuery({ queryKey: QK.desk(id), queryFn: () => api.desk(id) });
  if (desk.isLoading || !desk.data) return null;

  return (
    <Paper p="md" mt="md" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
      <Text fw={700} mb="sm">Árbitros</Text>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Nombre</Table.Th>
            <Table.Th>Rasgo</Table.Th>
            <Table.Th ta="right">Partidos calientes limpios</Table.Th>
            <Table.Th ta="right">Última jornada caliente</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {desk.data.availableReferees.map((r) => (
            <Table.Tr key={r.id}>
              <Table.Td fw={600}>{r.name}</Table.Td>
              <Table.Td>{REFEREE_TRAIT_LABEL[r.trait] ?? r.trait}</Table.Td>
              <Table.Td ta="right">{r.hotMatchesClean}</Table.Td>
              <Table.Td ta="right">{r.lastHotMatchday || '—'}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}

function IntegrityTab({ gameId }: { gameId: string }) {
  const id = Number(gameId);
  const integrity = useQuery({ queryKey: QK.integrity(id), queryFn: () => api.integrity(id) });

  const resolve = useMutationWithFeedback({
    mutationFn: (v: { caseId: number; action: 'investigar' | 'archivar' | 'enterrar' | 'sancionar' | 'perdonar'; spendPcForDiscount?: boolean }) =>
      api.resolveCase(id, v.caseId, v.action, v.spendPcForDiscount),
    queryKeyToInvalidate: ['integrity', 'summary', 'norms', 'standings'],
    successMessage: 'Caso actualizado',
  });

  if (integrity.isLoading) return <Skeleton height={300} radius="md" />;
  const d = integrity.data;
  if (!d) return null;

  const level = EXPOSURE_LEVEL_LABEL[d.exposureLevel];

  return (
    <>
      <Alert color={level.color} mb="md" icon={<IconAlertTriangle size={18} />}>
        <Text fw={700}>{level.label}</Text>
        <Text size="sm" c="dimmed">
          El uso reiterado de impulsos a favor de los mismos clubes puede levantar sospechas de amaño.
        </Text>
      </Alert>

      {d.cases.length === 0 ? (
        <EmptyState
          icon={IconAlertTriangle}
          title="Sin casos de integridad"
          description="No hay resultados sospechosos abiertos por el momento."
        />
      ) : (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Jornada</Table.Th>
              <Table.Th>Partido</Table.Th>
              <Table.Th>Estado</Table.Th>
              <Table.Th>Detalle</Table.Th>
              <Table.Th ta="right">Acciones</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {d.cases.map((c) => {
              const status = CASE_STATUS_LABEL[c.status];
              return (
                <Table.Tr key={c.id}>
                  <Table.Td>{c.matchday}</Table.Td>
                  <Table.Td fw={600}>{c.homeName} vs {c.awayName}</Table.Td>
                  <Table.Td>
                    <Badge color={status.color} variant="light">{status.label}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">{c.resolution ?? c.suspicion}</Text>
                    {c.status === 'investigando' && c.investigationEndsMatchday !== null && (
                      <Text size="xs" c="dimmed">Termina en la jornada {c.investigationEndsMatchday}</Text>
                    )}
                  </Table.Td>
                  <Table.Td ta="right">
                    <Group gap="xs" justify="flex-end">
                      {c.status === 'abierto' && (
                        <>
                          <Button
                            size="xs"
                            color="blue"
                            loading={resolve.isPending}
                            onClick={() => resolve.mutate({ caseId: c.id, action: 'investigar' })}
                          >
                            Investigar
                          </Button>
                          <Button
                            size="xs"
                            variant="default"
                            loading={resolve.isPending}
                            onClick={() => resolve.mutate({ caseId: c.id, action: 'archivar' })}
                          >
                            Archivar
                          </Button>
                          {c.strong && (
                            <Button
                              size="xs"
                              color="grape"
                              loading={resolve.isPending}
                              onClick={() =>
                                modals.openConfirmModal({
                                  title: 'Enterrar caso',
                                  children: (
                                    <Text size="sm">
                                      Enterrar el caso conlleva un riesgo de que se filtre más adelante.
                                      ¿Gastar 3 de capital político para reducir ese riesgo?
                                    </Text>
                                  ),
                                  labels: { confirm: 'Sí, gastar 3 PC', cancel: 'No, gratis' },
                                  onConfirm: () => resolve.mutate({ caseId: c.id, action: 'enterrar', spendPcForDiscount: true }),
                                  onCancel: () => resolve.mutate({ caseId: c.id, action: 'enterrar', spendPcForDiscount: false }),
                                })
                              }
                            >
                              Enterrar
                            </Button>
                          )}
                        </>
                      )}
                      {c.status === 'confirmado' && (
                        <>
                          <Button
                            size="xs"
                            color="red"
                            loading={resolve.isPending}
                            onClick={() =>
                              modals.openConfirmModal({
                                title: 'Sancionar',
                                children: <Text size="sm">¿Sancionar a {c.suspectTeamName} por el amaño confirmado?</Text>,
                                labels: { confirm: 'Sancionar', cancel: 'Cancelar' },
                                confirmProps: { color: 'red' },
                                onConfirm: () => resolve.mutate({ caseId: c.id, action: 'sancionar' }),
                              })
                            }
                          >
                            Sancionar
                          </Button>
                          <Button
                            size="xs"
                            variant="default"
                            loading={resolve.isPending}
                            onClick={() => resolve.mutate({ caseId: c.id, action: 'perdonar' })}
                          >
                            Perdonar discretamente
                          </Button>
                        </>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}

      <RefereeTable gameId={gameId} />
    </>
  );
}

export function NormsPage() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);

  const norms = useQuery({ queryKey: QK.norms(id), queryFn: () => api.norms(id) });

  const sanction = useMutationWithFeedback({
    mutationFn: (v: { teamId: number; normId: number }) => api.sanction(id, v.teamId, v.normId),
    queryKeyToInvalidate: ['norms', 'summary', 'standings', 'compliance'],
    successMessage: 'Sanción aplicada',
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
      <PageHero
        icon={IconGavel}
        iconColor="#EF4444"
        title="Gobernanza"
        subtitle="Los equipos son autónomos: pueden incumplir. Tú decides si sancionas. Dejar incumplimientos sin sancionar resta prestigio."
      />

      <Tabs defaultValue="normas" mb="md">
        <Tabs.List>
          <Tabs.Tab value="normas" leftSection={<IconGavel size={16} />}>Normas</Tabs.Tab>
          <Tabs.Tab value="integridad" leftSection={<IconAlertTriangle size={16} />}>Integridad</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="normas" pt="md">
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
            <AssemblyRedirectBanner
              gameId={gameId}
              message="Crear o derogar una norma ahora requiere el visto bueno de la asamblea de clubes."
            />
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
                        <Text fw={700} style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: '#10B981' }}>
                          {formatValor(n.tipo, n.valor)}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="xs" c="dimmed">Derogar vía asamblea</Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <EmptyState
                icon={IconGavel}
                title="Sin normas"
                description="La liga no tiene reglas que hacer cumplir. Crea una norma para regular a los clubes."
              />
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
                          <Text fw={700} style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: '#EF4444' }}>
                            {formatValor(b.tipo, b.valorActual)}
                          </Text>
                          <Text c="dimmed" style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>/</Text>
                          <Text style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>
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
                        <Text style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>{sa.year}</Text>
                      </Table.Td>
                      <Table.Td fw={600}>{sa.teamName}</Table.Td>
                      <Table.Td c="dimmed">{sa.motivo}</Table.Td>
                      <Table.Td ta="right">
                        <Text fw={700} style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: '#EF4444' }}>
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
        </Tabs.Panel>

        <Tabs.Panel value="integridad" pt="md">
          <IntegrityTab gameId={gameId} />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
