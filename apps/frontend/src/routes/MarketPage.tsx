import { useMemo, useState } from 'react';
import { Badge, Box, Button, Collapse, Group, Paper, Select, Skeleton, Stack, Table, Text, Tooltip } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { IconChevronDown, IconChevronRight, IconUserPlus } from '@tabler/icons-react';
import type { MarketTeam } from '@football-gm/contracts';
import { api } from '../api';
import { useMutationWithFeedback } from '../useMutationWithFeedback';
import { QK } from '../query-keys';
import { PageHero } from '../components/PageHero';

const ARRAIGO_BAR_COLOR = (a: number) =>
  a >= 70
    ? 'linear-gradient(90deg, #DC2626, #EF4444)'
    : a >= 40
      ? 'linear-gradient(90deg, #D97706, #F59E0B)'
      : 'linear-gradient(90deg, #059669, #10B981)';

function TeamRow({
  t,
  i,
  isPending,
  currentVar,
  onNegotiate,
}: {
  t: MarketTeam;
  i: number;
  isPending: boolean;
  currentVar: number | undefined;
  onNegotiate: (id: number) => void;
}) {
  return (
    <Table.Tr
      key={t.teamId}
      className="stagger-item"
      style={{
        borderLeft: '3px solid transparent',
        transition: 'border-color 0.15s, background 0.15s',
        background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
        animationDelay: `${i * 40}ms`,
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
      <Table.Td fw={600}>{t.name}</Table.Td>
      <Table.Td ta="right">
        <Text fw={700} style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: t.strength >= 70 ? '#10B981' : t.strength >= 50 ? '#F59E0B' : '#EF4444' }}>
          {t.strength}
        </Text>
      </Table.Td>
      <Table.Td ta="right">
        <Tooltip label="Lealtad (0-100): más alto = más difícil de seducir" fz="xs">
          <Group gap="xs" justify="flex-end" wrap="nowrap" style={{ cursor: 'default' }}>
            <Box style={{ width: 48, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', flexShrink: 0 }}>
              <Box style={{ width: `${t.arraigo}%`, height: '100%', borderRadius: 3, background: ARRAIGO_BAR_COLOR(t.arraigo) }} />
            </Box>
            <Text fw={600} style={{ fontFamily: 'var(--mantine-font-family-monospace)', fontSize: '13px', color: t.arraigo >= 70 ? '#EF4444' : t.arraigo >= 40 ? '#F59E0B' : '#10B981' }}>
              {t.arraigo}
            </Text>
          </Group>
        </Tooltip>
      </Table.Td>
      <Table.Td ta="right">
        <Button
          size="xs"
          variant="gradient"
          gradient={{ from: '#10B981', to: '#059669' }}
          loading={isPending && currentVar === t.teamId}
          leftSection={<IconUserPlus size={13} />}
          onClick={() => onNegotiate(t.teamId)}
        >
          Negociar
        </Button>
      </Table.Td>
    </Table.Tr>
  );
}

function DivisionSection({
  divisionName,
  divisionOrden,
  teams,
  isPending,
  currentVar,
  onNegotiate,
}: {
  divisionName: string;
  divisionOrden: number;
  teams: MarketTeam[];
  isPending: boolean;
  currentVar: number | undefined;
  onNegotiate: (id: number) => void;
}) {
  const [open, setOpen] = useState(divisionOrden === 1);

  return (
    <Box mb="xs">
      <Group
        gap="xs"
        px="xs"
        py={6}
        style={{ cursor: 'pointer', borderRadius: 6, background: 'rgba(255,255,255,0.03)', userSelect: 'none' }}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <IconChevronDown size={14} color="#6B7280" /> : <IconChevronRight size={14} color="#6B7280" />}
        <Text size="xs" fw={700} tt="uppercase" style={{ letterSpacing: '0.06em', color: divisionOrden === 1 ? '#F59E0B' : divisionOrden === 2 ? '#10B981' : '#6B7280' }}>
          {divisionOrden}ª División · {divisionName}
        </Text>
        <Badge size="xs" variant="light" color={divisionOrden === 1 ? 'yellow' : divisionOrden === 2 ? 'teal' : 'gray'}>
          {teams.length} equipo{teams.length !== 1 ? 's' : ''}
        </Badge>
      </Group>
      <Collapse in={open}>
        <Table mt={4}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Equipo</Table.Th>
              <Table.Th style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Fuerza</Table.Th>
              <Table.Th style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Arraigo</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {teams.map((t, i) => (
              <TeamRow
                key={t.teamId}
                t={t}
                i={i}
                isPending={isPending}
                currentVar={currentVar}
                onNegotiate={onNegotiate}
              />
            ))}
          </Table.Tbody>
        </Table>
      </Collapse>
    </Box>
  );
}

function FederationBlock({
  fedName,
  fedId,
  tier,
  teams,
  isPending,
  currentVar,
  onNegotiate,
  divisionFilter,
}: {
  fedName: string;
  fedId: number;
  tier: number;
  teams: MarketTeam[];
  isPending: boolean;
  currentVar: number | undefined;
  onNegotiate: (id: number) => void;
  divisionFilter: number | null;
}) {
  const [open, setOpen] = useState(true);

  const byDivision = useMemo(() => {
    const map = new Map<number, MarketTeam[]>();
    for (const t of teams) {
      const arr = map.get(t.divisionOrden) ?? [];
      arr.push(t);
      map.set(t.divisionOrden, arr);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [teams]);

  const filteredDivisions = divisionFilter != null
    ? byDivision.filter(([orden]) => orden === divisionFilter)
    : byDivision;

  if (filteredDivisions.length === 0) return null;

  const TIER_COLORS: Record<number, string> = { 1: '#F59E0B', 2: '#10B981', 3: '#3B82F6', 4: '#8B5CF6', 5: '#6B7280' };
  const tierColor = TIER_COLORS[tier] ?? '#6B7280';

  return (
    <Paper
      key={fedId}
      p="md"
      mb="md"
      style={{
        border: `1px solid rgba(255,255,255,0.06)`,
        borderTop: `2px solid ${tierColor}44`,
      }}
    >
      <Group
        gap="sm"
        mb="sm"
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <IconChevronDown size={16} color="#6B7280" /> : <IconChevronRight size={16} color="#6B7280" />}
        <Text fw={700} style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>{fedName}</Text>
        <Box
          style={{
            padding: '2px 8px',
            borderRadius: 10,
            background: `${tierColor}22`,
            color: tierColor,
            fontFamily: 'var(--mantine-font-family-monospace)',
            fontWeight: 700,
            fontSize: '12px',
          }}
        >
          Tier {tier}
        </Box>
        <Text size="xs" c="dimmed">{teams.length} disponible{teams.length !== 1 ? 's' : ''}</Text>
      </Group>
      <Collapse in={open}>
        <Stack gap={4}>
          {filteredDivisions.map(([orden, divTeams]) => (
            <DivisionSection
              key={orden}
              divisionName={divTeams[0]?.divisionName ?? `División ${orden}`}
              divisionOrden={orden}
              teams={divTeams}
              isPending={isPending}
              currentVar={currentVar}
              onNegotiate={onNegotiate}
            />
          ))}
        </Stack>
      </Collapse>
    </Paper>
  );
}

export function MarketPage() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);

  const market = useQuery({ queryKey: QK.market(id), queryFn: () => api.market(id) });

  const start = useMutationWithFeedback({
    mutationFn: (teamId: number) => api.startNegotiation(id, teamId),
    queryKeyToInvalidate: ['market', 'negotiations', 'summary'],
    successMessage: 'Negociación iniciada',
  });

  const [divisionFilter, setDivisionFilter] = useState<number | null>(null);

  const byFederation = useMemo(() => {
    if (!market.data) return [];
    const map = new Map<number, { fedName: string; tier: number; teams: MarketTeam[] }>();
    for (const t of market.data.teams) {
      const entry = map.get(t.currentFederationId) ?? { fedName: t.currentFederationName, tier: t.tier, teams: [] };
      entry.teams.push(t);
      map.set(t.currentFederationId, entry);
    }
    return [...map.entries()].sort((a, b) => a[1].tier - b[1].tier || a[1].fedName.localeCompare(b[1].fedName));
  }, [market.data]);

  const maxDivision = useMemo(() => {
    if (!market.data) return 1;
    return Math.max(...market.data.teams.map((t) => t.divisionOrden));
  }, [market.data]);

  const divisionOptions = useMemo(() => {
    const opts = [{ value: '', label: 'Todas las divisiones' }];
    for (let i = 1; i <= maxDivision; i++) {
      opts.push({ value: String(i), label: `${i}ª División` });
    }
    return opts;
  }, [maxDivision]);

  if (market.isLoading) {
    return (
      <div className="page-enter">
        <Skeleton height={120} radius="md" mb="md" />
        <Skeleton height={300} radius="md" />
      </div>
    );
  }

  return (
    <div className="page-enter">
      <PageHero
        icon={IconUserPlus}
        iconColor="#10B981"
        title="Mercado de adhesiones"
        subtitle="Solo puedes negociar equipos de tu tier o inferior. Los equipos de divisiones inferiores tienen menor arraigo — son más fáciles de convencer."
      />

      <Group justify="space-between" mb="md">
        <Group gap="sm">
          {maxDivision > 1 && (
            <Select
              size="xs"
              w={170}
              data={divisionOptions}
              value={divisionFilter != null ? String(divisionFilter) : ''}
              onChange={(v) => setDivisionFilter(v ? Number(v) : null)}
            />
          )}
        </Group>
        <Box
          style={{
            padding: '6px 16px',
            borderRadius: 16,
            background: 'linear-gradient(135deg, #D97706, #F59E0B)',
            color: '#fff',
            fontFamily: 'var(--mantine-font-family-monospace)',
            fontWeight: 700,
            fontSize: '14px',
          }}
        >
          Tier {market.data?.playerTier ?? '—'}
        </Box>
      </Group>

      {market.data && market.data.teams.length === 0 ? (
        <Paper p="md" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          <Text c="dimmed">
            No hay equipos negociables ahora mismo (sube de tier o espera).
          </Text>
        </Paper>
      ) : (
        <div>
          {byFederation.map(([fedId, { fedName, tier, teams }]) => (
            <FederationBlock
              key={fedId}
              fedId={fedId}
              fedName={fedName}
              tier={tier}
              teams={teams}
              isPending={start.isPending}
              currentVar={start.variables}
              onNegotiate={(teamId) => start.mutate(teamId)}
              divisionFilter={divisionFilter}
            />
          ))}
        </div>
      )}
    </div>
  );
}
