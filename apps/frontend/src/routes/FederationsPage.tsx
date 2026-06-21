import { Box, Group, Paper, Skeleton, Table, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { IconBuilding } from '@tabler/icons-react';
import { api } from '../api';

const TIER_COLOR: Record<number, string> = {
  1: '#F59E0B',
  2: '#9CA3AF',
  3: '#D97706',
  4: '#6B7280',
  5: '#4B5563',
};

export function FederationsPage() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);
  const feds = useQuery({
    queryKey: ['federations', id],
    queryFn: () => api.federations(id),
  });

  if (feds.isLoading) {
    return (
      <div className="page-enter">
        <Paper
          p="xl"
          mb="md"
          style={{
            background: 'linear-gradient(135deg, #111820 0%, #1A2332 100%)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <Skeleton height={28} width={200} />
        </Paper>
        <Paper p="md" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height={52} mb="xs" />
          ))}
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
        <Group gap="sm">
          <IconBuilding size={22} color="#10B981" />
          <Text
            fw={800}
            style={{
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              fontSize: '28px',
              color: '#F9FAFB',
            }}
          >
            Federaciones
          </Text>
        </Group>
        <Text size="sm" c="dimmed" mt="xs" ml={34}>
          Tu federación y las rivales son el mismo modelo (§3). Robar un equipo
          mueve prestigio de una a otra.
        </Text>
      </Paper>

      <Paper p="md" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Federación</Table.Th>
              <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Prestigio</Table.Th>
              <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Tier</Table.Th>
              <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Equipos</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {feds.data?.map((f, i) => (
              <Table.Tr
                key={f.id}
                className="stagger-item"
                style={{
                  borderLeft: f.isPlayer ? '3px solid #10B981' : '3px solid transparent',
                  background: f.isPlayer
                    ? 'rgba(16,185,129,0.06)'
                    : i % 2 === 0
                      ? 'rgba(255,255,255,0.02)'
                      : 'transparent',
                  transition: 'border-color 0.15s, background 0.15s',
                  animationDelay: `${i * 50}ms`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderLeftColor = '#10B981';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderLeftColor = f.isPlayer ? '#10B981' : 'transparent';
                }}
              >
                <Table.Td>
                  <Group gap="sm">
                    {f.isPlayer && (
                      <Box
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: '#10B981',
                          boxShadow: '0 0 8px rgba(16,185,129,0.5)',
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <Text fw={f.isPlayer ? 700 : 400} style={{ fontFamily: '"DM Sans", sans-serif', color: f.isPlayer ? '#10B981' : '#F9FAFB' }}>
                      {f.name}
                    </Text>
                  </Group>
                </Table.Td>
                <Table.Td ta="right">
                  <Group gap="xs" justify="flex-end" wrap="nowrap">
                    <Text fw={700} style={{ fontFamily: '"Geist Mono", monospace', color: '#F59E0B' }}>
                      {f.prestige}
                    </Text>
                    <Box
                      style={{
                        width: 48,
                        height: 6,
                        borderRadius: 3,
                        background: 'rgba(255,255,255,0.08)',
                        overflow: 'hidden',
                        flexShrink: 0,
                      }}
                    >
                      <Box
                        style={{
                          width: `${Math.min(100, f.prestige)}%`,
                          height: '100%',
                          borderRadius: 3,
                          background: 'linear-gradient(90deg, #D97706, #F59E0B)',
                        }}
                      />
                    </Box>
                  </Group>
                </Table.Td>
                <Table.Td ta="right">
                  <Box
                    style={{
                      display: 'inline-flex',
                      padding: '2px 10px',
                      borderRadius: 12,
                      background: `${TIER_COLOR[f.tier] ?? '#6B7280'}20`,
                      color: TIER_COLOR[f.tier] ?? '#6B7280',
                      fontFamily: '"Geist Mono", monospace',
                      fontWeight: 700,
                      fontSize: '13px',
                    }}
                  >
                    {f.tier}
                  </Box>
                </Table.Td>
                <Table.Td ta="right" style={{ fontFamily: '"Geist Mono", monospace' }}>
                  {f.teamCount}
                </Table.Td>
                <Table.Td ta="right">
                  {f.isPlayer && (
                    <Box
                      style={{
                        padding: '2px 10px',
                        borderRadius: 12,
                        background: 'linear-gradient(135deg, #10B981, #059669)',
                        color: '#fff',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}
                    >
                      Tú
                    </Box>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>
    </div>
  );
}
