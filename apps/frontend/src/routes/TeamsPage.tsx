import { Box, Group, Paper, Skeleton, Table, Tabs, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { IconBuilding, IconUsers } from '@tabler/icons-react';
import { EmptyState } from '../components/EmptyState';
import { api } from '../api';
import { PageHero } from '../components/PageHero';

const divColors = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444'];

function TeamTable({
  teams,
  gameId,
  groupBy,
}: {
  teams: { id: number; name: string; strength: number; prestige: number; divisionName: string | null; federationId: number | null; federationName: string | null }[];
  gameId: string;
  groupBy: 'division' | 'federation';
}) {
  const grouped = teams.reduce<Record<string, typeof teams>>((acc, t) => {
    const key = groupBy === 'division' ? (t.divisionName ?? 'Sin división') : (t.federationName ?? 'Sin federación');
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  return (
    <>
      {Object.entries(grouped).map(([groupName, groupTeams], di) => (
        <Paper
          key={groupName}
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
              {groupName}
            </Text>
            <Text size="xs" c="dimmed" style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>
              {groupTeams.length} equipos
            </Text>
          </Group>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Equipo</Table.Th>
                {groupBy === 'federation' && (
                  <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>División</Table.Th>
                )}
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Fuerza</Table.Th>
                <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Prestigio</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {groupTeams.map((t, i) => (
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
                  {groupBy === 'federation' && (
                    <Table.Td>
                      <Text size="sm" c="dimmed">{t.divisionName ?? '—'}</Text>
                    </Table.Td>
                  )}
                  <Table.Td ta="right">
                    <Group gap="xs" justify="flex-end">
                      <Text fw={700} style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: t.strength >= 70 ? '#10B981' : t.strength >= 50 ? '#F59E0B' : '#EF4444' }}>
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
                    <Text fw={600} style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: '#F59E0B' }}>
                      {t.prestige}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      ))}
    </>
  );
}

export function TeamsPage() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);
  const summary = useQuery({ queryKey: ['summary', id], queryFn: () => api.summary(id) });
  const teams = useQuery({ queryKey: ['teams', id], queryFn: () => api.teams(id) });

  const playerFedId = summary.data?.federation.id;

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

  const allTeams = teams.data ?? [];
  const myTeams = playerFedId != null ? allTeams.filter((t) => t.federationId === playerFedId) : [];
  const otherTeams = playerFedId != null ? allTeams.filter((t) => t.federationId !== playerFedId) : allTeams;

  return (
    <div className="page-enter">
      <PageHero
        icon={IconUsers}
        iconColor="#10B981"
        title="Equipos"
      />

      <Tabs defaultValue="mine" variant="pills" mb="md">
        <Tabs.List
          style={{
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 12,
            padding: 4,
            marginBottom: 16,
          }}
        >
          <Tabs.Tab
            value="mine"
            leftSection={<IconBuilding size={14} />}
            style={{ borderRadius: 10, fontWeight: 600, fontFamily: '"DM Sans", sans-serif' }}
          >
            Mi federación ({myTeams.length})
          </Tabs.Tab>
          <Tabs.Tab
            value="others"
            leftSection={<IconUsers size={14} />}
            style={{ borderRadius: 10, fontWeight: 600, fontFamily: '"DM Sans", sans-serif' }}
          >
            Otras federaciones ({otherTeams.length})
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="mine">
          {myTeams.length === 0 ? (
            <Paper p="md" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
              <EmptyState
                icon={IconUsers}
                title="No hay equipos en tu federación"
                description="Incorpora clubes por negociación o crea uno desde Estructura."
              />
            </Paper>
          ) : (
            <TeamTable teams={myTeams} gameId={gameId} groupBy="division" />
          )}
        </Tabs.Panel>

        <Tabs.Panel value="others">
          {otherTeams.length === 0 ? (
            <Paper p="md" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
              <EmptyState
                icon={IconBuilding}
                title="No hay equipos en otras federaciones"
                description="Las federaciones rivales aparecerán aquí a medida que exploras el mundo."
              />
            </Paper>
          ) : (
            <TeamTable teams={otherTeams} gameId={gameId} groupBy="federation" />
          )}
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
