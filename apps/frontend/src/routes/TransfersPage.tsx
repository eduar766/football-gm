import { useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Group,
  Paper,
  Select,
  Skeleton,
  Table,
  Text,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { IconArrowRight, IconWorld } from '@tabler/icons-react';
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
    return q.data.history.filter((t) => t.year === activeYear && !t.isInternational);
  }, [q.data, activeYear]);

  const internationalEntries = useMemo(() => {
    if (!q.data || activeYear == null) return [];
    return q.data.history.filter((t) => t.year === activeYear && t.isInternational);
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
      <Paper
        p="xl"
        mb="md"
        style={{
          background: 'linear-gradient(135deg, #111820 0%, #0D2818 100%)',
          border: '1px solid rgba(16,185,129,0.2)',
        }}
      >
        <Group justify="space-between">
          <div>
            <Group gap="sm">
              <IconArrowRight size={22} color="#10B981" />
              <Text
                fw={800}
                style={{
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  fontSize: '28px',
                  color: '#F9FAFB',
                }}
              >
                Ventana de fichajes
              </Text>
            </Group>
            <Text size="sm" c="dimmed" mt="xs" ml={34}>
              Movimientos reales entre clubes en la pretemporada. Los
              clubes son autónomos: el comisionado no firma fichajes, los observa.
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
            <Box
              style={{
                padding: '4px 14px',
                borderRadius: 14,
                background: 'rgba(139,92,246,0.15)',
                color: '#8B5CF6',
                fontFamily: '"Geist Mono", monospace',
                fontWeight: 700,
                fontSize: '13px',
              }}
            >
              {entries.length + internationalEntries.length} movimientos
            </Box>
          </Group>
        </Group>
      </Paper>

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
                    <Text fw={700} style={{ fontFamily: '"Geist Mono", monospace', color: e.calidad >= 70 ? '#10B981' : e.calidad >= 50 ? '#F59E0B' : '#EF4444' }}>
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

      {internationalEntries.length > 0 && (
        <Paper
          p="xl"
          mb="md"
          style={{
            background: 'linear-gradient(135deg, #111820 0%, #0D1A2D 100%)',
            border: '1px solid rgba(139,92,246,0.25)',
          }}
        >
          <Group gap="sm" mb="md">
            <IconWorld size={22} color="#8B5CF6" />
            <Text fw={800} style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '20px', color: '#F9FAFB' }}>
              Fichajes internacionales
            </Text>
            <Badge color="violet" variant="light" size="sm">
              {internationalEntries.length} estrella{internationalEntries.length !== 1 ? 's' : ''}
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
              {internationalEntries.map((e, i) => (
                <Table.Tr
                  key={`intl-${e.year}-${e.playerId}`}
                  className="stagger-item"
                  style={{
                    borderLeft: '3px solid rgba(139,92,246,0.4)',
                    background: i % 2 === 0 ? 'rgba(139,92,246,0.05)' : 'transparent',
                    animationDelay: `${i * 50}ms`,
                  }}
                >
                  <Table.Td fw={700} style={{ color: '#E9D5FF' }}>{e.playerName}</Table.Td>
                  <Table.Td ta="right">
                    <Text fw={700} style={{ fontFamily: '"Geist Mono", monospace', color: e.calidad >= 70 ? '#10B981' : e.calidad >= 50 ? '#F59E0B' : '#EF4444' }}>
                      {e.calidad}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" justify="center" wrap="nowrap">
                      <Text size="sm" c="dimmed" fw={500} style={{ minWidth: 80, textAlign: 'right' }}>
                        {e.fromTeamName}
                      </Text>
                      <Box
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: 'rgba(139,92,246,0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <IconArrowRight size={14} color="#8B5CF6" />
                      </Box>
                      <Text size="sm" fw={600} style={{ minWidth: 80, textAlign: 'left', color: '#F9FAFB' }}>
                        {e.toTeamName}
                      </Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" style={{ fontFamily: '"Geist Mono", monospace', color: '#8B5CF6' }}>
                      {e.fromFederationName ?? '—'}
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
                    <Text style={{ fontFamily: '"Geist Mono", monospace', color: '#8B5CF6' }}>
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
