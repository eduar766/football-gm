import { Badge, Box, Card, Group, Paper, SimpleGrid, Skeleton, Stack, Table, Text, Tooltip } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { IconBuilding, IconTrophy } from '@tabler/icons-react';
import { api } from '../api';

const TIER_CONFIG: Record<number, { label: string; color: string; gradient: string }> = {
  1: { label: 'Tier 1', color: '#F59E0B', gradient: 'linear-gradient(135deg, #D97706, #F59E0B)' },
  2: { label: 'Tier 2', color: '#9CA3AF', gradient: 'linear-gradient(135deg, #6B7280, #9CA3AF)' },
  3: { label: 'Tier 3', color: '#D97706', gradient: 'linear-gradient(135deg, #92400E, #D97706)' },
  4: { label: 'Tier 4', color: '#6B7280', gradient: 'linear-gradient(135deg, #4B5563, #6B7280)' },
  5: { label: 'Tier 5', color: '#4B5563', gradient: 'linear-gradient(135deg, #374151, #4B5563)' },
};

export function FederationPage() {
  const { gameId, fedId } = useParams({ strict: false }) as {
    gameId: string;
    fedId?: string;
  };
  const id = Number(gameId);

  // If fedId is provided, show that federation; otherwise show the player's.
  const isRival = fedId != null;

  const fed = useQuery({
    queryKey: isRival ? ['federation', id, fedId] : ['federation', id],
    queryFn: () => isRival ? api.federationById(id, Number(fedId)) : api.federation(id),
  });

  if (fed.isLoading || !fed.data) {
    return (
      <div className="page-enter">
        <Skeleton height={160} radius="md" mb="md" />
        <Skeleton height={200} radius="md" />
      </div>
    );
  }

  const f = fed.data;
  const tier = TIER_CONFIG[f.tier] ?? TIER_CONFIG[5];

  return (
    <div className="page-enter">
      <Card
        p="xl"
        radius="lg"
        mb="md"
        style={{
          background: 'linear-gradient(135deg, #111820 0%, #1A2332 100%)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: f.isPlayer ? '0 0 40px rgba(16,185,129,0.1)' : undefined,
        }}
      >
        <Group justify="space-between" align="flex-start">
          <div>
            <Group gap="sm" mb="xs">
              <IconBuilding size={22} color={f.isPlayer ? '#10B981' : '#3B82F6'} />
              <Text
                fw={800}
                style={{
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  fontSize: '28px',
                  color: '#F9FAFB',
                }}
              >
                {f.name}
              </Text>
            </Group>
            <Group gap="xs">
              <Text size="sm" c="dimmed">
                {f.leagueName ?? 'Sin liga'} · {f.teamCount} equipos
              </Text>
              {f.isPlayer && (
                <Badge size="sm" variant="filled" style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
                  Tu federación
                </Badge>
              )}
            </Group>
          </div>
          <Group gap="md">
            <Box style={{ textAlign: 'right' }}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                Prestigio
              </Text>
              <Text
                fw={800}
                style={{
                  fontFamily: 'var(--mantine-font-family-monospace)',
                  fontSize: '32px',
                  color: '#F59E0B',
                  lineHeight: 1,
                  textShadow: '0 0 20px rgba(245,158,11,0.3)',
                }}
              >
                {f.prestige}
              </Text>
            </Box>
            <Box
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: tier.gradient,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
              }}
            >
              <Text
                fw={800}
                style={{
                  fontFamily: 'var(--mantine-font-family-monospace)',
                  fontSize: '22px',
                  color: '#fff',
                  lineHeight: 1,
                }}
              >
                {f.tier}
              </Text>
            </Box>
          </Group>
        </Group>
      </Card>

      <SimpleGrid cols={2} spacing="md" mb="md">
        <Paper withBorder p="md" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={4}>
            Equipos
          </Text>
          <Text fw={800} style={{ fontFamily: 'var(--mantine-font-family-monospace)', fontSize: '24px', color: '#10B981' }}>
            {f.teamCount}
          </Text>
        </Paper>
        <Paper withBorder p="md" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={4}>
            Divisiones
          </Text>
          <Text fw={800} style={{ fontFamily: 'var(--mantine-font-family-monospace)', fontSize: '24px', color: '#3B82F6' }}>
            {f.divisions.length}
          </Text>
        </Paper>
      </SimpleGrid>

      <Paper p="md" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
        <Text fw={700} mb="sm">
          Divisiones
        </Text>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>#</Table.Th>
              <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nombre</Table.Th>
              <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Plazas</Table.Th>
              <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Equipos</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {f.divisions.map((d, i) => (
              <Table.Tr
                key={d.id}
                className="stagger-item"
                style={{
                  borderLeft: `3px solid ${['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6'][i % 4]}`,
                  background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                  animationDelay: `${i * 50}ms`,
                }}
              >
                <Table.Td>
                  <Text fw={700} style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: 'rgba(255,255,255,0.5)' }}>
                    {d.orden}
                  </Text>
                </Table.Td>
                <Table.Td fw={600}>{d.name}</Table.Td>
                <Table.Td ta="right" style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>{d.plazas}</Table.Td>
                <Table.Td ta="right" style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: '#10B981' }}>{d.teamCount}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>

      {/* Rival federation team list */}
      {f.teams && f.teams.length > 0 && (
        <Paper p="md" mt="md" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          <Text fw={700} mb="sm">Equipos</Text>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>#</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Equipo</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Fuerza</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Arraigo</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {f.teams.map((t, i) => (
                <Table.Tr
                  key={t.teamId}
                  className="stagger-item"
                  style={{
                    background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                    animationDelay: `${i * 20}ms`,
                  }}
                >
                  <Table.Td>
                    <Text size="xs" c="dimmed" style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>{i + 1}</Text>
                  </Table.Td>
                  <Table.Td fw={500}>{t.name}</Table.Td>
                  <Table.Td ta="right">
                    <Group gap="xs" justify="flex-end" wrap="nowrap">
                      <Text fw={700} style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: t.strength >= 70 ? '#10B981' : t.strength >= 50 ? '#F59E0B' : '#EF4444' }}>
                        {t.strength}
                      </Text>
                      <Box style={{ width: 40, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', flexShrink: 0 }}>
                        <Box style={{ width: `${t.strength}%`, height: '100%', borderRadius: 3, background: t.strength >= 70 ? 'linear-gradient(90deg, #059669, #10B981)' : t.strength >= 50 ? 'linear-gradient(90deg, #D97706, #F59E0B)' : 'linear-gradient(90deg, #DC2626, #EF4444)' }} />
                      </Box>
                    </Group>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Tooltip label="Lealtad del equipo (0-100)" fz="xs">
                      <Text style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: t.arraigo >= 70 ? '#EF4444' : t.arraigo >= 40 ? '#F59E0B' : '#10B981', cursor: 'default' }}>
                        {t.arraigo}
                      </Text>
                    </Tooltip>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      {/* 11.2 — Season history (rival federations only) */}
      {f.seasonHistory && f.seasonHistory.length > 0 && (
        <Paper p="md" mt="md" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          <Group gap="xs" mb="sm">
            <IconTrophy size={16} color="#F59E0B" />
            <Text fw={700}>Historial de temporadas</Text>
          </Group>
          <Table>
            <Table.Thead>
              <Table.Tr>
                {['Año', 'Campeón', 'Copa', 'Subcampeón', 'Pichichi', 'Descensos'].map(h => (
                  <Table.Th key={h} style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {h}
                  </Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {f.seasonHistory.map((r, i) => (
                <Table.Tr
                  key={r.year}
                  className="stagger-item"
                  style={{
                    background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                    animationDelay: `${i * 30}ms`,
                  }}
                >
                  <Table.Td>
                    <Text fw={700} style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: '#F59E0B' }}>
                      {r.year}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={6}>
                      <Box style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
                      <Text fw={600} size="sm">{r.championName}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    {r.cupWinner ? (
                      <Group gap={6}>
                        <IconTrophy size={12} color="#8B5CF6" />
                        <Text size="sm" fw={500} style={{ color: '#C4B5FD' }}>{r.cupWinner.name}</Text>
                      </Group>
                    ) : (
                      <Text size="sm" c="dimmed">—</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">{r.runnerUpName ?? '—'}</Text>
                  </Table.Td>
                  <Table.Td>
                    {r.topScorer ? (
                      <Stack gap={0}>
                        <Text size="sm" fw={500}>{r.topScorer.name}</Text>
                        <Text size="xs" c="dimmed">
                          {r.topScorer.teamName} · <Text span fw={700} style={{ color: '#10B981', fontFamily: 'var(--mantine-font-family-monospace)' }}>{r.topScorer.goals}</Text> goles
                        </Text>
                      </Stack>
                    ) : (
                      <Text size="sm" c="dimmed">—</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {r.relegated.length > 0 ? (
                      <Text size="xs" c="dimmed">{r.relegated.join(', ')}</Text>
                    ) : (
                      <Text size="xs" c="dimmed">—</Text>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      {/* Rival federation standings */}
      {f.standings && f.standings.length > 0 && (
        <Paper p="md" mt="md" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          <Group gap="sm" mb="sm">
            <Text fw={700}>Tabla de Posiciones</Text>
            {f.confederationName && (
              <Badge size="sm" variant="light" color="blue">
                {f.confederationName}
              </Badge>
            )}
          </Group>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>#</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Equipo</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">PJ</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">G</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">E</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">P</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">DG</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Pts</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {f.standings.map((r, i) => (
                <Table.Tr
                  key={r.teamId}
                  className="stagger-item"
                  style={{
                    borderLeft: i === 0 ? '3px solid #F59E0B' : i < 3 ? '3px solid #10B981' : '3px solid transparent',
                    background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                    animationDelay: `${i * 30}ms`,
                  }}
                >
                  <Table.Td>
                    <Text fw={700} style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: i === 0 ? '#F59E0B' : 'rgba(255,255,255,0.5)' }}>
                      {i + 1}
                    </Text>
                  </Table.Td>
                  <Table.Td fw={i < 3 ? 600 : 400}>{r.name}</Table.Td>
                  <Table.Td ta="right" style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>{r.played}</Table.Td>
                  <Table.Td ta="right" style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>{r.won}</Table.Td>
                  <Table.Td ta="right" style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>{r.drawn}</Table.Td>
                  <Table.Td ta="right" style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>{r.lost}</Table.Td>
                  <Table.Td ta="right" style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: r.goalDiff > 0 ? '#10B981' : r.goalDiff < 0 ? '#EF4444' : undefined }}>
                    {r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text fw={700} style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: i === 0 ? '#F59E0B' : '#10B981' }}>
                      {r.points}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}
    </div>
  );
}
