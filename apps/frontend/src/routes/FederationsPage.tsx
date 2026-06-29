import { Box, Group, Paper, Skeleton, Table, Tabs, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { IconBuilding, IconChartLine, IconWorld } from '@tabler/icons-react';
import { api } from '../api';
import type { FederationListItem } from '@football-gm/contracts';
import { PageHero } from '../components/PageHero';

const TIER_COLOR: Record<number, string> = {
  1: '#F59E0B',
  2: '#9CA3AF',
  3: '#D97706',
  4: '#6B7280',
  5: '#4B5563',
};

function FedRow({ f, index, gameId }: { f: FederationListItem; index: number; gameId: string }) {
  return (
    <Table.Tr
      key={f.id}
      className="stagger-item"
      style={{
        borderLeft: f.isPlayer ? '3px solid #10B981' : '3px solid transparent',
        background: f.isPlayer
          ? 'rgba(16,185,129,0.06)'
          : index % 2 === 0
            ? 'rgba(255,255,255,0.02)'
            : 'transparent',
        transition: 'border-color 0.15s, background 0.15s',
        animationDelay: `${index * 50}ms`,
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
          <Link
            to={f.isPlayer ? '/games/$gameId/federation' : '/games/$gameId/federations/$fedId'}
            params={f.isPlayer ? { gameId } : { gameId, fedId: String(f.id) }}
          >
            <Text fw={f.isPlayer ? 700 : 400} style={{ fontFamily: '"DM Sans", sans-serif', color: f.isPlayer ? '#10B981' : '#60A5FA', cursor: 'pointer' }}>
              {f.name}
            </Text>
          </Link>
        </Group>
      </Table.Td>
      <Table.Td ta="right">
        <Group gap="xs" justify="flex-end" wrap="nowrap">
          <Text fw={700} style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: '#F59E0B' }}>
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
            fontFamily: 'var(--mantine-font-family-monospace)',
            fontWeight: 700,
            fontSize: '13px',
          }}
        >
          {f.tier}
        </Box>
      </Table.Td>
      <Table.Td ta="right" style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>
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
  );
}

export function FederationsPage() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);
  const feds = useQuery({
    queryKey: ['federations', id],
    queryFn: () => api.federations(id),
  });
  const ranking = useQuery({
    queryKey: ['world-ranking', id],
    queryFn: () => api.worldRanking(id),
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
      <PageHero
        icon={IconBuilding}
        iconColor="#10B981"
        title="Federaciones"
        subtitle="Tu federación y las rivales son el mismo modelo. Robar un equipo mueve prestigio de una a otra."
      />

      <Tabs defaultValue="federaciones" variant="pills" radius="md">
        <Tabs.List
          mb="md"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10,
            padding: 4,
          }}
        >
          <Tabs.Tab value="federaciones" leftSection={<IconBuilding size={16} />} style={{ fontWeight: 600 }}>
            Federaciones
          </Tabs.Tab>
          <Tabs.Tab value="ranking" leftSection={<IconChartLine size={16} />} style={{ fontWeight: 600 }}>
            Ranking Mundial
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="federaciones">
          <Paper p="md" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            {(() => {
              const allFeds = feds.data ?? [];
              const playerFeds = allFeds.filter(f => f.isPlayer);
              const byConf = new Map<string, FederationListItem[]>();
              for (const f of allFeds) {
                if (f.isPlayer) continue;
                const conf = f.confederationName ?? 'Sin confederación';
                const arr = byConf.get(conf) ?? [];
                arr.push(f);
                byConf.set(conf, arr);
              }
              let rowIdx = 0;

              return (
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
                    {playerFeds.map((f) => (
                      <FedRow key={f.id} f={f} index={rowIdx++} gameId={gameId} />
                    ))}
                    {[...byConf.entries()].map(([confName, confFeds]) => [
                      <Table.Tr key={`conf-${confName}`}>
                        <Table.Td colSpan={5} style={{ padding: '8px 0 4px' }}>
                          <Group gap="xs">
                            <IconWorld size={14} color="#3B82F6" />
                            <Text size="sm" fw={600} c="dimmed">{confName}</Text>
                          </Group>
                        </Table.Td>
                      </Table.Tr>,
                      ...confFeds.sort((a, b) => b.prestige - a.prestige).map((f) => (
                        <FedRow key={f.id} f={f} index={rowIdx++} gameId={gameId} />
                      )),
                    ])}
                  </Table.Tbody>
                </Table>
              );
            })()}
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="ranking">
          <Paper p="md" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            {(ranking.data?.rows ?? []).length === 0 ? (
              <Box py="xl" style={{ textAlign: 'center' }}>
                <IconChartLine size={40} color="rgba(255,255,255,0.15)" style={{ marginBottom: 12 }} />
                <Text c="dimmed" fw={500}>Aún sin datos de coeficiente.</Text>
                <Text size="sm" c="dimmed" mt={4}>El ranking se actualiza al cerrar cada temporada.</Text>
              </Box>
            ) : (
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>#</Table.Th>
                    <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Federación</Table.Th>
                    <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Coef. acum.</Table.Th>
                    <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Ult. ranking</Table.Th>
                    <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Temporadas</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {(ranking.data?.rows ?? []).map((row, i) => (
                    <Table.Tr
                      key={row.federationId}
                      className="stagger-item"
                      style={{
                        borderLeft: row.isPlayer ? '3px solid #10B981' : '3px solid transparent',
                        background: row.isPlayer ? 'rgba(16,185,129,0.06)' : i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                        animationDelay: `${i * 30}ms`,
                      }}
                    >
                      <Table.Td>
                        <Text style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                          {i + 1}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          {row.isPlayer && (
                            <Box style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', flexShrink: 0 }} />
                          )}
                          <Text fw={row.isPlayer ? 700 : 400} style={{ color: row.isPlayer ? '#10B981' : undefined }}>
                            {row.name}
                          </Text>
                        </Group>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text fw={700} style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: '#F59E0B' }}>
                          {row.cumulativeScore.toFixed(1)}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: 'rgba(255,255,255,0.6)' }}>
                          #{row.lastRank}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: 'rgba(255,255,255,0.4)' }}>
                          {row.seasonsRanked}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Paper>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
