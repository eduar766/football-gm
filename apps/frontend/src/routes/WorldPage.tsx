import {
  Badge,
  Box,
  Group,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { IconGlobe, IconStar, IconTrophy, IconUsers } from '@tabler/icons-react';
import type { WorldFederationStanding } from '@football-gm/contracts';
import { useState } from 'react';
import { api } from '../api';
import { QK } from '../query-keys';
import { PageHero } from '../components/PageHero';

const TIER_COLORS: Record<number, string> = {
  1: '#F59E0B',
  2: '#10B981',
  3: '#3B82F6',
  4: '#8B5CF6',
  5: '#6B7280',
};

function TierBadge({ tier }: { tier: number }) {
  return (
    <Badge
      size="xs"
      variant="light"
      style={{ background: `${TIER_COLORS[tier]}22`, color: TIER_COLORS[tier], borderColor: `${TIER_COLORS[tier]}55` }}
    >
      Tier {tier}
    </Badge>
  );
}

function FederationCard({
  fed,
  gameId,
}: {
  fed: WorldFederationStanding;
  gameId: number;
}) {
  const navigate = useNavigate();
  const topDiv = fed.divisions.find((d) => d.orden === 1) ?? fed.divisions[0];
  const rows = topDiv?.standings.slice(0, 5) ?? [];

  return (
    <Paper
      p="md"
      radius="md"
      style={{
        background: 'linear-gradient(160deg, #111820 0%, #1A2332 100%)',
        border: '1px solid rgba(255,255,255,0.07)',
        cursor: 'pointer',
      }}
      onClick={() => navigate({ to: `/games/${gameId}/federations/${fed.federationId}` as never })}
    >
      <Stack gap={6}>
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Box style={{ minWidth: 0, flex: 1 }}>
            <Text fw={700} truncate style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
              {fed.federationName}
            </Text>
            {fed.confederationName && (
              <Text size="xs" c="dimmed" truncate>{fed.confederationName}</Text>
            )}
          </Box>
          <TierBadge tier={fed.tier} />
        </Group>

        <Group gap="md">
          <Box>
            <Text size="xs" c="dimmed">Prestigio</Text>
            <Text fw={700} size="sm" style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>
              {fed.prestige}
            </Text>
          </Box>
          <Box>
            <Text size="xs" c="dimmed">Jornada rival</Text>
            <Text fw={700} size="sm" style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>
              {fed.matchdayProgress}
            </Text>
          </Box>
        </Group>

        {topDiv && rows.length > 0 && (
          <>
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
              {topDiv?.name ?? 'Liga'}
            </Text>
            <Table
              fz="xs"
              verticalSpacing={2}
              style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 20 }}>#</Table.Th>
                  <Table.Th>Equipo</Table.Th>
                  <Table.Th style={{ width: 28, textAlign: 'right' }}>PJ</Table.Th>
                  <Table.Th style={{ width: 28, textAlign: 'right' }}>Pts</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((row, i) => (
                  <Table.Tr key={row.teamId}>
                    <Table.Td>
                      {i === 0 ? (
                        <IconTrophy size={12} color="#F59E0B" />
                      ) : (
                        <Text size="xs" c="dimmed">
                          {i + 1}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" truncate style={{ maxWidth: 120 }}>
                        {row.name}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text size="xs" c="dimmed">
                        {row.played}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text size="xs" fw={700} c={i === 0 ? '#F59E0B' : undefined}>
                        {row.points}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            {topDiv && topDiv.standings.length > 5 && (
              <Text size="xs" c="dimmed" ta="center">
                +{topDiv.standings.length - 5} equipos más
              </Text>
            )}
          </>
        )}
      </Stack>
    </Paper>
  );
}

/* ── Commissioner Reports tab ─────────────────────────────────────────── */

function CommissionerReports({ gameId }: { gameId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: QK.commissionerReports(gameId),
    queryFn: () => api.commissionerReports(gameId),
    staleTime: 30_000,
  });

  if (isLoading || !data) {
    return <Text c="dimmed" size="sm">Cargando informes...</Text>;
  }

  const noData = data.federations.every(f => !f.lastChampion && !f.topScorer);
  if (noData) {
    return (
      <Box ta="center" py="xl">
        <Text c="dimmed">Los informes estarán disponibles tras cerrar la primera temporada.</Text>
      </Box>
    );
  }

  return (
    <Stack gap="md">
      <Table highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Federación</Table.Th>
            <Table.Th style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Prestige</Table.Th>
            <Table.Th style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Último campeón</Table.Th>
            <Table.Th style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Top goleador</Table.Th>
            <Table.Th style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Coef.</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {data.federations.map((fed) => (
            <Table.Tr
              key={fed.federationId}
              style={fed.isPlayer ? { background: 'rgba(16,185,129,0.05)', borderLeft: '2px solid rgba(16,185,129,0.3)' } : undefined}
            >
              <Table.Td>
                <Group gap="xs" wrap="nowrap">
                  {fed.isPlayer && <Box style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', flexShrink: 0 }} />}
                  <Text size="sm" fw={fed.isPlayer ? 700 : 400}>{fed.federationName}</Text>
                </Group>
              </Table.Td>
              <Table.Td ta="right">
                <Text size="sm" fw={600} style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>{fed.prestige}</Text>
              </Table.Td>
              <Table.Td>
                {fed.lastChampion ? (
                  <Box>
                    <Group gap={4} wrap="nowrap">
                      <IconTrophy size={10} color="#F59E0B" />
                      <Text size="xs" fw={600}>{fed.lastChampion.name}</Text>
                    </Group>
                    <Text size="xs" c="dimmed">T.{fed.lastChampion.year}</Text>
                  </Box>
                ) : <Text size="xs" c="dimmed">—</Text>}
              </Table.Td>
              <Table.Td>
                {fed.topScorer ? (
                  <Box>
                    <Group gap={4} wrap="nowrap">
                      <IconUsers size={10} color="#8B5CF6" />
                      <Text size="xs" fw={600}>{fed.topScorer.name}</Text>
                      <Badge size="xs" color="violet" variant="light">{fed.topScorer.goals} goles</Badge>
                    </Group>
                    <Text size="xs" c="dimmed">{fed.topScorer.teamName}</Text>
                  </Box>
                ) : <Text size="xs" c="dimmed">—</Text>}
              </Table.Td>
              <Table.Td ta="right">
                <Text size="sm" fw={600} style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: fed.powerScore > 0 ? '#F59E0B' : 'rgba(255,255,255,0.3)' }}>
                  {fed.powerScore.toFixed(1)}
                </Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}

export function WorldPage() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);
  const [confFilter, setConfFilter] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['world-standings', id],
    queryFn: () => api.worldStandings(id),
    staleTime: 15_000,
  });

  const confOptions = data
    ? [
        { value: '', label: 'Todas las confederaciones' },
        ...[...new Set(data.federations.map((f) => f.confederationName).filter(Boolean))].map(
          (name) => ({ value: name!, label: name! }),
        ),
      ]
    : [];

  const filtered = data
    ? confFilter
      ? data.federations.filter((f) => f.confederationName === confFilter)
      : data.federations
    : [];

  const matchdayProgress = data?.federations[0]?.matchdayProgress ?? 0;

  return (
    <Stack gap="lg">
      <PageHero
        icon={IconGlobe}
        eyebrow="Panorama global"
        title="Ligas del Mundo"
        subtitle="Sigue el pulso de las federaciones rivales y sus competiciones."
        actions={
          matchdayProgress > 0 ? (
            <Badge variant="light" color="teal" size="lg">
              Jornada rival {matchdayProgress}
            </Badge>
          ) : undefined
        }
      />

      <Tabs defaultValue="ligas" variant="pills" radius="md">
        <Tabs.List
          mb="md"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10,
            padding: 4,
          }}
        >
          <Tabs.Tab value="ligas" leftSection={<IconGlobe size={14} />} style={{ fontWeight: 600 }}>
            Ligas
          </Tabs.Tab>
          <Tabs.Tab value="informes" leftSection={<IconStar size={14} />} style={{ fontWeight: 600 }}>
            Informes del Comisionado
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="ligas">
          {confOptions.length > 1 && (
            <Select
              placeholder="Todas las confederaciones"
              data={confOptions}
              value={confFilter ?? ''}
              onChange={(v) => setConfFilter(v || null)}
              clearable
              style={{ maxWidth: 280, marginBottom: 16 }}
            />
          )}

          {isLoading && (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              {Array.from({ length: 6 }).map((_, i) => (
                <Paper key={i} p="md" withBorder style={{ height: 220 }} />
              ))}
            </SimpleGrid>
          )}

          {!isLoading && filtered.length === 0 && (
            <Box ta="center" py="xl">
              <IconGlobe size={40} color="var(--mantine-color-dimmed)" />
              <Text c="dimmed" mt="sm">
                {matchdayProgress === 0
                  ? 'La temporada rival aún no ha comenzado'
                  : 'No hay federaciones en esta confederación'}
              </Text>
            </Box>
          )}

          {!isLoading && filtered.length > 0 && (
            <ScrollArea>
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                {filtered.map((fed) => (
                  <FederationCard key={fed.federationId} fed={fed} gameId={id} />
                ))}
              </SimpleGrid>
            </ScrollArea>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="informes">
          <Paper p="md" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <CommissionerReports gameId={id} />
          </Paper>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
