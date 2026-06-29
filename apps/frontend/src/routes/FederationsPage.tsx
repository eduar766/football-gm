import { Box, Badge, Group, Paper, SimpleGrid, Skeleton, Stack, Table, Tabs, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import {
  IconBuilding,
  IconChartLine,
  IconMedal,
  IconShield,
  IconUsers,
  IconWorld,
} from '@tabler/icons-react';
import { api } from '../api';
import type { FederationListItem } from '@football-gm/contracts';
import { PageHero } from '../components/PageHero';

/* ── Tier config ──────────────────────────────────────────────────────── */

const TIER_CONFIG: Record<number, { color: string; label: string; bg: string }> = {
  1: { color: '#F59E0B', label: 'Tier 1', bg: 'rgba(245,158,11,0.12)' },
  2: { color: '#9CA3AF', label: 'Tier 2', bg: 'rgba(156,163,175,0.12)' },
  3: { color: '#D97706', label: 'Tier 3', bg: 'rgba(217,119,6,0.12)' },
  4: { color: '#6B7280', label: 'Tier 4', bg: 'rgba(107,114,128,0.12)' },
  5: { color: '#4B5563', label: 'Tier 5', bg: 'rgba(75,85,99,0.12)' },
};

/* ── Federation card ──────────────────────────────────────────────────── */

function FederationCard({ f, gameId }: { f: FederationListItem; gameId: string }) {
  const tier = TIER_CONFIG[f.tier] ?? TIER_CONFIG[5];

  return (
    <Link
      to={f.isPlayer ? '/games/$gameId/federation' : '/games/$gameId/federations/$fedId'}
      params={f.isPlayer ? { gameId } : { gameId, fedId: String(f.id) }}
      style={{ textDecoration: 'none' }}
    >
      <Paper
        p="sm"
        className="stagger-item"
        style={{
          border: f.isPlayer
            ? '1px solid rgba(16,185,129,0.35)'
            : '1px solid rgba(255,255,255,0.06)',
          borderLeft: `3px solid ${f.isPlayer ? '#10B981' : tier.color}`,
          background: f.isPlayer
            ? 'rgba(16,185,129,0.04)'
            : 'rgba(255,255,255,0.01)',
          cursor: 'pointer',
          transition: 'border-color 0.15s, background 0.15s',
          height: '100%',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = f.isPlayer
            ? 'rgba(16,185,129,0.07)'
            : 'rgba(255,255,255,0.04)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = f.isPlayer
            ? 'rgba(16,185,129,0.04)'
            : 'rgba(255,255,255,0.01)';
        }}
      >
        {/* Header */}
        <Group justify="space-between" wrap="nowrap" mb={6}>
          <Text
            fw={700}
            size="sm"
            style={{
              color: f.isPlayer ? '#10B981' : '#F9FAFB',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}
          >
            {f.name}
          </Text>
          <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
            {f.isPlayer && (
              <Badge size="xs" color="green" variant="filled" style={{ fontWeight: 700 }}>
                Tú
              </Badge>
            )}
            <Box
              style={{
                padding: '2px 7px',
                borderRadius: 8,
                background: tier.bg,
                color: tier.color,
                fontFamily: 'var(--mantine-font-family-monospace)',
                fontWeight: 700,
                fontSize: '11px',
                whiteSpace: 'nowrap',
              }}
            >
              T{f.tier}
            </Box>
          </Group>
        </Group>

        {/* Prestige bar */}
        <Group justify="space-between" mb={4}>
          <Text size="xs" c="dimmed">Prestigio</Text>
          <Text
            fw={700}
            size="xs"
            style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: '#F59E0B' }}
          >
            {f.prestige}
          </Text>
        </Group>
        <Box
          style={{
            height: 5,
            borderRadius: 3,
            background: 'rgba(255,255,255,0.07)',
            overflow: 'hidden',
            marginBottom: 8,
          }}
        >
          <Box
            style={{
              width: `${Math.min(100, f.prestige)}%`,
              height: '100%',
              borderRadius: 3,
              background: f.isPlayer
                ? 'linear-gradient(90deg, #059669, #10B981)'
                : 'linear-gradient(90deg, #D97706, #F59E0B)',
              transition: 'width 0.4s ease',
            }}
          />
        </Box>

        {/* Footer */}
        <Group justify="space-between">
          <Group gap={4}>
            <IconUsers size={11} color="rgba(255,255,255,0.3)" />
            <Text size="xs" c="dimmed">{f.teamCount} equipos</Text>
          </Group>
          {f.confederationName && (
            <Text size="xs" c="dimmed" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
              {f.confederationName}
            </Text>
          )}
        </Group>
      </Paper>
    </Link>
  );
}

/* ── Confederation section ────────────────────────────────────────────── */

function ConfederationSection({
  name,
  feds,
  gameId,
}: {
  name: string;
  feds: FederationListItem[];
  gameId: string;
}) {
  return (
    <Box mb="lg">
      <Group gap="xs" mb="sm">
        <IconWorld size={13} color="#3B82F6" />
        <Text size="xs" fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.07em' }}>
          {name}
        </Text>
        <Box
          style={{
            flex: 1,
            height: 1,
            background: 'rgba(255,255,255,0.06)',
            marginLeft: 4,
          }}
        />
        <Text size="xs" c="dimmed">{feds.length}</Text>
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="xs">
        {feds.sort((a, b) => b.prestige - a.prestige).map((f) => (
          <FederationCard key={f.id} f={f} gameId={gameId} />
        ))}
      </SimpleGrid>
    </Box>
  );
}

/* ── Ranking position badge ───────────────────────────────────────────── */

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return (
    <Box style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg, #F59E0B, #D97706)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Text fw={800} style={{ fontSize: '11px', color: '#000' }}>1</Text>
    </Box>
  );
  if (rank === 2) return (
    <Box style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg, #9CA3AF, #6B7280)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Text fw={800} style={{ fontSize: '11px', color: '#fff' }}>2</Text>
    </Box>
  );
  if (rank === 3) return (
    <Box style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg, #D97706, #92400E)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Text fw={800} style={{ fontSize: '11px', color: '#fff' }}>3</Text>
    </Box>
  );
  return (
    <Text
      fw={600}
      style={{
        fontFamily: 'var(--mantine-font-family-monospace)',
        color: 'rgba(255,255,255,0.35)',
        fontSize: '13px',
        width: 26,
        textAlign: 'center',
      }}
    >
      {rank}
    </Text>
  );
}

/* ── Summary stats bar ────────────────────────────────────────────────── */

function SummaryBar({ feds }: { feds: FederationListItem[] }) {
  const tiers = new Set(feds.map((f) => f.tier)).size;
  const confs = new Set(feds.map((f) => f.confederationName).filter(Boolean)).size;
  const teams = feds.reduce((s, f) => s + f.teamCount, 0);

  return (
    <Group gap="xl" px="md" py="sm" mb="md" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
      {[
        { icon: IconBuilding, label: 'Federaciones', value: feds.length, color: '#10B981' },
        { icon: IconWorld, label: 'Confederaciones', value: confs, color: '#3B82F6' },
        { icon: IconShield, label: 'Tiers activos', value: tiers, color: '#F59E0B' },
        { icon: IconUsers, label: 'Equipos totales', value: teams, color: '#8B5CF6' },
      ].map((s) => (
        <Group key={s.label} gap="xs">
          <s.icon size={14} color={s.color} />
          <div>
            <Text size="xs" c="dimmed">{s.label}</Text>
            <Text fw={800} size="sm" style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: s.color, lineHeight: 1.2 }}>
              {s.value}
            </Text>
          </div>
        </Group>
      ))}
    </Group>
  );
}

/* ── Main page ────────────────────────────────────────────────────────── */

export function FederationsPage() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);

  const feds = useQuery({ queryKey: ['federations', id], queryFn: () => api.federations(id) });
  const ranking = useQuery({ queryKey: ['world-ranking', id], queryFn: () => api.worldRanking(id) });

  if (feds.isLoading) {
    return (
      <div className="page-enter">
        <Skeleton height={56} radius="md" mb="md" />
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="xs">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={90} radius="md" />)}
        </SimpleGrid>
      </div>
    );
  }

  const allFeds = feds.data ?? [];
  const playerFeds = allFeds.filter((f) => f.isPlayer);
  const rivalFeds = allFeds.filter((f) => !f.isPlayer);

  // Group rivals by confederation
  const byConf = new Map<string, FederationListItem[]>();
  for (const f of rivalFeds) {
    const conf = f.confederationName ?? 'Sin confederación';
    const arr = byConf.get(conf) ?? [];
    arr.push(f);
    byConf.set(conf, arr);
  }
  const sortedConfs = [...byConf.entries()].sort((a, b) => {
    const aMax = Math.max(...a[1].map((f) => f.prestige));
    const bMax = Math.max(...b[1].map((f) => f.prestige));
    return bMax - aMax;
  });

  const rankRows = ranking.data?.rows ?? [];
  const maxScore = Math.max(...rankRows.map((r) => r.cumulativeScore), 1);

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
          <Tabs.Tab value="federaciones" leftSection={<IconBuilding size={14} />} style={{ fontWeight: 600 }}>
            Federaciones
            {allFeds.length > 0 && (
              <Badge size="xs" ml={6} color="gray" variant="light">{allFeds.length}</Badge>
            )}
          </Tabs.Tab>
          <Tabs.Tab value="ranking" leftSection={<IconChartLine size={14} />} style={{ fontWeight: 600 }}>
            Ranking mundial
          </Tabs.Tab>
        </Tabs.List>

        {/* ── Federaciones panel ── */}
        <Tabs.Panel value="federaciones">
          {allFeds.length > 0 && <SummaryBar feds={allFeds} />}

          {/* Player federation first */}
          {playerFeds.length > 0 && (
            <Box mb="lg">
              <Group gap="xs" mb="sm">
                <Box style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px rgba(16,185,129,0.5)' }} />
                <Text size="xs" fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.07em' }}>
                  Tu federación
                </Text>
                <Box style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)', marginLeft: 4 }} />
              </Group>
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="xs">
                {playerFeds.map((f) => (
                  <FederationCard key={f.id} f={f} gameId={gameId} />
                ))}
              </SimpleGrid>
            </Box>
          )}

          {/* Rivals by confederation */}
          {sortedConfs.map(([confName, confFeds]) => (
            <ConfederationSection
              key={confName}
              name={confName}
              feds={confFeds}
              gameId={gameId}
            />
          ))}
        </Tabs.Panel>

        {/* ── Ranking panel ── */}
        <Tabs.Panel value="ranking">
          {rankRows.length === 0 ? (
            <Paper p="xl" style={{ border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
              <IconChartLine size={40} color="rgba(255,255,255,0.1)" style={{ marginBottom: 12 }} />
              <Text c="dimmed" fw={500}>Aún sin datos de coeficiente.</Text>
              <Text size="sm" c="dimmed" mt={4}>El ranking se actualiza al cerrar cada temporada.</Text>
            </Paper>
          ) : (
            <Stack gap="xs">
              {/* Top 3 podium */}
              {rankRows.length >= 3 && (
                <SimpleGrid cols={3} spacing="xs" mb="xs">
                  {[1, 0, 2].map((idx) => {
                    const row = rankRows[idx];
                    const pos = idx + 1;
                    const podiumPos = idx === 1 ? 1 : idx === 0 ? 2 : 3;
                    const heights = { 1: 80, 2: 64, 3: 52 };
                    const podiumColors = {
                      1: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', accent: '#F59E0B' },
                      2: { bg: 'rgba(156,163,175,0.06)', border: 'rgba(156,163,175,0.15)', accent: '#9CA3AF' },
                      3: { bg: 'rgba(217,119,6,0.06)', border: 'rgba(217,119,6,0.15)', accent: '#D97706' },
                    };
                    const style = podiumColors[podiumPos as 1 | 2 | 3];
                    return (
                      <Paper
                        key={row.federationId}
                        p="sm"
                        style={{
                          background: style.bg,
                          border: `1px solid ${style.border}`,
                          borderBottom: `3px solid ${style.accent}`,
                          textAlign: 'center',
                          height: heights[podiumPos as 1 | 2 | 3] + 80,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'flex-end',
                        }}
                      >
                        <IconMedal size={18} color={style.accent} style={{ margin: '0 auto 4px' }} />
                        <Text
                          fw={700}
                          size="sm"
                          style={{
                            color: row.isPlayer ? '#10B981' : '#F9FAFB',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {row.name}
                        </Text>
                        <Text fw={800} size="lg" style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: style.accent }}>
                          {row.cumulativeScore.toFixed(1)}
                        </Text>
                        <Text size="xs" c="dimmed">#{pos}</Text>
                      </Paper>
                    );
                  })}
                </SimpleGrid>
              )}

              {/* Full ranking table */}
              <Paper p="md" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                <Table highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', width: 40 }}>#</Table.Th>
                      <Table.Th style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Federación</Table.Th>
                      <Table.Th style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Coef. acum.</Table.Th>
                      <Table.Th style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Última temp.</Table.Th>
                      <Table.Th style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Tendencia</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {rankRows.map((row, i) => {
                      const rank = i + 1;
                      // Compare current position vs stored lastRank
                      const delta = row.lastRank > 0 ? row.lastRank - rank : null;

                      return (
                        <Table.Tr
                          key={row.federationId}
                          className="stagger-item"
                          style={{
                            borderLeft: row.isPlayer ? '3px solid #10B981' : '3px solid transparent',
                            background: row.isPlayer ? 'rgba(16,185,129,0.04)' : undefined,
                            animationDelay: `${i * 25}ms`,
                          }}
                        >
                          <Table.Td>
                            <RankBadge rank={rank} />
                          </Table.Td>
                          <Table.Td>
                            <Group gap="xs">
                              {row.isPlayer && (
                                <Box style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 6px rgba(16,185,129,0.5)', flexShrink: 0 }} />
                              )}
                              <Text fw={row.isPlayer ? 700 : 400} style={{ color: row.isPlayer ? '#10B981' : undefined }}>
                                {row.name}
                              </Text>
                              {row.seasonsRanked <= 1 && (
                                <Badge size="xs" color="blue" variant="light">nuevo</Badge>
                              )}
                            </Group>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Group gap={6} justify="flex-end" wrap="nowrap">
                              <Text fw={700} style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: '#F59E0B' }}>
                                {row.cumulativeScore.toFixed(1)}
                              </Text>
                              <Box style={{ width: 48, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', flexShrink: 0 }}>
                                <Box style={{ width: `${(row.cumulativeScore / maxScore) * 100}%`, height: '100%', borderRadius: 2, background: 'linear-gradient(90deg, #D97706, #F59E0B)' }} />
                              </Box>
                            </Group>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: 'rgba(255,255,255,0.5)' }}>
                              {row.lastScore > 0 ? row.lastScore.toFixed(1) : '—'}
                            </Text>
                          </Table.Td>
                          <Table.Td ta="right">
                            {delta !== null && delta !== 0 ? (
                              <Text fw={700} size="sm" style={{ color: delta > 0 ? '#10B981' : '#EF4444' }}>
                                {delta > 0 ? `▲${delta}` : `▼${Math.abs(delta)}`}
                              </Text>
                            ) : (
                              <Text size="xs" c="dimmed">—</Text>
                            )}
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </Paper>
            </Stack>
          )}
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
