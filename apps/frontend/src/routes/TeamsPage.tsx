import { Box, Group, Paper, Skeleton, Table, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { IconUsers } from '@tabler/icons-react';
import { api } from '../api';

export function TeamsPage() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);
  const teams = useQuery({ queryKey: ['teams', id], queryFn: () => api.teams(id) });

  if (teams.isLoading) {
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
          <Group gap="sm">
            <IconUsers size={22} color="#10B981" />
            <Skeleton height={28} width={160} />
          </Group>
        </Paper>
        <Paper p="md" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={48} mb="xs" />
          ))}
        </Paper>
      </div>
    );
  }

  const grouped = (teams.data ?? []).reduce<Record<string, typeof teams.data>>((acc, t) => {
    const div = t.divisionName ?? 'Sin división';
    if (!acc[div]) acc[div] = [];
    acc[div].push(t);
    return acc;
  }, {});

  const divColors = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444'];

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
          <IconUsers size={22} color="#10B981" />
          <Text
            fw={800}
            style={{
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              fontSize: '28px',
              color: '#F9FAFB',
            }}
          >
            Equipos
          </Text>
          <Text size="sm" c="dimmed" ml="auto" style={{ fontFamily: '"Geist Mono", monospace' }}>
            {teams.data?.length ?? 0} equipos
          </Text>
        </Group>
      </Paper>

      {Object.entries(grouped).map(([divName, divTeams], di) => (
        <Paper
          key={divName}
          p="md"
          mb="md"
          style={{ border: '1px solid rgba(255,255,255,0.06)', borderLeft: `3px solid ${divColors[di % divColors.length]}` }}
        >
          <Group gap="sm" mb="sm">
            <Text
              fw={700}
              size="sm"
              tt="uppercase"
              style={{ color: divColors[di % divColors.length], letterSpacing: '0.05em' }}
            >
              {divName}
            </Text>
            <Text size="xs" c="dimmed" style={{ fontFamily: '"Geist Mono", monospace' }}>
              {divTeams?.length} equipos
            </Text>
          </Group>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Equipo</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Fuerza</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Prestigio</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {divTeams?.map((t, i) => (
                <Table.Tr
                  key={t.id}
                  className="stagger-item"
                  style={{
                    borderLeft: '3px solid transparent',
                    transition: 'border-color 0.15s, background 0.15s',
                    background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                    animationDelay: `${i * 50}ms`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderLeftColor = '#10B981';
                    e.currentTarget.style.background = 'rgba(16,185,129,0.04)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderLeftColor = 'transparent';
                    e.currentTarget.style.background = i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent';
                  }}
                >
                  <Table.Td>
                    <Link
                      to="/games/$gameId/teams/$teamId"
                      params={{ gameId, teamId: String(t.id) }}
                    >
                      <Text fw={600} style={{ fontFamily: '"DM Sans", sans-serif', color: '#F9FAFB' }}>
                        {t.name}
                      </Text>
                    </Link>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Group gap="xs" justify="flex-end">
                      <Text fw={700} style={{ fontFamily: '"Geist Mono", monospace', color: t.strength >= 70 ? '#10B981' : t.strength >= 50 ? '#F59E0B' : '#EF4444' }}>
                        {t.strength}
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
                            width: `${t.strength}%`,
                            height: '100%',
                            borderRadius: 3,
                            background: t.strength >= 70
                              ? 'linear-gradient(90deg, #059669, #10B981)'
                              : t.strength >= 50
                                ? 'linear-gradient(90deg, #D97706, #F59E0B)'
                                : 'linear-gradient(90deg, #DC2626, #EF4444)',
                          }}
                        />
                      </Box>
                    </Group>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text fw={600} style={{ fontFamily: '"Geist Mono", monospace', color: '#F59E0B' }}>
                      {t.prestige}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      ))}
    </div>
  );
}
