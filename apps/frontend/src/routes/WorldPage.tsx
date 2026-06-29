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
  Text,
  Title,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { IconGlobe, IconTrophy } from '@tabler/icons-react';
import type { WorldFederationStanding } from '@football-gm/contracts';
import { useState } from 'react';
import { api } from '../api';

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
      withBorder
      style={{
        borderColor: 'var(--mantine-color-default-border)',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = TIER_COLORS[fed.tier] ?? '#333';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--mantine-color-default-border)';
      }}
      onClick={() =>
        navigate({
          to: '/games/$gameId/federations/$fedId',
          params: { gameId: String(gameId), fedId: String(fed.federationId) },
        })
      }
    >
      <Stack gap="xs">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Box style={{ minWidth: 0 }}>
            <Text fw={700} size="sm" truncate>
              {fed.federationName}
            </Text>
            {fed.confederationName && (
              <Text size="xs" c="dimmed" truncate>
                {fed.confederationName}
              </Text>
            )}
          </Box>
          <Group gap={4} wrap="nowrap">
            <TierBadge tier={fed.tier} />
            <Badge size="xs" variant="outline" color="yellow">
              {fed.prestige} pres.
            </Badge>
          </Group>
        </Group>

        {rows.length === 0 ? (
          <Text size="xs" c="dimmed" ta="center" py="sm">
            Sin datos de clasificación
          </Text>
        ) : (
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
      <Group justify="space-between" align="center">
        <Group gap="sm">
          <IconGlobe size={24} color="#10B981" />
          <Title order={2} style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
            Ligas del Mundo
          </Title>
        </Group>
        {matchdayProgress > 0 && (
          <Badge variant="light" color="teal" size="lg">
            Jornada rival {matchdayProgress}
          </Badge>
        )}
      </Group>

      {confOptions.length > 1 && (
        <Select
          placeholder="Todas las confederaciones"
          data={confOptions}
          value={confFilter ?? ''}
          onChange={(v) => setConfFilter(v || null)}
          clearable
          style={{ maxWidth: 280 }}
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
    </Stack>
  );
}
