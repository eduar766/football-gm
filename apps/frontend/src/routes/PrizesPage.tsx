import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  NumberInput,
  Paper,
  Skeleton,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import {
  IconDeviceFloppy,
  IconMedal,
  IconTrophy,
  IconTrash,
  IconUsers,
} from '@tabler/icons-react';
import { EmptyState } from '../components/EmptyState';
import type { CompetitionPrizeDto } from '@football-gm/contracts';
import { api } from '../api';
import { useMutationWithFeedback } from '../useMutationWithFeedback';
import { QK } from '../query-keys';
import { money } from '../utils/format';
import { PageHero } from '../components/PageHero';
import { MEDAL_COLORS } from '../domain-labels';

const POS_LABELS = ['1º', '2º', '3º', '4º', '5º', '6º', '7º', '8º', '9º', '10º', '11º', '12º', '13º', '14º', '15º', '16º'];

/* ── Preset generator ─────────────────────────────────────────────────── */

function generatePreset(type: 'champion' | 'top3' | 'equal' | 'pyramid', n: number): number[] {
  const clamp = Math.max(1, Math.min(n, 16));
  if (type === 'champion') return [100];
  if (type === 'top3') {
    if (clamp === 1) return [100];
    if (clamp === 2) return [60, 40];
    return [50, 30, 20];
  }
  if (type === 'equal') {
    const each = Math.floor(100 / clamp);
    const remainder = 100 - each * clamp;
    // Spread the leftover points across the TOP positions — never dump them on
    // the last place (that made the worst team earn the most).
    return Array.from({ length: clamp }, (_, i) => each + (i < remainder ? 1 : 0));
  }
  // pyramid: rank-weighted (n, n-1, ..., 1) normalized to 100
  const weights = Array.from({ length: clamp }, (_, i) => clamp - i);
  const total = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => Math.floor((w / total) * 100));
  raw[0] += 100 - raw.reduce((a, b) => a + b, 0);
  return raw;
}

/* ── Share editor with live € preview ────────────────────────────────── */

function ShareRow({ pos, pct, pool, onChange, onRemove, disabled }: {
  pos: number;
  pct: number;
  pool: number;
  onChange: (v: number) => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  const euros = pool * (pct / 100);
  return (
    <Group gap="xs" wrap="nowrap" align="flex-start">
      <Stack gap={0} style={{ minWidth: 24 }}>
        <Text size="xs" c="dimmed" ta="center">{POS_LABELS[pos] ?? `${pos + 1}º`}</Text>
        {!disabled && (
          <Button
            size="compact-xxs"
            variant="subtle"
            color="red"
            onClick={onRemove}
            style={{ padding: 0, height: 16 }}
          >
            ×
          </Button>
        )}
      </Stack>
      <Stack gap={2}>
        <NumberInput
          value={pct}
          onChange={(v) => onChange(Number(v) || 0)}
          min={0}
          max={100}
          step={5}
          disabled={disabled}
          hideControls
          styles={{
            input: {
              width: 60,
              textAlign: 'center',
              fontFamily: 'var(--mantine-font-family-monospace)',
              fontSize: '13px',
              fontWeight: 700,
            },
          }}
          rightSection={<Text size="xs" c="dimmed">%</Text>}
          rightSectionWidth={20}
        />
        {pool > 0 && (
          <Text
            size="10px"
            ta="center"
            style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: MEDAL_COLORS[pos] ?? '#10B981' }}
          >
            {money(euros)}
          </Text>
        )}
      </Stack>
    </Group>
  );
}

function ShareEditor({
  shares,
  onChange,
  disabled,
  pool,
  maxPositions,
}: {
  shares: number[];
  onChange: (next: number[]) => void;
  disabled: boolean;
  pool: number;
  maxPositions: number;
}) {
  const total = shares.reduce((a, b) => a + b, 0);
  const overBudget = total > 100;

  const update = (i: number, v: number) => {
    const next = [...shares];
    next[i] = Math.max(0, v);
    onChange(next);
  };
  const addPos = () => onChange([...shares, 0]);
  const removePos = (i: number) => onChange(shares.filter((_, j) => j !== i));

  return (
    <Stack gap="xs">
      <Group gap="md" wrap="wrap" align="flex-start">
        {shares.map((s, i) => (
          <ShareRow
            key={i}
            pos={i}
            pct={s}
            pool={pool}
            onChange={(v) => update(i, v)}
            onRemove={() => removePos(i)}
            disabled={disabled}
          />
        ))}
        {!disabled && shares.length < maxPositions && (
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            onClick={addPos}
            style={{ alignSelf: 'flex-end', marginBottom: 4 }}
          >
            + Posición
          </Button>
        )}
      </Group>

      {/* Distribution bar */}
      <Group gap={2} style={{ height: 18 }}>
        {shares.map((s, i) => {
          if (s <= 0) return null;
          return (
            <Box
              key={i}
              style={{
                width: Math.max(20, (s / Math.max(total, 1)) * 220),
                height: 18,
                borderRadius: 4,
                background: MEDAL_COLORS[i] ?? '#6B7280',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'width 0.2s',
              }}
            >
              <Text style={{ fontSize: '9px', fontWeight: 700, color: '#fff' }}>{s}%</Text>
            </Box>
          );
        })}
      </Group>

      <Text
        size="xs"
        fw={600}
        style={{
          fontFamily: 'var(--mantine-font-family-monospace)',
          color: overBudget ? '#EF4444' : total === 100 ? '#10B981' : '#9CA3AF',
        }}
      >
        Total: {total}%{overBudget ? ' — excede 100%, se normalizará al pagar' : ''}
      </Text>
    </Stack>
  );
}

/* ── Competition prize card ───────────────────────────────────────────── */

interface CompetitionInfo {
  kind: 'liga' | 'copa';
  name: string;
  cupId?: number;
  teamCount: number;
  accentColor: string;
  existingPrize: CompetitionPrizeDto | undefined;
}

function CompetitionPrizeCard({
  info,
  isPreseason,
  onSave,
  onRemove,
  saving,
  removing,
}: {
  info: CompetitionInfo;
  isPreseason: boolean;
  onSave: (pool: number, shares: number[]) => void;
  onRemove: () => void;
  saving: boolean;
  removing: boolean;
}) {
  const [pool, setPool] = useState(info.existingPrize?.pool ?? 0);
  const [shares, setShares] = useState<number[]>(info.existingPrize?.shares ?? [50, 30, 20]);

  useEffect(() => {
    if (info.existingPrize) {
      setPool(info.existingPrize.pool);
      setShares(info.existingPrize.shares);
    }
  }, [info.existingPrize?.id]);

  const maxPositions = Math.min(info.teamCount || 32, 16);

  const applyPreset = (type: 'champion' | 'top3' | 'equal' | 'pyramid') => {
    const n = type === 'champion' ? 1 : type === 'top3' ? Math.min(maxPositions, 3) : maxPositions;
    setShares(generatePreset(type, n));
  };

  return (
    <Card
      p="md"
      style={{
        border: '1px solid rgba(255,255,255,0.06)',
        borderLeft: `3px solid ${info.accentColor}`,
      }}
    >
      {/* Header */}
      <Group justify="space-between" mb="sm">
        <Group gap="xs">
          {info.kind === 'liga' ? (
            <IconMedal size={17} color={info.accentColor} />
          ) : (
            <IconTrophy size={17} color={info.accentColor} />
          )}
          <Text fw={700} size="sm">{info.name}</Text>
        </Group>
        <Group gap="xs">
          {info.teamCount > 0 && (
            <Badge size="xs" variant="light" color="gray" leftSection={<IconUsers size={10} />}>
              {info.teamCount} equipos
            </Badge>
          )}
          {info.existingPrize && (
            <Badge size="xs" variant="light" color="green">Premio activo</Badge>
          )}
        </Group>
      </Group>

      <Stack gap="sm">
        {/* Pool */}
        <NumberInput
          label="Bolsa total (€)"
          value={pool}
          onChange={(v) => setPool(Number(v) || 0)}
          min={0}
          step={500_000}
          thousandSeparator="."
          decimalSeparator=","
          disabled={!isPreseason}
          styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' } }}
        />

        {/* Presets */}
        {isPreseason && (
          <Group gap="xs">
            <Text size="xs" c="dimmed">Preset:</Text>
            <Button size="compact-xs" variant="light" color="yellow" onClick={() => applyPreset('champion')}>
              Solo campeón
            </Button>
            {maxPositions >= 3 && (
              <Button size="compact-xs" variant="light" color="orange" onClick={() => applyPreset('top3')}>
                Top 3
              </Button>
            )}
            <Button size="compact-xs" variant="light" color="blue" onClick={() => applyPreset('equal')}>
              Equitativo
            </Button>
            <Button size="compact-xs" variant="light" color="violet" onClick={() => applyPreset('pyramid')}>
              Pirámide
            </Button>
          </Group>
        )}

        {/* Shares */}
        <ShareEditor
          shares={shares}
          onChange={setShares}
          disabled={!isPreseason}
          pool={pool}
          maxPositions={maxPositions}
        />

        {/* Actions */}
        <Group gap="xs">
          <Button
            size="sm"
            onClick={() => onSave(pool, shares)}
            loading={saving}
            disabled={!isPreseason}
            leftSection={<IconDeviceFloppy size={15} />}
            variant="gradient"
            gradient={{ from: info.accentColor, to: info.accentColor }}
          >
            Guardar
          </Button>
          {info.existingPrize && (
            <Button
              size="sm"
              variant="subtle"
              color="red"
              leftSection={<IconTrash size={13} />}
              loading={removing}
              disabled={!isPreseason}
              onClick={() =>
                modals.openConfirmModal({
                  title: `Quitar premio — ${info.name}`,
                  children: <Text size="sm">¿Eliminar el premio activo? El historial de pagos se conserva.</Text>,
                  labels: { confirm: 'Quitar', cancel: 'Cancelar' },
                  confirmProps: { color: 'red' },
                  onConfirm: onRemove,
                })
              }
            >
              Quitar
            </Button>
          )}
        </Group>
      </Stack>
    </Card>
  );
}

/* ── Main page ────────────────────────────────────────────────────────── */

export function PrizesPage() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);

  const summary = useQuery({ queryKey: QK.summary(id), queryFn: () => api.summary(id) });
  const prizes = useQuery({ queryKey: QK.prizes(id), queryFn: () => api.prizes(id) });
  const cups = useQuery({ queryKey: QK.cups(id), queryFn: () => api.cups(id) });
  const structure = useQuery({ queryKey: QK.structure(id), queryFn: () => api.structure(id) });

  const isPreseason = summary.data?.phase === 'pretemporada';

  const saveLeague = useMutationWithFeedback({
    mutationFn: ({ pool, shares }: { pool: number; shares: number[] }) =>
      api.setLeaguePrize(id, pool, shares),
    queryKeyToInvalidate: ['prizes', 'economy', 'summary'],
    successMessage: 'Premio de liga guardado',
  });

  const saveCup = useMutationWithFeedback({
    mutationFn: ({ cupId, pool, shares }: { cupId: number; pool: number; shares: number[] }) =>
      api.setCupPrize(id, cupId, pool, shares),
    queryKeyToInvalidate: ['prizes', 'economy', 'summary'],
    successMessage: 'Premio de copa guardado',
  });

  const remove = useMutationWithFeedback({
    mutationFn: (prizeId: number) => api.removePrize(id, prizeId),
    queryKeyToInvalidate: ['prizes', 'economy', 'summary'],
    successMessage: 'Premio eliminado',
  });

  // Build competition list — only current season's cups
  const competitions = useMemo((): CompetitionInfo[] => {
    if (!prizes.data) return [];
    const ligaPrize = prizes.data.prizes.find((p) => p.kind === 'liga');
    const leagueTeamCount = structure.data?.divisions[0]?.teams.length ?? 0;

    const result: CompetitionInfo[] = [
      {
        kind: 'liga',
        name: 'Liga (1ª división)',
        teamCount: leagueTeamCount,
        accentColor: '#F59E0B',
        existingPrize: ligaPrize,
      },
    ];

    const currentYear = summary.data?.year;
    const currentCups = (cups.data?.cups ?? []).filter((c) => c.year === currentYear);

    const cupPrizeMap = new Map(prizes.data.prizes.filter((p) => p.kind === 'copa').map((p) => [p.cupId, p]));
    for (const cup of currentCups) {
      result.push({
        kind: 'copa',
        name: cup.name,
        cupId: cup.id,
        teamCount: cup.participantTeamIds.length,
        accentColor: '#8B5CF6',
        existingPrize: cupPrizeMap.get(cup.id),
      });
    }
    return result;
  }, [prizes.data, cups.data, structure.data, summary.data?.year]);

  if (prizes.isLoading || !prizes.data) {
    return (
      <div className="page-enter">
        <Skeleton height={60} radius="md" mb="md" />
        <Skeleton height={280} radius="md" mb="md" />
        <Skeleton height={200} radius="md" />
      </div>
    );
  }

  return (
    <div className="page-enter">
      <PageHero
        icon={IconTrophy}
        iconColor="#F59E0B"
        title="Premios"
        subtitle="Configura la bolsa y el reparto por posición para la liga y cada copa."
      />

      {!isPreseason && (
        <Alert color="yellow" variant="light" mb="md">
          Los premios solo se editan en pretemporada.
        </Alert>
      )}

      <Stack gap="md" mb="xl">
        {competitions.map((comp) => (
          <CompetitionPrizeCard
            key={comp.kind === 'liga' ? 'liga' : `copa-${comp.cupId}`}
            info={comp}
            isPreseason={isPreseason}
            saving={saveLeague.isPending || saveCup.isPending}
            removing={remove.isPending}
            onSave={(pool, shares) => {
              if (comp.kind === 'liga') {
                saveLeague.mutate({ pool, shares });
              } else {
                saveCup.mutate({ cupId: comp.cupId!, pool, shares });
              }
            }}
            onRemove={() => {
              if (comp.existingPrize) remove.mutate(comp.existingPrize.id);
            }}
          />
        ))}
      </Stack>

      {/* Payment history */}
      <Paper p="md" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
        <Group justify="space-between" mb="sm">
          <Text fw={700}>Pagos efectuados</Text>
          {prizes.data.latestPaidYear > 0 && (
            <Box
              style={{
                padding: '2px 12px',
                borderRadius: 14,
                background: 'linear-gradient(135deg, #059669, #10B981)',
                color: '#fff',
                fontFamily: 'var(--mantine-font-family-monospace)',
                fontWeight: 700,
                fontSize: '12px',
              }}
            >
              Último año pagado: {prizes.data.latestPaidYear}
            </Box>
          )}
        </Group>
        {prizes.data.payments.length === 0 ? (
          <EmptyState
            icon={IconMedal}
            title="Sin premios repartidos aún"
            description="Cuando se cierre una competición con bolsa de premios verás aquí los pagos."
          />
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                {(['Año', 'Competición', 'Pos.', 'Equipo', 'Premio'] as const).map((h, i) => (
                  <Table.Th
                    key={h}
                    ta={i === 2 || i === 4 ? 'right' : undefined}
                    style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                  >
                    {h}
                  </Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {[...prizes.data.payments]
                .sort((a, b) => b.year - a.year || a.competitionLabel.localeCompare(b.competitionLabel) || a.position - b.position)
                .map((p, i) => (
                  <Table.Tr
                    key={`${p.year}-${p.competitionLabel}-${p.position}-${i}`}
                    className="stagger-item"
                    style={{
                      borderLeft: `3px solid ${MEDAL_COLORS[p.position - 1] ?? 'transparent'}`,
                      background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                      animationDelay: `${i * 50}ms`,
                    }}
                  >
                    <Table.Td>
                      <Text style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>{p.year}</Text>
                    </Table.Td>
                    <Table.Td fw={500}>{p.competitionLabel}</Table.Td>
                    <Table.Td ta="right">
                      <Text fw={700} style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: MEDAL_COLORS[p.position - 1] ?? '#F9FAFB' }}>
                        {p.position}º
                      </Text>
                    </Table.Td>
                    <Table.Td fw={600}>{p.teamName}</Table.Td>
                    <Table.Td ta="right">
                      <Text fw={700} style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: '#10B981' }}>
                        {money(p.amount)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </div>
  );
}
