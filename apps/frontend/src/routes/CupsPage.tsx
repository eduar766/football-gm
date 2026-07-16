import { useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Collapse,
  Group,
  Modal,
  MultiSelect,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Timeline,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import {
  IconCalendar,
  IconChevronDown,
  IconChevronRight,
  IconEdit,
  IconLayoutGrid,
  IconPlus,
  IconTrash,
  IconTrophy,
  IconUsers,
} from '@tabler/icons-react';
import type {
  CupCategory,
  CupFormat,
  CupDto,
  CupMatchDto,
  CupScheduleEntryDto,
  CupStatus,
  CupType,
} from '@football-gm/contracts';
import { api } from '../api';
import { useMutationWithFeedback } from '../useMutationWithFeedback';
import { QK } from '../query-keys';
import { BracketView } from '../components/BracketView';
import { EmptyState } from '../components/EmptyState';
import { AssemblyRedirectBanner } from '../components/AssemblyRedirectBanner';
import { PageHero } from '../components/PageHero';
import { CUP_TIPO_LABEL as TIPO_LABEL } from '../domain-labels';

const STATUS_CONFIG: Record<CupStatus, { label: string; color: string; gradient: string }> = {
  en_curso: { label: 'En curso', color: '#3B82F6', gradient: 'linear-gradient(135deg, #2563EB, #3B82F6)' },
  finalizada: { label: 'Finalizada', color: '#10B981', gradient: 'linear-gradient(135deg, #059669, #10B981)' },
};

type RoundGroup = {
  logicalNumero: number;
  legs: { numero: number; label: string; matches: CupMatchDto[] }[];
};

// Liga-format cups store every round-robin fixture in a single CupRound (they
// all resolve at once — see playCupRound). `matchday` splits that flat list
// back into real jornadas. Older saves created before that field existed
// don't have it; the array is still stored in generation order, so chunking
// it positionally by matches-per-round recovers the same grouping.
function chunkLigaMatches(matches: CupMatchDto[], participantCount: number): CupMatchDto[][] {
  if (matches.length === 0) return [];
  if (matches.every((m) => m.matchday != null)) {
    const byMatchday = new Map<number, CupMatchDto[]>();
    for (const m of matches) {
      const arr = byMatchday.get(m.matchday!) ?? [];
      arr.push(m);
      byMatchday.set(m.matchday!, arr);
    }
    return [...byMatchday.entries()].sort((a, b) => a[0] - b[0]).map(([, ms]) => ms);
  }
  const chunkSize = Math.max(1, Math.floor(participantCount / 2));
  const chunks: CupMatchDto[][] = [];
  for (let i = 0; i < matches.length; i += chunkSize) chunks.push(matches.slice(i, i + chunkSize));
  return chunks;
}

function groupRounds(cup: CupDto): RoundGroup[] {
  const isIdaVuelta = cup.formato === 'eliminatoria_ida_vuelta';
  const groups: RoundGroup[] = [];
  if (cup.formato === 'liga') {
    const round = cup.rounds[0];
    if (!round) return groups;
    const chunks = chunkLigaMatches(round.matches, cup.participantTeamIds.length);
    chunks.forEach((matches, i) => {
      groups.push({ logicalNumero: i + 1, legs: [{ numero: i + 1, label: '', matches }] });
    });
  } else if (isIdaVuelta) {
    const processed = new Set<number>();
    for (const r of cup.rounds) {
      if (processed.has(r.numero)) continue;
      if (r.leg !== 'ida') { processed.add(r.numero); continue; }
      const vuelta = cup.rounds.find((x) => x.numero === r.numero + 1 && x.leg === 'vuelta');
      const legs: RoundGroup['legs'] = [{ numero: r.numero, label: 'Ida', matches: r.matches }];
      if (vuelta) legs.push({ numero: vuelta.numero, label: 'Vuelta', matches: vuelta.matches });
      groups.push({ logicalNumero: groups.length + 1, legs });
      processed.add(r.numero);
      if (vuelta) processed.add(vuelta.numero);
    }
  } else {
    for (const r of cup.rounds) {
      groups.push({ logicalNumero: r.numero, legs: [{ numero: r.numero, label: '', matches: r.matches }] });
    }
  }
  return groups;
}

function CupStatusBadge({ status }: { status: CupStatus }) {
  const sc = STATUS_CONFIG[status];
  return (
    <Box
      style={{
        padding: '3px 10px',
        borderRadius: 14,
        background: sc.gradient,
        color: '#fff',
        fontWeight: 600,
        fontSize: '11px',
        flexShrink: 0,
      }}
    >
      {sc.label}
    </Box>
  );
}

function RecurringBadge() {
  return (
    <Box
      style={{
        padding: '3px 10px',
        borderRadius: 14,
        background: 'rgba(139,92,246,0.15)',
        color: '#8B5CF6',
        fontWeight: 600,
        fontSize: '11px',
        flexShrink: 0,
      }}
    >
      Recurrente
    </Box>
  );
}

function CupHeader({ cup }: { cup: CupDto }) {
  return (
    <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
      <IconTrophy size={16} color="#F59E0B" style={{ flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}>
        <Text fw={700} size="md" style={{ lineHeight: 1.3 }}>{cup.name}</Text>
        <Text size="xs" c="dimmed">
          {TIPO_LABEL[cup.tipo]} ·{' '}
          {cup.formato === 'liga'
            ? 'liga'
            : cup.formato === 'eliminatoria_ida_vuelta'
            ? 'ida y vuelta'
            : 'partido único'}
          {cup.categoria === 'juvenil' ? ' · juvenil' : ''}
        </Text>
      </div>
    </Group>
  );
}

function ChampionBanner({ cup }: { cup: CupDto }) {
  if (cup.status !== 'finalizada' || !cup.championTeamName) return null;
  return (
    <Box
      p="sm"
      mb="sm"
      style={{
        borderRadius: 8,
        background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(217,119,6,0.06) 100%)',
        border: '1px solid rgba(245,158,11,0.25)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <Box
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #F59E0B, #D97706)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
          flexShrink: 0,
        }}
      >
        🏆
      </Box>
      <div>
        <Text size="xs" c="dimmed">Campeón</Text>
        <Text fw={800} size="sm" style={{ color: '#F59E0B', lineHeight: 1.2 }}>
          {cup.championTeamName}
        </Text>
      </div>
    </Box>
  );
}

/* ── Liga format ──────────────────────────────────────────────────────── */

function CupActions({ cup, isPreseason, onEdit, onDelete }: { cup: CupDto; isPreseason: boolean; onEdit: (c: CupDto) => void; onDelete: (c: CupDto) => void }) {
  if (!isPreseason) return null;
  return (
    <Group gap={4} wrap="nowrap" onClick={(e) => e.stopPropagation()}>
      <Button size="compact-xs" variant="subtle" color="gray" leftSection={<IconEdit size={11} />} onClick={() => onEdit(cup)}>
        Editar
      </Button>
      <Button size="compact-xs" variant="subtle" color="red" leftSection={<IconTrash size={11} />} onClick={() => onDelete(cup)} />
    </Group>
  );
}

type LigaRow = { teamId: number; name: string; pj: number; g: number; e: number; p: number; gf: number; gc: number; pts: number };

// Classification for a league-format cup, aggregated from its played matches.
function computeCupStandings(cup: CupDto): LigaRow[] {
  const table = new Map<number, LigaRow>();
  const ensure = (id: number, name: string) => {
    let r = table.get(id);
    if (!r) { r = { teamId: id, name, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 }; table.set(id, r); }
    return r;
  };
  for (const round of cup.rounds) {
    for (const m of round.matches) {
      if (m.homeTeamName === 'BYE' || m.awayTeamName === 'BYE') continue;
      const home = ensure(m.homeTeamId, m.homeTeamName);
      const away = ensure(m.awayTeamId, m.awayTeamName);
      if (!m.played || m.homeGoals == null || m.awayGoals == null) continue;
      home.pj++; away.pj++;
      home.gf += m.homeGoals; home.gc += m.awayGoals;
      away.gf += m.awayGoals; away.gc += m.homeGoals;
      if (m.homeGoals > m.awayGoals) { home.g++; home.pts += 3; away.p++; }
      else if (m.homeGoals < m.awayGoals) { away.g++; away.pts += 3; home.p++; }
      else { home.e++; away.e++; home.pts++; away.pts++; }
    }
  }
  return [...table.values()].sort(
    (a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc) || b.gf - a.gf || a.name.localeCompare(b.name),
  );
}

function LigaCupCard({ cup, defaultExpanded = true, isPreseason = false, onEdit, onDelete }: { cup: CupDto; defaultExpanded?: boolean; isPreseason?: boolean; onEdit: (c: CupDto) => void; onDelete: (c: CupDto) => void }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const groups = groupRounds(cup);
  const standings = useMemo(() => computeCupStandings(cup), [cup]);
  // Jornadas that actually have real (non-BYE) matches.
  const jornadas = useMemo(
    () => groups
      .map((g) => ({ numero: g.logicalNumero, matches: g.legs.flatMap((l) => l.matches).filter((m) => m.homeTeamName !== 'BYE' && m.awayTeamName !== 'BYE') }))
      .filter((j) => j.matches.length > 0),
    [groups],
  );
  // Default to the latest jornada with a played match (so results feel "live").
  const lastPlayed = useMemo(() => {
    for (let i = jornadas.length - 1; i >= 0; i--) if (jornadas[i].matches.some((m) => m.played)) return jornadas[i].numero;
    return jornadas[0]?.numero ?? 1;
  }, [jornadas]);
  const [jornada, setJornada] = useState<number | null>(null);
  const selectedJornada = jornada ?? lastPlayed;
  const selectedMatches = jornadas.find((j) => j.numero === selectedJornada)?.matches ?? [];
  // Standings answer "who's winning" at a glance; results are a drill-down —
  // keep them collapsed so a 20-team liga cup doesn't dominate the card.
  const [resultsOpen, setResultsOpen] = useState(false);

  return (
    <Paper
      mb="sm"
      className="stagger-item"
      style={{
        border: '1px solid rgba(255,255,255,0.06)',
        borderLeft: '3px solid #10B981',
        overflow: 'hidden',
      }}
    >
      <Group
        justify="space-between"
        p="sm"
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setExpanded(!expanded)}
        wrap="nowrap"
      >
        <CupHeader cup={cup} />
        <Group gap="xs" wrap="nowrap">
          <CupActions cup={cup} isPreseason={isPreseason} onEdit={onEdit} onDelete={onDelete} />
          {cup.recurring && <RecurringBadge />}
          <CupStatusBadge status={cup.status} />
          <Box style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>
            {expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
          </Box>
        </Group>
      </Group>

      <Collapse in={expanded}>
        <Box px="sm" pb="sm">
          <ChampionBanner cup={cup} />

          {standings.length === 0 ? (
            <Text size="sm" c="dimmed" py="xs">
              El calendario se genera al comenzar la temporada.
            </Text>
          ) : (
            <>
              {/* Classification */}
              <Table verticalSpacing={4} highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ width: 28 }}>#</Table.Th>
                    <Table.Th>Equipo</Table.Th>
                    <Table.Th ta="center" style={{ width: 34 }}>PJ</Table.Th>
                    <Table.Th ta="center" style={{ width: 34 }} visibleFrom="xs">G</Table.Th>
                    <Table.Th ta="center" style={{ width: 34 }} visibleFrom="xs">E</Table.Th>
                    <Table.Th ta="center" style={{ width: 34 }} visibleFrom="xs">P</Table.Th>
                    <Table.Th ta="center" style={{ width: 48 }} visibleFrom="sm">DG</Table.Th>
                    <Table.Th ta="center" style={{ width: 40 }}>Pts</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {standings.map((r, i) => (
                    <Table.Tr key={r.teamId} style={{ background: i === 0 ? 'rgba(16,185,129,0.08)' : undefined }}>
                      <Table.Td c="dimmed" style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>{i + 1}</Table.Td>
                      <Table.Td fw={i === 0 ? 700 : 500}>{r.name}</Table.Td>
                      <Table.Td ta="center">{r.pj}</Table.Td>
                      <Table.Td ta="center" visibleFrom="xs">{r.g}</Table.Td>
                      <Table.Td ta="center" visibleFrom="xs">{r.e}</Table.Td>
                      <Table.Td ta="center" visibleFrom="xs">{r.p}</Table.Td>
                      <Table.Td ta="center" visibleFrom="sm" c={r.gf - r.gc > 0 ? 'teal' : r.gf - r.gc < 0 ? 'red' : 'dimmed'}>
                        {r.gf - r.gc > 0 ? '+' : ''}{r.gf - r.gc}
                      </Table.Td>
                      <Table.Td ta="center" fw={800} style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>{r.pts}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>

              {/* Results drill-down: collapsed by default, one jornada at a time */}
              {jornadas.length > 0 && (
                <Box mt="sm">
                  <Group
                    justify="space-between"
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => setResultsOpen((o) => !o)}
                  >
                    <Group gap={6}>
                      {resultsOpen ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
                      <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
                        Resultados
                      </Text>
                      <Badge size="xs" color="gray" variant="light">{jornadas.length} jornada{jornadas.length !== 1 ? 's' : ''}</Badge>
                    </Group>
                    {resultsOpen && (
                      <Select
                        size="xs"
                        w={130}
                        value={String(selectedJornada)}
                        onChange={(v) => setJornada(v ? Number(v) : null)}
                        data={jornadas.map((j) => ({ value: String(j.numero), label: `Jornada ${j.numero}` }))}
                        comboboxProps={{ withinPortal: true }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </Group>
                  <Collapse in={resultsOpen}>
                    <Table verticalSpacing={4} mt={6}>
                      <Table.Tbody>
                        {selectedMatches.map((m, i) => (
                          <Table.Tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                            <Table.Td fw={m.winnerTeamId === m.homeTeamId ? 700 : 400} ta="right">{m.homeTeamName}</Table.Td>
                            <Table.Td ta="center" style={{ minWidth: 56 }}>
                              {m.played ? (
                                <Text fw={800} style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>{m.homeGoals} – {m.awayGoals}</Text>
                              ) : (
                                <Text c="dimmed" size="sm">vs</Text>
                              )}
                            </Table.Td>
                            <Table.Td fw={m.winnerTeamId === m.awayTeamId ? 700 : 400}>{m.awayTeamName}</Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Collapse>
                </Box>
              )}
            </>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}

/* ── Elimination bracket ──────────────────────────────────────────────── */

function EliminationCupCard({ cup, defaultExpanded = true, isPreseason = false, onEdit, onDelete }: { cup: CupDto; defaultExpanded?: boolean; isPreseason?: boolean; onEdit: (c: CupDto) => void; onDelete: (c: CupDto) => void }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const groups = groupRounds(cup);

  const bracketRounds = groups.map((g) => ({
    label: g.legs.length > 1
      ? `Ronda ${g.logicalNumero}`
      : `Ronda ${g.logicalNumero}${g.legs[0]?.label ? ` · ${g.legs[0].label}` : ''}`,
    matches: g.legs.flatMap((l) => l.matches),
  }));

  return (
    <Paper
      mb="sm"
      className="stagger-item"
      style={{
        border: '1px solid rgba(255,255,255,0.06)',
        borderLeft: '3px solid #F59E0B',
        overflow: 'hidden',
      }}
    >
      <Group
        justify="space-between"
        p="sm"
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setExpanded(!expanded)}
        wrap="nowrap"
      >
        <CupHeader cup={cup} />
        <Group gap="xs" wrap="nowrap">
          <CupActions cup={cup} isPreseason={isPreseason} onEdit={onEdit} onDelete={onDelete} />
          {cup.recurring && <RecurringBadge />}
          <CupStatusBadge status={cup.status} />
          <Box style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>
            {expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
          </Box>
        </Group>
      </Group>

      <Collapse in={expanded}>
        <Box px="sm" pb="sm">
          <ChampionBanner cup={cup} />
          <BracketView rounds={bracketRounds} championTeamName={cup.championTeamName} />
        </Box>
      </Collapse>
    </Paper>
  );
}

/* ── Cup group (by year) ──────────────────────────────────────────────── */

function CupGroup({
  year, cups, isCurrentSeason, isPreseason, onEdit, onDelete,
}: {
  year: number;
  cups: CupDto[];
  isCurrentSeason: boolean;
  isPreseason: boolean;
  onEdit: (c: CupDto) => void;
  onDelete: (c: CupDto) => void;
}) {
  const [open, setOpen] = useState(isCurrentSeason);
  const ligaCups = cups.filter((c) => c.formato === 'liga');
  const elimCups = cups.filter((c) => c.formato !== 'liga');
  const finishedCount = cups.filter((c) => c.status === 'finalizada').length;

  return (
    <Box mb="md">
      {!isCurrentSeason && (
        <Group
          gap="sm"
          mb="xs"
          style={{ cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setOpen(!open)}
        >
          <Box style={{ color: 'rgba(255,255,255,0.4)' }}>
            {open ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
          </Box>
          <Text fw={700} size="sm">Temporada {year}</Text>
          <Badge size="xs" color="gray" variant="light">{finishedCount} copa{finishedCount !== 1 ? 's' : ''}</Badge>
        </Group>
      )}

      <Collapse in={open}>
        {elimCups.length > 0 && (
          <Box mb="xs">
            {isCurrentSeason && (
              <Group gap="xs" mb="xs">
                <IconTrophy size={14} color="#F59E0B" />
                <Text fw={600} size="sm" c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
                  Eliminatorias
                </Text>
              </Group>
            )}
            {elimCups.map((cup) => (
              <EliminationCupCard
                key={cup.id}
                cup={cup}
                defaultExpanded={isCurrentSeason}
                isPreseason={isPreseason}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </Box>
        )}
        {ligaCups.length > 0 && (
          <Box>
            {isCurrentSeason && (
              <Group gap="xs" mb="xs">
                <IconLayoutGrid size={14} color="#10B981" />
                <Text fw={600} size="sm" c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
                  Fase de grupos
                </Text>
              </Group>
            )}
            {ligaCups.map((cup) => (
              <LigaCupCard
                key={cup.id}
                cup={cup}
                defaultExpanded={isCurrentSeason}
                isPreseason={isPreseason}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </Box>
        )}
      </Collapse>
    </Box>
  );
}

/* ── Season Calendar ──────────────────────────────────────────────────── */

function SeasonCalendar({
  schedule,
  currentMatchday,
  totalMatchdays,
}: {
  schedule: CupScheduleEntryDto[];
  currentMatchday: number;
  totalMatchdays: number;
}) {
  if (totalMatchdays === 0) {
    return (
      <Text c="dimmed" size="sm" ta="center" py="xl">
        El calendario se genera al iniciar la temporada.
      </Text>
    );
  }

  const byMatchday = new Map<number, CupScheduleEntryDto[]>();
  for (const entry of schedule) {
    const existing = byMatchday.get(entry.matchday) ?? [];
    existing.push(entry);
    byMatchday.set(entry.matchday, existing);
  }

  const cupMatchdays = [...byMatchday.keys()].sort((a, b) => a - b);

  if (cupMatchdays.length === 0) {
    return (
      <Text c="dimmed" size="sm" ta="center" py="xl">
        No hay copas programadas esta temporada.
      </Text>
    );
  }

  const activeIndex = cupMatchdays.filter((md) => md < currentMatchday).length;

  return (
    <Timeline active={activeIndex} bulletSize={28} lineWidth={2}>
      {cupMatchdays.map((md) => {
        const entries = byMatchday.get(md) ?? [];
        const isPast = md < currentMatchday;
        const isCurrent = md === currentMatchday;
        return (
          <Timeline.Item
            key={md}
            bullet={
              <Text
                fw={700}
                size="xs"
                style={{
                  fontFamily: 'var(--mantine-font-family-monospace)',
                  color: isCurrent ? '#10B981' : isPast ? '#6B7280' : '#F9FAFB',
                }}
              >
                J{md}
              </Text>
            }
            title={
              <Group gap="xs" align="center">
                <Text fw={isCurrent ? 700 : 500} size="sm" c={isPast ? 'dimmed' : isCurrent ? 'green' : undefined}>
                  Jornada {md}
                </Text>
                {isCurrent && <Badge size="xs" color="green" variant="light">Actual</Badge>}
                {isPast && <Badge size="xs" color="gray" variant="light">Jugada</Badge>}
              </Group>
            }
          >
            <Stack gap={4} mt={4}>
              {entries.map((entry, i) => (
                <Group key={i} gap="xs" align="center">
                  <IconTrophy size={12} color="#F59E0B" />
                  <Text size="xs" c={isPast ? 'dimmed' : undefined}>
                    <Text span fw={600}>{entry.cupName}</Text>
                    {' · '}Ronda {entry.roundNumero}
                    {entry.leg ? ` (${entry.leg})` : ''}
                  </Text>
                </Group>
              ))}
            </Stack>
          </Timeline.Item>
        );
      })}
    </Timeline>
  );
}

/* ── Create form ──────────────────────────────────────────────────────── */

function CreateCupForm({
  isPreseason,
  teamOptions,
}: {
  isPreseason: boolean;
  teamOptions: { value: string; label: string }[];
}) {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);
  const [open, setOpen] = useState(isPreseason);

  const [name, setName] = useState('Copa de la Federación');
  const [tipo, setTipo] = useState<CupType>('copa');
  const [formato, setFormato] = useState<CupFormat>('eliminatoria');
  const [categoria, setCategoria] = useState<CupCategory>('primer_equipo');
  const [participants, setParticipants] = useState<string[]>([]);
  const [recurring, setRecurring] = useState(false);

  const create = useMutationWithFeedback({
    mutationFn: () =>
      api.createCup(id, {
        name, tipo, formato, categoria,
        participantTeamIds: participants.map(Number),
        recurring,
      }),
    queryKeyToInvalidate: ['cups', 'summary', 'history'],
    successMessage: 'Copa creada correctamente',
    onSuccess: () => setParticipants([]),
  });

  return (
    <Card
      mb="md"
      style={{
        border: '1px solid rgba(255,255,255,0.06)',
        borderLeft: `3px solid ${isPreseason ? '#F59E0B' : 'rgba(255,255,255,0.1)'}`,
      }}
      p={0}
    >
      <Group
        justify="space-between"
        px="md"
        py="sm"
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setOpen(!open)}
      >
        <Group gap="sm">
          <IconPlus size={16} color={isPreseason ? '#F59E0B' : 'rgba(255,255,255,0.3)'} />
          <Text fw={700} size="sm" c={isPreseason ? undefined : 'dimmed'}>
            Crear copa
          </Text>
          {!isPreseason && (
            <Badge size="xs" color="gray" variant="light">Solo en pretemporada</Badge>
          )}
        </Group>
        <Box style={{ color: 'rgba(255,255,255,0.4)' }}>
          {open ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
        </Box>
      </Group>

      <Collapse in={open}>
        <Box px="md" pb="md">
          <Text size="xs" c="dimmed" mb="sm">
            La categoría juvenil la disputan las canteras de los clubes.
          </Text>
          <Stack>
            <Group grow>
              <TextInput
                label="Nombre"
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                disabled={!isPreseason}
              />
              <Select
                label="Tipo"
                data={(Object.keys(TIPO_LABEL) as CupType[]).map((t) => ({ value: t, label: TIPO_LABEL[t] }))}
                value={tipo}
                onChange={(v) => v && setTipo(v as CupType)}
                disabled={!isPreseason}
              />
            </Group>
            <Group grow>
              <Select
                label="Formato"
                data={[
                  { value: 'eliminatoria', label: 'Eliminatoria (a partido único)' },
                  { value: 'eliminatoria_ida_vuelta', label: 'Eliminatoria (ida y vuelta)' },
                  { value: 'liga', label: 'Liga (todos contra todos)' },
                ]}
                value={formato}
                onChange={(v) => v && setFormato(v as CupFormat)}
                disabled={!isPreseason}
              />
              <Select
                label="Categoría"
                data={[
                  { value: 'primer_equipo', label: 'Primer equipo' },
                  { value: 'juvenil', label: 'Juvenil (cantera)' },
                ]}
                value={categoria}
                onChange={(v) => v && setCategoria(v as CupCategory)}
                disabled={!isPreseason}
              />
            </Group>
            <MultiSelect
              label="Participantes"
              placeholder="Elige al menos 2 equipos (máx. 32)"
              data={teamOptions}
              value={participants}
              onChange={setParticipants}
              searchable
              clearable
              disabled={!isPreseason}
            />
            <Group gap="xs">
              <Button
                size="compact-xs"
                variant="subtle"
                color="gray"
                onClick={() => setParticipants(teamOptions.map((t) => t.value))}
                disabled={!isPreseason}
              >
                Seleccionar todos
              </Button>
              <Button
                size="compact-xs"
                variant="subtle"
                color="gray"
                onClick={() => setParticipants([])}
                disabled={!isPreseason}
              >
                Limpiar
              </Button>
              <Text size="xs" c="dimmed" ml="xs">
                {participants.length} seleccionado(s)
              </Text>
            </Group>
            <Checkbox
              label="Recurrente (se recrea cada temporada automáticamente)"
              checked={recurring}
              onChange={(e) => setRecurring(e.currentTarget.checked)}
              disabled={!isPreseason}
            />
            {recurring ? (
              // Fase 17C: a recurring cup is a standing commitment, so it now
              // goes through the assembly. A one-off cup stays unilateral.
              <AssemblyRedirectBanner
                gameId={gameId}
                message="Una copa recurrente ahora se propone y vota en la asamblea de clubes."
              />
            ) : (
              <Group>
                <Button
                  onClick={() => create.mutate(undefined as void)}
                  disabled={participants.length < 2 || name.trim().length === 0 || !isPreseason}
                  loading={create.isPending}
                  leftSection={<IconTrophy size={16} />}
                  variant="gradient"
                  gradient={{ from: '#F59E0B', to: '#D97706' }}
                >
                  Crear copa
                </Button>
              </Group>
            )}
          </Stack>
        </Box>
      </Collapse>
    </Card>
  );
}

/* ── Inter-League Cup form ────────────────────────────────────────────── */

function CreateInterLeagueCupForm({
  isPreseason,
  prestige,
  playerTeamOptions,
  rivalFederationOptions,
}: {
  isPreseason: boolean;
  prestige: number;
  playerTeamOptions: { value: string; label: string }[];
  rivalFederationOptions: { value: string; label: string }[];
}) {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('Copa Inter-Ligas');
  const [formato, setFormato] = useState<CupFormat>('eliminatoria');
  const [playerTeams, setPlayerTeams] = useState<string[]>([]);
  const [rivalFeds, setRivalFeds] = useState<string[]>([]);

  const unlocked = prestige >= 50;

  const create = useMutationWithFeedback({
    mutationFn: () =>
      api.createInterLeagueCup(
        id,
        name,
        formato,
        playerTeams.map(Number),
        rivalFeds.map(Number),
      ),
    queryKeyToInvalidate: ['cups', 'summary'],
    successMessage: 'Copa Inter-Ligas creada correctamente',
    onSuccess: () => { setPlayerTeams([]); setRivalFeds([]); },
  });

  const available = isPreseason && unlocked;

  return (
    <Card
      mb="md"
      style={{
        border: '1px solid rgba(255,255,255,0.06)',
        borderLeft: `3px solid ${available ? '#3B82F6' : 'rgba(255,255,255,0.1)'}`,
      }}
      p={0}
    >
      <Group
        justify="space-between"
        px="md"
        py="sm"
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setOpen(!open)}
      >
        <Group gap="sm">
          <IconUsers size={16} color={available ? '#3B82F6' : 'rgba(255,255,255,0.3)'} />
          <Text fw={700} size="sm" c={available ? undefined : 'dimmed'}>
            Copa Inter-Ligas
          </Text>
          {!unlocked && (
            <Badge size="xs" color="gray" variant="light">Requiere 50 prestigio</Badge>
          )}
          {unlocked && !isPreseason && (
            <Badge size="xs" color="gray" variant="light">Solo en pretemporada</Badge>
          )}
          {unlocked && isPreseason && (
            <Badge size="xs" color="blue" variant="light">Champions internacionales</Badge>
          )}
        </Group>
        <Box style={{ color: 'rgba(255,255,255,0.4)' }}>
          {open ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
        </Box>
      </Group>

      <Collapse in={open}>
        <Box px="md" pb="md">
          <Text size="xs" c="dimmed" mb="sm">
            Enfrenta al campeón de la liga rival con equipos de tu federación. Disponible cuando el prestigio ≥ 50.
          </Text>
          <Stack>
            <Group grow>
              <TextInput
                label="Nombre"
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                disabled={!available}
              />
              <Select
                label="Formato"
                value={formato}
                onChange={(v) => setFormato((v ?? 'eliminatoria') as CupFormat)}
                data={[
                  { value: 'eliminatoria', label: 'Eliminatoria' },
                  { value: 'eliminatoria_ida_vuelta', label: 'Eliminatoria I/V' },
                ]}
                disabled={!available}
              />
            </Group>
            <MultiSelect
              label="Tus equipos representantes"
              placeholder="Elige al menos 1 equipo de tu liga"
              data={playerTeamOptions}
              value={playerTeams}
              onChange={setPlayerTeams}
              searchable
              clearable
              disabled={!available}
            />
            <MultiSelect
              label="Federaciones rivales invitadas"
              placeholder="Elige las federaciones cuyos campeones participan"
              data={rivalFederationOptions}
              value={rivalFeds}
              onChange={setRivalFeds}
              searchable
              clearable
              maxValues={7}
              disabled={!available}
            />
            <Group justify="flex-end">
              <Button
                variant="gradient"
                gradient={{ from: '#3B82F6', to: '#2563EB' }}
                leftSection={<IconPlus size={14} />}
                loading={create.isPending}
                disabled={!available || playerTeams.length < 1 || rivalFeds.length < 1 || !name.trim()}
                onClick={() => create.mutate(undefined as void)}
              >
                Crear Copa Inter-Ligas
              </Button>
            </Group>
          </Stack>
        </Box>
      </Collapse>
    </Card>
  );
}

/* ── Edit Cup Modal ───────────────────────────────────────────────────── */

function EditCupModal({
  cup,
  teamOptions,
  onClose,
  onSave,
  saving,
}: {
  cup: CupDto | null;
  teamOptions: { value: string; label: string }[];
  onClose: () => void;
  onSave: (cupId: number, teamIds: number[]) => void;
  saving: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  // Reset to cup's current participants when cup changes
  useMemo(() => {
    if (cup) setSelected(cup.participantTeamIds.map(String));
  }, [cup?.id]);

  if (!cup) return null;

  return (
    <Modal
      opened={cup !== null}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconTrophy size={16} color="#F59E0B" />
          <Text fw={700}>Editar participantes — {cup.name}</Text>
        </Group>
      }
      size="md"
    >
      <Stack gap="sm">
        <Group gap="xs">
          <IconUsers size={13} color="rgba(255,255,255,0.4)" />
          <Text size="xs" c="dimmed">
            Actualmente: {cup.participantTeamIds.length} equipos · Seleccionado: {selected.length} equipos
          </Text>
        </Group>

        <MultiSelect
          label="Participantes"
          placeholder="Elige al menos 2 equipos"
          data={teamOptions}
          value={selected}
          onChange={setSelected}
          searchable
          clearable
          maxValues={32}
        />

        <Group gap="xs">
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            onClick={() => setSelected(teamOptions.map((t) => t.value))}
          >
            Seleccionar todos
          </Button>
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            onClick={() => setSelected([])}
          >
            Limpiar
          </Button>
        </Group>

        {cup.recurring && (
          <Text size="xs" c="dimmed" style={{ fontStyle: 'italic' }}>
            Al ser recurrente, este cambio se aplicará en la próxima temporada.
          </Text>
        )}

        <Group justify="flex-end" mt="xs">
          <Button variant="subtle" color="gray" onClick={onClose}>Cancelar</Button>
          <Button
            variant="gradient"
            gradient={{ from: '#F59E0B', to: '#D97706' }}
            disabled={selected.length < 2}
            loading={saving}
            leftSection={<IconEdit size={14} />}
            onClick={() => onSave(cup.id, selected.map(Number))}
          >
            Guardar cambios
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/* ── Main page ────────────────────────────────────────────────────────── */

export function CupsPage() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);

  const cups = useQuery({ queryKey: QK.cups(id), queryFn: () => api.cups(id) });
  const structure = useQuery({ queryKey: QK.structure(id), queryFn: () => api.structure(id) });
  const summary = useQuery({ queryKey: QK.summary(id), queryFn: () => api.summary(id) });
  const isPreseason = summary.data?.phase === 'pretemporada';
  const prestige = summary.data?.federation.prestige ?? 0;

  const [editingCup, setEditingCup] = useState<CupDto | null>(null);

  const teamOptions = useMemo(() => {
    const all = (structure.data?.divisions ?? []).flatMap((d) => d.teams);
    const seen = new Set<number>();
    return all
      .filter((t) => { if (seen.has(t.teamId)) return false; seen.add(t.teamId); return true; })
      .map((t) => ({ value: String(t.teamId), label: t.name }));
  }, [structure.data]);

  const rivalFedOptions = useMemo(() => {
    return (cups.data?.rivalFederations ?? []).map((f) => ({
      value: String(f.federationId),
      label: f.lastChampionName ? `${f.name} (campeón: ${f.lastChampionName})` : f.name,
    }));
  }, [cups.data]);

  const editMutation = useMutationWithFeedback({
    mutationFn: ({ cupId, teamIds }: { cupId: number; teamIds: number[] }) =>
      api.editCup(id, cupId, teamIds),
    queryKeyToInvalidate: ['cups'],
    successMessage: 'Participantes actualizados',
    onSuccess: () => setEditingCup(null),
  });

  const deleteMutation = useMutationWithFeedback({
    mutationFn: (cupId: number) => api.deleteCup(id, cupId),
    queryKeyToInvalidate: ['cups', 'prizes'],
    successMessage: 'Copa eliminada (el historial se conserva)',
  });

  const handleDelete = (cup: CupDto) => {
    modals.openConfirmModal({
      title: `Eliminar ${cup.name}`,
      children: (
        <Text size="sm">
          Se eliminará la copa de la temporada actual. El historial de campeones anteriores se conserva.
          {cup.recurring && ' Al ser recurrente, tampoco se recreará en la próxima temporada.'}
        </Text>
      ),
      labels: { confirm: 'Eliminar', cancel: 'Cancelar' },
      confirmProps: { color: 'red' },
      onConfirm: () => deleteMutation.mutate(cup.id),
    });
  };

  // Group cups by year, descending (current season first)
  const cupsByYear = useMemo(() => {
    const list = cups.data?.cups ?? [];
    const map = new Map<number, CupDto[]>();
    for (const cup of list) {
      const arr = map.get(cup.year) ?? [];
      arr.push(cup);
      map.set(cup.year, arr);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [cups.data]);

  const currentYear = cupsByYear[0]?.[0];
  const pastGroups = cupsByYear.slice(1);
  const totalCups = cups.data?.cups.length ?? 0;

  if (cups.isLoading || summary.isLoading) {
    return (
      <div className="page-enter">
        <Skeleton height={60} radius="md" mb="md" />
        <Skeleton height={300} radius="md" mb="md" />
        <Skeleton height={200} radius="md" />
      </div>
    );
  }

  return (
    <div className="page-enter">
      <PageHero
        icon={IconTrophy}
        iconColor="#F59E0B"
        title="Copas"
        subtitle="Las copas se crean en pretemporada y el calendario las integra desde el inicio. El campeón entra al historial / palmarés."
      />

      <EditCupModal
        cup={editingCup}
        teamOptions={teamOptions}
        onClose={() => setEditingCup(null)}
        onSave={(cupId, teamIds) => editMutation.mutate({ cupId, teamIds })}
        saving={editMutation.isPending}
      />

      <CreateCupForm isPreseason={isPreseason} teamOptions={teamOptions} />
      <CreateInterLeagueCupForm
        isPreseason={isPreseason}
        prestige={prestige}
        playerTeamOptions={teamOptions}
        rivalFederationOptions={rivalFedOptions}
      />

      <Tabs defaultValue="copas" keepMounted={false}>
        <Tabs.List
          mb="md"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10,
            padding: 4,
          }}
        >
          <Tabs.Tab value="copas" leftSection={<IconTrophy size={14} />} style={{ fontWeight: 600 }}>
            Copas {totalCups > 0 && <Badge size="xs" ml={4} color="yellow" variant="light">{totalCups}</Badge>}
          </Tabs.Tab>
          <Tabs.Tab value="calendario" leftSection={<IconCalendar size={14} />} style={{ fontWeight: 600 }}>
            Calendario
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="copas">
          {totalCups === 0 ? (
            <Paper p="md" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
              <EmptyState
                icon={IconTrophy}
                title="Sin copas todavía"
                description="Crea una copa en pretemporada para que aparezca aquí y se juegue durante la temporada."
                color="#F59E0B"
              />
            </Paper>
          ) : (
            <>
              {/* Current season */}
              {currentYear !== undefined && (
                <Box mb="lg">
                  <Group gap="xs" mb="sm">
                    <Text fw={700} size="sm" c="dimmed" tt="uppercase" style={{ letterSpacing: '0.06em' }}>
                      Temporada {currentYear}
                    </Text>
                    <Badge size="xs" color="blue" variant="light">
                      {cupsByYear[0][1].filter(c => c.status === 'en_curso').length > 0 ? 'En curso' : 'Finalizada'}
                    </Badge>
                  </Group>
                  <CupGroup
                    year={currentYear}
                    cups={cupsByYear[0][1]}
                    isCurrentSeason={true}
                    isPreseason={isPreseason}
                    onEdit={setEditingCup}
                    onDelete={handleDelete}
                  />
                </Box>
              )}

              {/* Past seasons */}
              {pastGroups.length > 0 && (
                <Box>
                  <Text fw={700} size="sm" c="dimmed" tt="uppercase" mb="sm" style={{ letterSpacing: '0.06em' }}>
                    Historial
                  </Text>
                  {pastGroups.map(([year, yearCups]) => (
                    <CupGroup
                      key={year}
                      year={year}
                      cups={yearCups}
                      isCurrentSeason={false}
                      isPreseason={isPreseason}
                      onEdit={setEditingCup}
                      onDelete={handleDelete}
                    />
                  ))}
                </Box>
              )}
            </>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="calendario">
          <Paper p="md" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <Group gap="xl" mb="md">
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: '0.05em' }}>Jornadas de liga</Text>
                <Text fw={800} size="xl" style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: '#F9FAFB' }}>
                  {cups.data?.totalMatchdays ?? 0}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: '0.05em' }}>Rondas de copa</Text>
                <Text fw={800} size="xl" style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: '#F59E0B' }}>
                  {cups.data?.schedule.length ?? 0}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: '0.05em' }}>Jornada actual</Text>
                <Text fw={800} size="xl" style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: '#10B981' }}>
                  {cups.data?.currentMatchday ?? 0}
                </Text>
              </div>
            </Group>
            <SeasonCalendar
              schedule={cups.data?.schedule ?? []}
              currentMatchday={cups.data?.currentMatchday ?? 0}
              totalMatchdays={cups.data?.totalMatchdays ?? 0}
            />
          </Paper>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
