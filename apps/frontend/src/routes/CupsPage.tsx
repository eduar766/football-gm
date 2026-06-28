import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  Group,
  MultiSelect,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { IconCheck, IconLayoutGrid, IconTrophy, IconX } from '@tabler/icons-react';
import type {
  CupCategory,
  CupFormat,
  CupDto,
  CupMatchDto,
  CupStatus,
  CupType,
} from '@football-gm/contracts';
import { api } from '../api';
import { BracketView } from '../components/BracketView';

const TIPO_LABEL: Record<CupType, string> = {
  copa: 'Copa',
  liga_juvenil: 'Liga juvenil',
  torneo_verano: 'Torneo de verano',
};

const STATUS_CONFIG: Record<CupStatus, { label: string; gradient: string }> = {
  en_curso: { label: 'En curso', gradient: 'linear-gradient(135deg, #2563EB, #3B82F6)' },
  finalizada: { label: 'Finalizada', gradient: 'linear-gradient(135deg, #059669, #10B981)' },
};

type RoundGroup = {
  logicalNumero: number;
  legs: { numero: number; label: string; matches: CupMatchDto[] }[];
};

function groupRounds(cup: CupDto): RoundGroup[] {
  const isIdaVuelta = cup.formato === 'eliminatoria_ida_vuelta';
  const groups: RoundGroup[] = [];
  if (isIdaVuelta) {
    const seen = new Set<number>();
    for (const r of cup.rounds) {
      if (seen.has(r.numero)) continue;
      const logicalNumero = r.numero;
      const ida = cup.rounds.find((x) => x.numero === logicalNumero && x.leg === 'ida');
      const vuelta = cup.rounds.find((x) => x.numero === logicalNumero + 1 && x.leg === 'vuelta');
      const legs: RoundGroup['legs'] = [];
      if (ida) legs.push({ numero: ida.numero, label: 'Ida', matches: ida.matches });
      if (vuelta) legs.push({ numero: vuelta.numero, label: 'Vuelta', matches: vuelta.matches });
      groups.push({ logicalNumero, legs });
      seen.add(logicalNumero);
      if (vuelta) seen.add(vuelta.numero);
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
        padding: '3px 12px',
        borderRadius: 14,
        background: sc.gradient,
        color: '#fff',
        fontWeight: 600,
        fontSize: '12px',
      }}
    >
      {sc.label}
    </Box>
  );
}

function CupHeader({ cup }: { cup: CupDto }) {
  return (
    <Group justify="space-between" mb="sm">
      <div>
        <Group gap="sm">
          <IconTrophy size={18} color="#F59E0B" />
          <Text fw={700} size="lg">{cup.name}</Text>
        </Group>
        <Text size="xs" c="dimmed" ml={30}>
          {TIPO_LABEL[cup.tipo]} ·{' '}
          {cup.formato === 'liga' ? 'liga' : cup.formato === 'eliminatoria_ida_vuelta' ? 'ida y vuelta' : 'partido único'}
          {cup.categoria === 'juvenil' ? ' · juvenil' : ''} · año {cup.year}
        </Text>
      </div>
      <Group gap="xs">
        {cup.recurring && (
          <Box
            style={{
              padding: '3px 12px',
              borderRadius: 14,
              background: 'rgba(139,92,246,0.15)',
              color: '#8B5CF6',
              fontWeight: 600,
              fontSize: '12px',
            }}
          >
            Recurrente
          </Box>
        )}
        <CupStatusBadge status={cup.status} />
      </Group>
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
        background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(217,119,6,0.08) 100%)',
        border: '1px solid rgba(245,158,11,0.3)',
      }}
    >
      <Group gap="sm">
        <Box
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #F59E0B, #D97706)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            flexShrink: 0,
          }}
        >
          🏆
        </Box>
        <div>
          <Text size="xs" c="dimmed">Campeón</Text>
          <Text fw={800} size="sm" style={{ color: '#F59E0B' }}>
            {cup.championTeamName}
          </Text>
        </div>
      </Group>
    </Box>
  );
}

/* ── Liga format: match list ──────────────────────────────────────────── */

function LigaCupCard({ cup }: { cup: CupDto }) {
  const groups = groupRounds(cup);
  return (
    <Paper
      p="md"
      mb="md"
      className="stagger-item"
      style={{
        border: '1px solid rgba(255,255,255,0.06)',
        borderLeft: '3px solid #10B981',
      }}
    >
      <CupHeader cup={cup} />
      <ChampionBanner cup={cup} />
      {groups.map((g) => {
        const realMatches = g.legs
          .flatMap((l) => l.matches)
          .filter((m) => m.homeTeamName !== 'BYE' && m.awayTeamName !== 'BYE');
        if (realMatches.length === 0) return null;
        return (
          <Box key={g.logicalNumero} mb="sm">
            <Group gap="sm" mb={4}>
              <Box
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: 'rgba(16,185,129,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text fw={700} style={{ fontFamily: '"Geist Mono", monospace', fontSize: '10px', color: '#10B981' }}>
                  {g.logicalNumero}
                </Text>
              </Box>
              <Text size="sm" fw={600}>Jornada {g.logicalNumero}</Text>
            </Group>
            <Table>
              <Table.Tbody>
                {realMatches.map((m, i) => (
                  <Table.Tr
                    key={i}
                    style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}
                  >
                    <Table.Td fw={m.winnerTeamId === m.homeTeamId ? 700 : 400} style={{ textAlign: 'right' }}>
                      {m.homeTeamName}
                    </Table.Td>
                    <Table.Td ta="center">
                      {m.played ? (
                        <Group gap="xs" justify="center">
                          <Text fw={800} style={{ fontFamily: '"Geist Mono", monospace', fontSize: '16px', color: '#F9FAFB', minWidth: 24, textAlign: 'center' }}>
                            {m.homeGoals}
                          </Text>
                          <Text c="dimmed" style={{ fontFamily: '"Geist Mono", monospace' }}>–</Text>
                          <Text fw={800} style={{ fontFamily: '"Geist Mono", monospace', fontSize: '16px', color: '#F9FAFB', minWidth: 24, textAlign: 'center' }}>
                            {m.awayGoals}
                          </Text>
                        </Group>
                      ) : (
                        <Text c="dimmed" size="sm" style={{ fontFamily: '"Geist Mono", monospace' }}>vs</Text>
                      )}
                    </Table.Td>
                    <Table.Td fw={m.winnerTeamId === m.awayTeamId ? 700 : 400}>
                      {m.awayTeamName}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Box>
        );
      })}
    </Paper>
  );
}

/* ── Elimination bracket ──────────────────────────────────────────────── */

function EliminationCupCard({ cup }: { cup: CupDto }) {
  const [expanded, setExpanded] = useState(true);
  const groups = groupRounds(cup);

  // Build bracket rounds (filter BYEs per round, keep structure)
  const bracketRounds = groups.map((g) => ({
    label: g.legs.length > 1
      ? `Ronda ${g.logicalNumero}`
      : g.legs[0]?.label
        ? `Ronda ${g.logicalNumero} · ${g.legs[0].label}`
        : `Ronda ${g.logicalNumero}`,
    matches: g.legs.flatMap((l) => l.matches),
  }));

  return (
    <Paper
      p="md"
      mb="md"
      className="stagger-item"
      style={{
        border: '1px solid rgba(255,255,255,0.06)',
        borderLeft: '3px solid #F59E0B',
      }}
    >
      <Group justify="space-between" mb="sm">
        <div style={{ flex: 1 }}>
          <CupHeader cup={cup} />
        </div>
        <Button
          size="compact-xs"
          variant="subtle"
          color="gray"
          leftSection={<IconLayoutGrid size={14} />}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Ocultar bracket' : 'Ver bracket'}
        </Button>
      </Group>
      <ChampionBanner cup={cup} />
      {expanded && (
        <Box mt="xs">
          <BracketView rounds={bracketRounds} championTeamName={cup.championTeamName} />
        </Box>
      )}
    </Paper>
  );
}

/* ── Main page ────────────────────────────────────────────────────────── */

export function CupsPage() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);
  const qc = useQueryClient();

  const cups = useQuery({ queryKey: ['cups', id], queryFn: () => api.cups(id) });
  const structure = useQuery({ queryKey: ['structure', id], queryFn: () => api.structure(id) });
  const summary = useQuery({ queryKey: ['summary', id], queryFn: () => api.summary(id) });
  const isPreseason = summary.data?.phase === 'pretemporada';

  const teamOptions = useMemo(() => {
    const all = (structure.data?.divisions ?? []).flatMap((d) => d.teams);
    const seen = new Set<number>();
    return all
      .filter((t) => { if (seen.has(t.teamId)) return false; seen.add(t.teamId); return true; })
      .map((t) => ({ value: String(t.teamId), label: t.name }));
  }, [structure.data]);

  const [name, setName] = useState('Copa de la Federación');
  const [tipo, setTipo] = useState<CupType>('copa');
  const [formato, setFormato] = useState<CupFormat>('eliminatoria');
  const [categoria, setCategoria] = useState<CupCategory>('primer_equipo');
  const [participants, setParticipants] = useState<string[]>([]);
  const [recurring, setRecurring] = useState(false);

  const create = useMutation({
    mutationFn: () =>
      api.createCup(id, {
        name, tipo, formato, categoria,
        participantTeamIds: participants.map(Number),
        recurring,
      }),
    onSuccess: () => {
      notifications.show({ color: 'green', icon: <IconCheck size={18} />, title: 'Éxito', message: 'Copa creada correctamente' });
      setParticipants([]);
      qc.invalidateQueries({ predicate: (q) => ['cups', 'summary', 'history'].includes(q.queryKey[0] as string) });
    },
    onError: (error: Error) => {
      notifications.show({ color: 'red', icon: <IconX size={18} />, title: 'Error', message: error.message });
    },
  });

  if (cups.isLoading || summary.isLoading) {
    return (
      <div className="page-enter">
        <Skeleton height={120} radius="md" mb="md" />
        <Skeleton height={300} radius="md" mb="md" />
        <Skeleton height={200} radius="md" />
      </div>
    );
  }

  const list = cups.data?.cups ?? [];
  const ligaCups = list.filter((c) => c.formato === 'liga');
  const elimCups = list.filter((c) => c.formato !== 'liga');

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
          <IconTrophy size={22} color="#F59E0B" />
          <Text
            fw={800}
            style={{
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              fontSize: '28px',
              color: '#F9FAFB',
            }}
          >
            Copas
          </Text>
        </Group>
        <Text size="sm" c="dimmed" mt="xs" ml={34}>
          Las copas se crean en pretemporada y el calendario las integra desde
          el inicio. El campeón entra al historial / palmarés.
        </Text>
      </Paper>

      {!isPreseason && summary.data && (
        <Alert color="gray" mb="md" title="Pretemporada solo">
          Las copas y ligas juveniles deben crearse en pretemporada para que el
          calendario las incluya desde la jornada 1 (§4.8). Cierra la temporada
          para volver a esta ventana.
        </Alert>
      )}

      <Card
        p="md"
        mb="md"
        style={{
          border: '1px solid rgba(255,255,255,0.06)',
          borderLeft: '3px solid #F59E0B',
        }}
      >
        <Text fw={700} mb={4}>Crear copa</Text>
        <Text size="xs" c="dimmed" mb="sm">
          La categoría juvenil la disputan las canteras de los clubes.
        </Text>
        <Stack>
          <Group grow>
            <TextInput
              label="Nombre"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
            />
            <Select
              label="Tipo"
              data={(Object.keys(TIPO_LABEL) as CupType[]).map((t) => ({ value: t, label: TIPO_LABEL[t] }))}
              value={tipo}
              onChange={(v) => v && setTipo(v as CupType)}
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
            />
            <Select
              label="Categoría"
              data={[
                { value: 'primer_equipo', label: 'Primer equipo' },
                { value: 'juvenil', label: 'Juvenil (cantera)' },
              ]}
              value={categoria}
              onChange={(v) => v && setCategoria(v as CupCategory)}
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
          <Group>
            <Button
              onClick={() => create.mutate()}
              disabled={participants.length < 2 || name.trim().length === 0 || !isPreseason}
              loading={create.isPending}
              leftSection={<IconTrophy size={16} />}
              variant="gradient"
              gradient={{ from: '#F59E0B', to: '#D97706' }}
            >
              Crear copa
            </Button>
          </Group>
        </Stack>
      </Card>

      {list.length === 0 ? (
        <Paper p="md" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          <Text c="dimmed" size="sm">Sin copas todavía.</Text>
        </Paper>
      ) : (
        <>
          {/* ── Elimination Brackets ──────────────────────────── */}
          {elimCups.length > 0 && (
            <Box mb="md">
              <Group gap="sm" mb="sm">
                <IconTrophy size={16} color="#F59E0B" />
                <Text fw={700} size="lg">Brackets de Eliminación</Text>
              </Group>
              <Text size="xs" c="dimmed" mb="md" ml={24}>
                Fase eliminatoria directa — el perdedor queda fuera.
              </Text>
              {elimCups.map((cup) => (
                <EliminationCupCard key={cup.id} cup={cup} />
              ))}
            </Box>
          )}

          {/* ── Group Stage (Liga) ────────────────────────────── */}
          {ligaCups.length > 0 && (
            <Box>
              <Group gap="sm" mb="sm">
                <IconLayoutGrid size={16} color="#10B981" />
                <Text fw={700} size="lg">Fase de Grupos</Text>
              </Group>
              <Text size="xs" c="dimmed" mb="md" ml={24}>
                Liga todos contra todos — el líder alza la copa.
              </Text>
              {ligaCups.map((cup) => (
                <LigaCupCard key={cup.id} cup={cup} />
              ))}
            </Box>
          )}
        </>
      )}
    </div>
  );
}
