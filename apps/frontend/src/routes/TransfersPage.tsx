import { useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Group,
  Paper,
  Select,
  Skeleton,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { IconArrowRight, IconShield, IconShieldOff, IconWorld } from '@tabler/icons-react';
import { api } from '../api';
import { useMutationWithFeedback } from '../useMutationWithFeedback';
import { QK } from '../query-keys';
import { PageHero } from '../components/PageHero';

export function TransfersPage() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);

  const q = useQuery({
    queryKey: ['transfers', id],
    queryFn: () => api.transfers(id),
  });

  const summary = useQuery({
    queryKey: QK.summary(id),
    queryFn: () => api.summary(id),
  });

  const veto = useMutationWithFeedback({
    mutationFn: (playerId: number) => api.vetoTransfer(id, playerId),
    queryKeyToInvalidate: ['transfers', 'summary'],
    successMessage: 'Traspaso vetado — el jugador está protegido esta temporada',
  });

  const cancelVeto = useMutationWithFeedback({
    mutationFn: (playerId: number) => api.cancelTransferVeto(id, playerId),
    queryKeyToInvalidate: ['transfers', 'summary'],
    successMessage: 'Veto cancelado',
  });

  const isPretemporada = summary.data?.phase === 'pretemporada';
  const activeVetoes = summary.data?.transferVetoes ?? [];

  const years = useMemo(() => {
    if (!q.data) return [] as number[];
    const set = new Set<number>(q.data.history.map((t) => t.year));
    return Array.from(set).sort((a, b) => b - a);
  }, [q.data]);

  const [year, setYear] = useState<number | null>(null);
  const activeYear = year ?? q.data?.year ?? null;
  const entries = useMemo(() => {
    if (!q.data || activeYear == null) return [];
    return q.data.history.filter((t) => t.year === activeYear && !t.isInternational);
  }, [q.data, activeYear]);

  const incomingIntl = useMemo(() => {
    if (!q.data || activeYear == null) return [];
    return q.data.history.filter((t) => t.year === activeYear && t.isInternational && !!t.fromFederationName && !t.toFederationName);
  }, [q.data, activeYear]);

  const outgoingIntl = useMemo(() => {
    if (!q.data || activeYear == null) return [];
    return q.data.history.filter((t) => t.year === activeYear && t.isInternational && !!t.toFederationName);
  }, [q.data, activeYear]);

  if (q.isLoading || !q.data) {
    return (
      <div className="page-enter">
        <Skeleton height={120} radius="md" mb="md" />
        <Skeleton height={200} radius="md" />
      </div>
    );
  }

  if (q.data.history.length === 0) {
    return (
      <div className="page-enter">
        <Paper
          p="xl"
          style={{
            background: 'linear-gradient(135deg, #111820 0%, #1A2332 100%)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <Group gap="sm" mb="xs">
            <IconArrowRight size={22} color="#10B981" />
            <Text fw={800} style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '28px', color: '#F9FAFB' }}>
              Fichajes
            </Text>
          </Group>
          <Text c="dimmed" size="sm" ml={34}>
            Aún no se ha celebrado ninguna ventana de fichajes. Cierra una
            temporada para que los clubes muevan jugadores entre sí.
          </Text>
        </Paper>
      </div>
    );
  }

  return (
    <div className="page-enter">
      <PageHero
        icon={IconArrowRight}
        iconColor="#10B981"
        title="Ventana de fichajes"
        subtitle="Movimientos reales entre clubes en la pretemporada. Los clubes son autónomos: el comisionado no firma fichajes, los observa."
      />

      {isPretemporada && q.data && q.data.vetoCandidates.length > 0 && (
        <Paper p="md" mb="md" style={{ border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.04)' }}>
          <Group gap="xs" mb="sm">
            <IconShield size={16} color="#EF4444" />
            <Text fw={700} size="sm" c="red.4">Veto de traspaso saliente</Text>
            <Badge size="xs" variant="light" color="red">{activeVetoes.length}/2 activos</Badge>
          </Group>
          <Text size="xs" c="dimmed" mb="sm">
            Protege hasta 2 jugadores de calidad ≥55 para que ligas rivales no puedan fichárlos esta temporada.
          </Text>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', textTransform: 'uppercase' }}>Jugador</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', textTransform: 'uppercase' }}>Equipo</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', textTransform: 'uppercase' }} ta="right">Cal.</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {q.data.vetoCandidates.map((p) => {
                const isVetoed = activeVetoes.includes(p.playerId);
                return (
                  <Table.Tr key={p.playerId} style={{ background: isVetoed ? 'rgba(239,68,68,0.06)' : 'transparent' }}>
                    <Table.Td fw={600}>{p.playerName} {isVetoed && <Badge size="xs" color="red" variant="light" ml={4}>Protegido</Badge>}</Table.Td>
                    <Table.Td><Text size="xs" c="dimmed">{p.teamName}</Text></Table.Td>
                    <Table.Td ta="right">
                      <Text fw={700} style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: p.calidad >= 70 ? '#10B981' : '#F59E0B', fontSize: '13px' }}>
                        {p.calidad}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="right">
                      {isVetoed ? (
                        <Tooltip label="Quitar protección">
                          <Button size="xs" variant="subtle" color="red" loading={cancelVeto.isPending && cancelVeto.variables === p.playerId} leftSection={<IconShieldOff size={12} />} onClick={() => cancelVeto.mutate(p.playerId)}>
                            Quitar
                          </Button>
                        </Tooltip>
                      ) : (
                        <Tooltip label={activeVetoes.length >= 2 ? 'Límite de 2 vetos alcanzado' : 'Vetar traspaso'}>
                          <Button size="xs" variant="light" color="red" loading={veto.isPending && veto.variables === p.playerId} leftSection={<IconShield size={12} />} disabled={activeVetoes.length >= 2} onClick={() => veto.mutate(p.playerId)}>
                            Vetar
                          </Button>
                        </Tooltip>
                      )}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      <Group justify="flex-end" mb="md">
        <Select
          size="xs"
          w={120}
          data={years.map((y) => ({ value: String(y), label: `Año ${y}` }))}
          value={activeYear != null ? String(activeYear) : null}
          onChange={(v) => setYear(v ? Number(v) : null)}
        />
        <Box
          style={{
            padding: '4px 14px',
            borderRadius: 14,
            background: 'rgba(139,92,246,0.15)',
            color: '#8B5CF6',
            fontFamily: 'var(--mantine-font-family-monospace)',
            fontWeight: 700,
            fontSize: '13px',
          }}
        >
          {entries.length + incomingIntl.length + outgoingIntl.length} movimientos
        </Box>
      </Group>

      <Paper p="md" mb="md" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
        {entries.length === 0 ? (
          <Text c="dimmed" size="sm">Sin movimientos domésticos en este año.</Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Jugador</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Cal.</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="center">Trayecto</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {entries.map((e, i) => (
                <Table.Tr
                  key={`${e.year}-${e.playerId}`}
                  className="stagger-item"
                  style={{
                    borderLeft: '3px solid transparent',
                    transition: 'border-color 0.15s, background 0.15s',
                    background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                    animationDelay: `${i * 50}ms`,
                  }}
                  onMouseEnter={(ev) => {
                    ev.currentTarget.style.borderLeftColor = '#10B981';
                  }}
                  onMouseLeave={(ev) => {
                    ev.currentTarget.style.borderLeftColor = 'transparent';
                  }}
                >
                  <Table.Td fw={600}>{e.playerName}</Table.Td>
                  <Table.Td ta="right">
                    <Text fw={700} style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: e.calidad >= 70 ? '#10B981' : e.calidad >= 50 ? '#F59E0B' : '#EF4444' }}>
                      {e.calidad}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="center">
                    <Group gap="xs" justify="center" wrap="nowrap">
                      <Text size="sm" c="dimmed" fw={500} style={{ minWidth: 80, textAlign: 'right' }}>
                        {e.fromTeamName}
                      </Text>
                      <Box
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: 'rgba(16,185,129,0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <IconArrowRight size={14} color="#10B981" />
                      </Box>
                      <Text size="sm" fw={600} style={{ minWidth: 80, textAlign: 'left', color: '#F9FAFB' }}>
                        {e.toTeamName}
                      </Text>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      {incomingIntl.length > 0 && (
        <Paper p="xl" mb="md" style={{ background: 'linear-gradient(135deg, #111820 0%, #0D1A2D 100%)', border: '1px solid rgba(139,92,246,0.25)' }}>
          <Group gap="sm" mb="md">
            <IconWorld size={22} color="#8B5CF6" />
            <Text fw={800} style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '20px', color: '#F9FAFB' }}>
              Incorporaciones internacionales
            </Text>
            <Badge color="violet" variant="light" size="sm">
              {incomingIntl.length} estrella{incomingIntl.length !== 1 ? 's' : ''}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed" mb="md">
            Figuras de ligas rivales atraídas por el diferencial de prestigio de tu federación.
            El coste de atracción se deduce de la tesorería federal.
          </Text>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Jugador</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Cal.</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="center">Origen → Destino</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Liga de origen</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {incomingIntl.map((e, i) => (
                <Table.Tr key={`in-${e.year}-${e.playerId}`} className="stagger-item"
                  style={{ borderLeft: '3px solid rgba(139,92,246,0.4)', background: i % 2 === 0 ? 'rgba(139,92,246,0.05)' : 'transparent', animationDelay: `${i * 50}ms` }}
                >
                  <Table.Td fw={700} style={{ color: '#E9D5FF' }}>{e.playerName}</Table.Td>
                  <Table.Td ta="right">
                    <Text fw={700} style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: e.calidad >= 70 ? '#10B981' : e.calidad >= 50 ? '#F59E0B' : '#EF4444' }}>
                      {e.calidad}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" justify="center" wrap="nowrap">
                      <Text size="sm" c="dimmed" fw={500} style={{ minWidth: 80, textAlign: 'right' }}>{e.fromTeamName}</Text>
                      <Box style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <IconArrowRight size={14} color="#8B5CF6" />
                      </Box>
                      <Text size="sm" fw={600} style={{ minWidth: 80, textAlign: 'left', color: '#F9FAFB' }}>{e.toTeamName}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: '#8B5CF6' }}>
                      {e.fromFederationName ?? '—'}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      {outgoingIntl.length > 0 && (
        <Paper p="xl" mb="md" style={{ background: 'linear-gradient(135deg, #111820 0%, #2D0D0D 100%)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <Group gap="sm" mb="md">
            <IconWorld size={22} color="#EF4444" />
            <Text fw={800} style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '20px', color: '#F9FAFB' }}>
              Salidas internacionales
            </Text>
            <Badge color="red" variant="light" size="sm">
              {outgoingIntl.length} baja{outgoingIntl.length !== 1 ? 's' : ''}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed" mb="md">
            Jugadores de tu liga fichados por federaciones más fuertes. El equipo vendedor recibe la cuota de traspaso.
          </Text>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Jugador</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Cal.</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="center">Equipo vendedor</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Liga de destino</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {outgoingIntl.map((e, i) => (
                <Table.Tr key={`out-${e.year}-${e.playerId}`} className="stagger-item"
                  style={{ borderLeft: '3px solid rgba(239,68,68,0.4)', background: i % 2 === 0 ? 'rgba(239,68,68,0.05)' : 'transparent', animationDelay: `${i * 50}ms` }}
                >
                  <Table.Td fw={700} style={{ color: '#FECACA' }}>{e.playerName}</Table.Td>
                  <Table.Td ta="right">
                    <Text fw={700} style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: e.calidad >= 70 ? '#10B981' : e.calidad >= 50 ? '#F59E0B' : '#EF4444' }}>
                      {e.calidad}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={600} style={{ color: '#F9FAFB' }}>{e.fromTeamName}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: '#EF4444' }}>
                      {e.toFederationName ?? '—'}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      <Paper p="md" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
        <Text fw={700} mb="sm">Histórico total</Text>
        <Text size="xs" c="dimmed" mb="sm">
          Resumen de movimientos por año desde el comienzo.
        </Text>
        <Table>
          <Table.Tbody>
            {years.map((y, i) => {
              const count = q.data!.history.filter((t) => t.year === y).length;
              return (
                <Table.Tr
                  key={y}
                  className="stagger-item"
                  style={{
                    borderLeft: '3px solid transparent',
                    background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                    animationDelay: `${i * 50}ms`,
                  }}
                >
                  <Table.Td fw={600}>Año {y}</Table.Td>
                  <Table.Td ta="right">
                    <Text style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: '#8B5CF6' }}>
                      {count} movimientos
                    </Text>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Paper>
    </div>
  );
}
