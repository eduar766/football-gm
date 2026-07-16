import {
  Badge,
  Box,
  Button,
  Card,
  Grid,
  Group,
  Paper,
  RingProgress,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Tabs,
  Text,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import {
  IconBuildingStadium,
  IconChartBar,
  IconCoin,
  IconCrown,
  IconHeart,
  IconShieldHalf,
  IconStar,
  IconTrophy,
  IconTrophyOff,
  IconUsers,
  IconBolt,
  IconReportMoney,
  IconAlertTriangle,
} from '@tabler/icons-react';
import type { TeamDetail } from '@football-gm/contracts';
import { api } from '../api';
import { useMutationWithFeedback } from '../useMutationWithFeedback';
import { QK } from '../query-keys';
import { money as fmtMoney } from '../utils/format';

interface PlayerWithAge {
  age?: number;
}

const num = (n: number) => n.toLocaleString('es-ES');

const POS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  POR: { bg: '#FCD34D', text: '#78350F', label: 'POR' },
  DEF: { bg: '#60A5FA', text: '#1E3A5F', label: 'DEF' },
  MED: { bg: '#34D399', text: '#064E3B', label: 'MED' },
  DEL: { bg: '#F87171', text: '#7F1D1D', label: 'DEL' },
};

function strengthColor(v: number) {
  if (v >= 70) return '#10B981';
  if (v >= 50) return '#F59E0B';
  return '#EF4444';
}

function strengthBg(v: number) {
  if (v >= 70) return 'rgba(16,185,129,0.1)';
  if (v >= 50) return 'rgba(245,158,11,0.1)';
  return 'rgba(239,68,68,0.1)';
}

/* ── Squad Table ──────────────────────────────────────────────────────── */

function SquadTable({ squad }: { squad: TeamDetail['squad'] }) {
  const grouped = ['POR', 'DEF', 'MED', 'DEL'].flatMap((pos) =>
    squad.filter((p) => p.posicion.slice(0, 3).toUpperCase() === pos)
  );
  const rest = squad.filter(
    (p) => !['POR', 'DEF', 'MED', 'DEL'].includes(p.posicion.slice(0, 3).toUpperCase())
  );
  const ordered = [...grouped, ...rest];

  return (
    <Table highlightOnHover verticalSpacing={6}>
      <Table.Thead>
        <Table.Tr>
          <Table.Th style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', width: 52 }}>Pos</Table.Th>
          <Table.Th style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Jugador</Table.Th>
          <Table.Th style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', width: 44 }} ta="center">Edad</Table.Th>
          <Table.Th style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', width: 90 }} ta="right">Calidad</Table.Th>
          <Table.Th style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', width: 90 }} ta="center">Estado</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {ordered.map((p, i) => {
          const posKey = p.posicion.slice(0, 3).toUpperCase();
          const posCol = POS_COLORS[posKey] ?? { bg: '#6B7280', text: '#F9FAFB', label: posKey };
          const qColor = p.calidad >= 70 ? '#10B981' : p.calidad >= 50 ? '#F59E0B' : '#EF4444';
          const age = (p as unknown as PlayerWithAge).age;
          const ageColor = age == null ? undefined : age < 27 ? '#10B981' : age <= 31 ? '#F59E0B' : '#EF4444';

          return (
            <Table.Tr
              key={p.id}
              className="stagger-item"
              style={{ animationDelay: `${i * 20}ms` }}
            >
              <Table.Td>
                <Badge
                  size="xs"
                  variant="filled"
                  style={{ backgroundColor: posCol.bg, color: posCol.text, fontWeight: 700, minWidth: 36, textAlign: 'center' }}
                >
                  {posKey}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Group gap="xs" wrap="nowrap">
                  <Text size="sm" fw={p.calidad >= 70 ? 600 : 400}>{p.name}</Text>
                  {p.cantera && (
                    <Box
                      style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: '#8B5CF6', flexShrink: 0,
                      }}
                      title="Cantera"
                    />
                  )}
                </Group>
              </Table.Td>
              <Table.Td ta="center">
                {age != null ? (
                  <Text size="sm" fw={600} style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: ageColor }}>
                    {age}
                  </Text>
                ) : (
                  <Text c="dimmed" size="sm">—</Text>
                )}
              </Table.Td>
              <Table.Td ta="right">
                <Group gap={6} justify="flex-end" wrap="nowrap">
                  <Text fw={700} size="sm" style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: qColor, minWidth: 22 }}>
                    {p.calidad}
                  </Text>
                  <Box style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', flexShrink: 0 }}>
                    <Box style={{ width: `${p.calidad}%`, height: '100%', borderRadius: 2, backgroundColor: qColor }} />
                  </Box>
                </Group>
              </Table.Td>
              <Table.Td ta="center">
                {p.injuredMatchesLeft > 0 ? (
                  <Badge size="xs" color="red" variant="light">Lesión ×{p.injuredMatchesLeft}</Badge>
                ) : p.matchesSuspendedLeft > 0 ? (
                  <Badge size="xs" color="orange" variant="light">Sanción ×{p.matchesSuspendedLeft}</Badge>
                ) : (p.yellowCardsThisSeason > 0 || p.redCardsThisSeason > 0) ? (
                  <Group gap={4} justify="center" wrap="nowrap">
                    {p.yellowCardsThisSeason > 0 && (
                      <Group gap={2} wrap="nowrap">
                        <Box style={{ width: 8, height: 10, background: '#FBBF24', borderRadius: 1 }} />
                        <Text size="xs" c="dimmed">{p.yellowCardsThisSeason}</Text>
                      </Group>
                    )}
                    {p.redCardsThisSeason > 0 && (
                      <Group gap={2} wrap="nowrap">
                        <Box style={{ width: 8, height: 10, background: '#EF4444', borderRadius: 1 }} />
                        <Text size="xs" c="dimmed">{p.redCardsThisSeason}</Text>
                      </Group>
                    )}
                  </Group>
                ) : null}
              </Table.Td>
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}

/* ── Position breakdown mini bar ─────────────────────────────────────── */

function PositionBreakdown({ squad }: { squad: TeamDetail['squad'] }) {
  const counts = { POR: 0, DEF: 0, MED: 0, DEL: 0 };
  for (const p of squad) {
    const k = p.posicion.slice(0, 3).toUpperCase() as keyof typeof counts;
    if (k in counts) counts[k]++;
  }
  const total = squad.length;
  if (total === 0) return null;

  return (
    <Group gap="lg" mb="xs">
      {(Object.entries(counts) as [keyof typeof counts, number][])
        .filter(([, v]) => v > 0)
        .map(([pos, count]) => {
          const col = POS_COLORS[pos];
          return (
            <Group key={pos} gap={4}>
              <Box style={{ width: 8, height: 8, borderRadius: 2, background: col.bg }} />
              <Text size="xs" c="dimmed">{count} {pos}</Text>
            </Group>
          );
        })}
    </Group>
  );
}

/* ── Trajectory section ───────────────────────────────────────────────── */

function TrajectorySection({ trajectory }: { trajectory: TeamDetail['trajectory'] }) {
  if (trajectory.length === 0) {
    return <Text c="dimmed" size="sm">Sin temporadas cerradas todavía.</Text>;
  }

  const best = Math.min(...trajectory.map((r) => r.puestoFinal));

  return (
    <>
      <Group gap="xl" mb="md">
        <Box>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: '0.05em' }}>Temporadas</Text>
          <Text fw={800} size="xl" style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>{trajectory.length}</Text>
        </Box>
        <Box>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: '0.05em' }}>Mejor puesto</Text>
          <Text fw={800} size="xl" style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: '#10B981' }}>{best}º</Text>
        </Box>
      </Group>

      <Table highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Año</Table.Th>
            <Table.Th style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>División</Table.Th>
            <Table.Th style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Puesto</Table.Th>
            <Table.Th style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Δ</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {trajectory.map((r, i) => {
            const prev = i < trajectory.length - 1 ? trajectory[i + 1] : null;
            let delta: number | null = null;
            if (prev) delta = prev.puestoFinal - r.puestoFinal; // positive = improved
            const isChamp = r.puestoFinal === 1;

            return (
              <Table.Tr
                key={r.anio}
                className="stagger-item"
                style={{
                  animationDelay: `${i * 50}ms`,
                  background: isChamp ? 'rgba(245,158,11,0.04)' : undefined,
                  borderLeft: isChamp ? '2px solid rgba(245,158,11,0.4)' : '2px solid transparent',
                }}
              >
                <Table.Td fw={700} style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>{r.anio}</Table.Td>
                <Table.Td c="dimmed">{r.divisionOrden != null ? `Div. ${r.divisionOrden}` : '—'}</Table.Td>
                <Table.Td ta="right">
                  <Group gap={4} justify="flex-end">
                    {isChamp && <IconTrophy size={12} color="#F59E0B" />}
                    <Text fw={700} style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: isChamp ? '#F59E0B' : undefined }}>
                      {r.puestoFinal}º
                    </Text>
                  </Group>
                </Table.Td>
                <Table.Td ta="right">
                  {delta != null && delta !== 0 ? (
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
    </>
  );
}

/* ── Palmarés section ─────────────────────────────────────────────────── */

function PalmaresSection({ palmares }: { palmares: TeamDetail['palmares'] }) {
  if (palmares.length === 0) {
    return (
      <Group gap="sm" mt="xs">
        <IconTrophyOff size={16} color="rgba(255,255,255,0.2)" />
        <Text c="dimmed" size="sm">Sin títulos aún.</Text>
      </Group>
    );
  }

  return (
    <SimpleGrid cols={2} spacing="sm">
      {palmares.map((p, i) => (
        <Paper
          key={`${p.competition}-${p.isYouth ? 'j' : 'a'}`}
          p="sm"
          radius="sm"
          className="stagger-item"
          style={{
            background: p.isYouth ? 'rgba(139,92,246,0.06)' : 'rgba(245,158,11,0.06)',
            border: `1px solid ${p.isYouth ? 'rgba(139,92,246,0.2)' : 'rgba(245,158,11,0.2)'}`,
            animationDelay: `${i * 50}ms`,
          }}
        >
          <Group gap="sm" wrap="nowrap">
            <Box
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: p.isYouth ? 'rgba(139,92,246,0.15)' : 'rgba(245,158,11,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              <IconTrophy size={14} color={p.isYouth ? '#8B5CF6' : '#F59E0B'} />
            </Box>
            <Box style={{ minWidth: 0, flex: 1 }}>
              <Text
                size="xs" fw={600}
                style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#F9FAFB' }}
              >
                {p.competition}
              </Text>
              <Group gap={4}>
                <Text fw={800} size="sm" style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: p.isYouth ? '#8B5CF6' : '#F59E0B' }}>
                  {p.count}
                </Text>
                <Text size="xs" c="dimmed">{p.count === 1 ? 'título' : 'títulos'}</Text>
              </Group>
            </Box>
          </Group>
        </Paper>
      ))}
    </SimpleGrid>
  );
}

/* ── Club Structure ───────────────────────────────────────────────────── */

function ClubStructure({ t }: { t: TeamDetail }) {
  const ratings = [
    { label: 'Cantera', value: t.academiaRating, icon: IconUsers, color: '#8B5CF6' },
    { label: 'Cuerpo médico', value: t.medicoRating, icon: IconHeart, color: '#EF4444' },
    { label: 'Ojeadores', value: t.ojeadoresRating, icon: IconStar, color: '#F59E0B' },
    { label: 'Cuerpo técnico', value: t.cuerpoTecnicoRating, icon: IconChartBar, color: '#10B981' },
  ];

  return (
    <SimpleGrid cols={2} spacing="sm">
      {ratings.map((s, i) => {
        const col = s.value >= 70 ? '#10B981' : s.value >= 50 ? '#F59E0B' : '#EF4444';
        return (
          <Paper
            key={s.label}
            p="sm"
            className="stagger-item"
            style={{
              background: `${s.color}08`,
              border: `1px solid ${s.color}22`,
              borderRadius: 10,
              animationDelay: `${i * 50}ms`,
            }}
          >
            <Group gap="sm" mb="xs">
              <Box
                style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: `${s.color}20`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                <s.icon size={14} color={s.color} />
              </Box>
              <Text size="xs" fw={600} c="dimmed">{s.label}</Text>
            </Group>
            <Text fw={800} size="xl" style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: col, lineHeight: 1 }}>
              {s.value}
            </Text>
            <Box mt={6} style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <Box style={{ width: `${s.value}%`, height: '100%', borderRadius: 2, backgroundColor: col, transition: 'width 0.4s ease' }} />
            </Box>
          </Paper>
        );
      })}
    </SimpleGrid>
  );
}

/* ── Finanzas Tab ────────────────────────────────────────────────────── */

const HEALTH_COLOR: Record<string, string> = {
  saneada: '#10B981',
  ajustada: '#F59E0B',
  en_riesgo: '#F97316',
  quiebra: '#EF4444',
};
const HEALTH_LABEL: Record<string, string> = {
  saneada: 'Saneada',
  ajustada: 'Ajustada',
  en_riesgo: 'En riesgo',
  quiebra: 'Quiebra',
};

function FinanzasTab({ finance }: { finance: NonNullable<TeamDetail['finance']> }) {
  const hc = HEALTH_COLOR[finance.financialHealth] ?? '#6B7280';
  const eco = finance.lastEconomy;

  return (
    <Stack gap="md">
      {/* Header: treasury + health */}
      <Paper p="md" style={{ border: `1px solid ${hc}33`, background: `${hc}08`, borderLeft: `3px solid ${hc}` }}>
        <Group justify="space-between" wrap="nowrap">
          <Box>
            <Text size="xs" c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: '0.05em' }}>Tesorería</Text>
            <Text fw={800} size="xl" style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: hc }}>
              {fmtMoney(finance.treasury)}
            </Text>
          </Box>
          <Box ta="right">
            <Badge color={finance.financialHealth === 'quiebra' ? 'red' : finance.financialHealth === 'en_riesgo' ? 'orange' : finance.financialHealth === 'ajustada' ? 'yellow' : 'teal'} variant="light" size="lg">
              {HEALTH_LABEL[finance.financialHealth]}
            </Badge>
            {finance.prizesWithheld && (
              <Group gap={4} mt={4} justify="flex-end">
                <IconAlertTriangle size={12} color="#F59E0B" />
                <Text size="xs" c="yellow">Premios retenidos</Text>
              </Group>
            )}
          </Box>
        </Group>
      </Paper>

      {/* Last season P&L */}
      {eco && (
        <Paper p="md" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          <Text fw={700} mb="md">P&L — Temporada {eco.year}</Text>
          <Stack gap={4}>
            {[
              { label: 'Taquilla', value: eco.gateReceipts, positive: true },
              { label: 'Patrocinadores', value: eco.sponsorIncome, positive: true },
              { label: 'Premios', value: eco.prizeIncome, positive: true },
              { label: 'Fichajes (ventas)', value: eco.transferIncome, positive: true },
              { label: 'Salarios', value: -eco.wageExpenses, positive: false },
              { label: 'Fichajes (compras)', value: -eco.transferExpenses, positive: false },
              { label: 'Infraestructura', value: -eco.infrastructureExpenses, positive: false },
            ].map(({ label, value }) => (
              <Group key={label} justify="space-between" py={4} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <Text size="sm" c="dimmed">{label}</Text>
                <Text size="sm" fw={600} style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: value > 0 ? '#10B981' : value < 0 ? '#EF4444' : 'rgba(255,255,255,0.5)' }}>
                  {value >= 0 ? '+' : ''}{fmtMoney(value)}
                </Text>
              </Group>
            ))}
            <Group justify="space-between" pt={6}>
              <Text size="sm" fw={700}>Resultado neto</Text>
              <Text size="sm" fw={800} style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: eco.net >= 0 ? '#10B981' : '#EF4444' }}>
                {eco.net >= 0 ? '+' : ''}{fmtMoney(eco.net)}
              </Text>
            </Group>
          </Stack>
        </Paper>
      )}

      {/* Sponsors */}
      <Paper p="md" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
        <Text fw={700} mb="sm">Patrocinadores activos</Text>
        {finance.sponsors.length === 0 ? (
          <Text c="dimmed" size="sm">Sin patrocinadores.</Text>
        ) : (
          <Stack gap={4}>
            {finance.sponsors.map((sp) => (
              <Group key={sp.id} justify="space-between" py={4} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <Box>
                  <Text size="sm" fw={600}>{sp.name}</Text>
                  <Text size="xs" c="dimmed">{sp.yearsLeft} {sp.yearsLeft === 1 ? 'año' : 'años'} restantes</Text>
                </Box>
                <Text size="sm" fw={700} style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: '#10B981' }}>
                  +{fmtMoney(sp.valorAnual)}/año
                </Text>
              </Group>
            ))}
          </Stack>
        )}
      </Paper>
    </Stack>
  );
}

/* ── Presidencia (Fase 17A) ──────────────────────────────────────────── */

const PRESIDENT_TRAIT_LABEL: Record<string, string> = {
  leal: 'Leal',
  ambicioso: 'Ambicioso',
  tradicionalista: 'Tradicionalista',
  mercenario: 'Mercenario',
  institucional: 'Institucional',
};

function PresidentBlock({ president }: { president: NonNullable<TeamDetail['president']> }) {
  return (
    <Box mt="xl">
      <Group gap="xs" mb="xs">
        <IconCrown size={13} color="#F59E0B" />
        <Text size="xs" fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.05em' }}>Presidencia</Text>
      </Group>
      <Box
        style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)' }}
      >
        <Group justify="space-between" wrap="nowrap">
          <Text size="sm" fw={600}>{president.name}</Text>
          <Badge size="xs" variant="light" color="yellow">{PRESIDENT_TRAIT_LABEL[president.trait] ?? president.trait}</Badge>
        </Group>
        <Text size="xs" c="dimmed" mt={2}>Presidente desde {president.sinceYear}</Text>
      </Box>
    </Box>
  );
}

/* ── Main page ────────────────────────────────────────────────────────── */

/* ── Rival team view (P1): rivals have no persisted squad/finance, so show
      their league standing, titles and top scorers instead of empty panels ── */
function RivalPanels({ t }: { t: TeamDetail }) {
  const r = t.rival;
  return (
    <Stack gap="md">
      <Paper p="md" style={{ border: '1px solid rgba(59,130,246,0.25)', borderLeft: '3px solid #3B82F6', background: 'rgba(59,130,246,0.04)' }}>
        <Group gap="xs">
          <IconShieldHalf size={16} color="#3B82F6" />
          <Text fw={700}>Equipo rival</Text>
          <Badge size="xs" variant="light" color="blue">No gestionable</Badge>
        </Group>
        <Text size="sm" c="dimmed" mt={4}>
          Este club pertenece a otra federación. Solo puedes gestionar los equipos de tu liga.
        </Text>
      </Paper>

      <Paper p="md" style={{ border: '1px solid rgba(255,255,255,0.06)', borderLeft: '3px solid #10B981' }}>
        <Group gap="sm" mb="md">
          <IconChartBar size={16} color="#10B981" />
          <Text fw={700}>Clasificación actual</Text>
        </Group>
        {r && r.position != null ? (
          <Group gap="xl">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>Posición</Text>
              <Text fw={800} size="xl" style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>{r.position}º</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>Jugados</Text>
              <Text fw={700} size="xl" style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>{r.played}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>Puntos</Text>
              <Text fw={800} size="xl" style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: '#10B981' }}>{r.points}</Text>
            </div>
            {r.divisionName && (
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>División</Text>
                <Text fw={600} size="md">{r.divisionName}</Text>
              </div>
            )}
          </Group>
        ) : (
          <Text size="sm" c="dimmed">La temporada rival aún no ha comenzado.</Text>
        )}
      </Paper>

      <Paper p="md" style={{ border: '1px solid rgba(255,255,255,0.06)', borderLeft: '3px solid #F59E0B' }}>
        <Group gap="sm" mb="md">
          <IconTrophy size={16} color="#F59E0B" />
          <Text fw={700}>Palmarés</Text>
          {r && r.titles.length > 0 && (
            <Badge size="xs" color="yellow" variant="light">{r.titles.length} título{r.titles.length !== 1 ? 's' : ''}</Badge>
          )}
        </Group>
        {r && r.titles.length > 0 ? (
          <Group gap="xs">
            {r.titles.map((y) => (
              <Badge key={y} variant="light" color="yellow" leftSection={<IconTrophy size={10} />}>Año {y}</Badge>
            ))}
          </Group>
        ) : (
          <Text size="sm" c="dimmed">Sin títulos de liga aún.</Text>
        )}
      </Paper>

      <Paper p="md" style={{ border: '1px solid rgba(255,255,255,0.06)', borderLeft: '3px solid #8B5CF6' }}>
        <Group gap="sm" mb="md">
          <IconStar size={16} color="#8B5CF6" />
          <Text fw={700}>Máximos goleadores</Text>
        </Group>
        {r && r.topScorers.length > 0 ? (
          <Stack gap={4}>
            {r.topScorers.map((p, i) => (
              <Group key={i} justify="space-between">
                <Text size="sm">{p.name}</Text>
                <Badge variant="light" color="grape">{p.goals} gol{p.goals !== 1 ? 'es' : ''}</Badge>
              </Group>
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">Sin datos de goleadores esta temporada.</Text>
        )}
      </Paper>
    </Stack>
  );
}

export function TeamDetailPage() {
  const { gameId, teamId } = useParams({ strict: false }) as { gameId: string; teamId: string };
  const id = Number(gameId);
  const tid = Number(teamId);

  const team = useQuery({ queryKey: QK.team(id, tid), queryFn: () => api.team(id, tid) });
  const summary = useQuery({ queryKey: QK.summary(id), queryFn: () => api.summary(id) });

  const cultivate = useMutationWithFeedback({
    mutationFn: () => api.cultivateArraigo(id, tid),
    queryKeyToInvalidate: ['team', 'summary'],
    successMessage: 'Arraigo cultivado correctamente',
  });

  if (team.isLoading || !team.data) {
    return (
      <Grid>
        <Grid.Col span={{ base: 12, md: 4 }}><Skeleton height={400} radius="md" /></Grid.Col>
        <Grid.Col span={{ base: 12, md: 8 }}><Skeleton height={400} radius="md" /></Grid.Col>
      </Grid>
    );
  }

  const t = team.data;
  const isRival = !t.isPlayerTeam;

  const statRows = isRival
    ? [
        { icon: IconBolt, label: 'Fuerza', value: String(t.strength), color: '#10B981', bar: t.strength },
        { icon: IconTrophy, label: 'Prestigio', value: String(t.prestige), color: '#F59E0B', bar: Math.min(t.prestige * 5, 100) },
        ...(t.rival?.position != null
          ? [{ icon: IconChartBar, label: 'Posición', value: `${t.rival.position}º · ${t.rival.points} pts`, color: '#3B82F6', bar: null }]
          : []),
        { icon: IconTrophy, label: 'Títulos', value: String(t.rival?.titles.length ?? 0), color: '#F59E0B', bar: null },
      ]
    : [
        { icon: IconBolt, label: 'Fuerza', value: String(t.strength), color: '#10B981', bar: t.strength },
        { icon: IconTrophy, label: 'Prestigio', value: String(t.prestige), color: '#F59E0B', bar: Math.min(t.prestige * 5, 100) },
        { icon: IconShieldHalf, label: 'Arraigo', value: String(t.arraigo), color: '#3B82F6', bar: t.arraigo },
        { icon: IconCoin, label: 'Presupuesto', value: fmtMoney(t.presupuesto), color: '#059669', bar: null },
        { icon: IconUsers, label: 'Afición', value: num(t.aficion), color: '#8B5CF6', bar: null },
        { icon: IconBuildingStadium, label: 'Estadio', value: `${t.estadioNombre ?? '—'} (${num(t.estadioAforo ?? 0)})`, color: '#F97316', bar: null },
      ];

  return (
    <Grid className="page-enter" gutter="md">
      {/* ── Left: Hero card ── */}
      <Grid.Col span={{ base: 12, md: 4 }}>
        <Card
          p="lg"
          radius="lg"
          style={{
            background:
              'linear-gradient(160deg, var(--surface-1) 0%, #0c141a 60%, #0b1512 100%)',
            border: '1px solid var(--border-1)',
            boxShadow: 'var(--panel-shadow)',
            position: 'sticky',
            top: 16,
          }}
        >
          {/* Name + federation badges */}
          <Group gap="xs" mb={4}>
            <IconTrophy size={18} color="#F59E0B" style={{ flexShrink: 0 }} />
            <Text
              style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '22px', color: '#F4F7FA', lineHeight: 1.15 }}
            >
              {t.name}
            </Text>
          </Group>
          <Group gap="xs" mb="xl">
            <Badge size="xs" variant="light" color="blue">{t.federationName ?? 'Sin federación'}</Badge>
            <Badge size="xs" variant="light" color="gray">{t.divisionName ?? 'Sin división'}</Badge>
          </Group>

          {/* Strength ring */}
          <Group align="center" gap="md" mb="xl">
            <RingProgress
              size={80}
              thickness={7}
              roundCaps
              sections={[{ value: t.strength, color: strengthColor(t.strength) }]}
              label={
                <Text fw={800} ta="center" style={{ fontFamily: 'var(--mantine-font-family-monospace)', fontSize: '18px', color: strengthColor(t.strength) }}>
                  {t.strength}
                </Text>
              }
            />
            <Box>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: '0.05em' }}>Fuerza</Text>
              <Text size="sm" c="dimmed">Rating general</Text>
              <Box
                mt={4}
                style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: strengthBg(t.strength),
                  border: `1px solid ${strengthColor(t.strength)}33`,
                }}
              >
                <Text size="xs" fw={700} style={{ color: strengthColor(t.strength) }}>
                  {t.strength >= 70 ? 'Alto' : t.strength >= 50 ? 'Medio' : 'Bajo'}
                </Text>
              </Box>
            </Box>
          </Group>

          {/* Stat rows */}
          <Stack gap={6}>
            {statRows.map((s) => (
              <Box
                key={s.label}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: `${s.color}08`,
                  border: `1px solid ${s.color}18`,
                }}
              >
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="xs" wrap="nowrap">
                    <s.icon size={13} color={s.color} style={{ flexShrink: 0 }} />
                    <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>{s.label}</Text>
                  </Group>
                  <Text
                    fw={700}
                    size="sm"
                    style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: '#F9FAFB', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}
                  >
                    {s.value}
                  </Text>
                </Group>
                {s.bar != null && (
                  <Box mt={5} style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <Box style={{ width: `${s.bar}%`, height: '100%', borderRadius: 2, backgroundColor: s.color, transition: 'width 0.4s ease' }} />
                  </Box>
                )}
              </Box>
            ))}
          </Stack>

          {!isRival && summary.data?.phase === 'pretemporada' && (
            <Button
              mt="md"
              fullWidth
              size="compact-sm"
              variant="light"
              color="blue"
              leftSection={<IconHeart size={14} />}
              loading={cultivate.isPending}
              onClick={() => cultivate.mutate(undefined as void)}
            >
              Cultivar arraigo (2M€, +5–10)
            </Button>
          )}

          {/* Rivalries inline */}
          {t.rivalries && t.rivalries.length > 0 && (
            <Box mt="lg">
              <Group gap="xs" mb="xs">
                <IconHeart size={13} color="#EF4444" />
                <Text size="xs" fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.05em' }}>Rivalidades</Text>
              </Group>
              <Stack gap={4}>
                {t.rivalries.map((r) => {
                  const rival = r.teamBName;
                  const { wins, draws, losses } = r.headToHead;
                  return (
                    <Box
                      key={`${r.teamAId}-${r.teamBId}`}
                      style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.12)' }}
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <div>
                          <Text size="xs" fw={600}>{rival}</Text>
                          <Text size="xs" c="dimmed">{r.seasons} {r.seasons === 1 ? 'temporada' : 'temporadas'}</Text>
                        </div>
                        <Group gap={3} wrap="nowrap">
                          <Badge size="xs" color="green" variant="filled" style={{ minWidth: 26 }}>{wins}V</Badge>
                          <Badge size="xs" color="gray" variant="filled" style={{ minWidth: 26 }}>{draws}E</Badge>
                          <Badge size="xs" color="red" variant="filled" style={{ minWidth: 26 }}>{losses}D</Badge>
                        </Group>
                      </Group>
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          )}

          {/* Presidency (Fase 17A) — player teams only */}
          {t.president && <PresidentBlock president={t.president} />}
        </Card>
      </Grid.Col>

      {/* ── Right: Tabbed content (rivals get an adapted read-only view) ── */}
      <Grid.Col span={{ base: 12, md: 8 }}>
        {isRival ? (
          <RivalPanels t={t} />
        ) : (
        <Tabs defaultValue="plantilla" variant="pills" radius="md">
          <Tabs.List
            mb="md"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 10,
              padding: 4,
            }}
          >
            <Tabs.Tab value="plantilla" leftSection={<IconUsers size={14} />} style={{ fontWeight: 600 }}>
              Plantilla
              <Badge size="xs" ml={6} color="gray" variant="light">{t.squad.length}</Badge>
            </Tabs.Tab>
            <Tabs.Tab value="historial" leftSection={<IconChartBar size={14} />} style={{ fontWeight: 600 }}>
              Historial
            </Tabs.Tab>
            <Tabs.Tab value="club" leftSection={<IconBuildingStadium size={14} />} style={{ fontWeight: 600 }}>
              Club
            </Tabs.Tab>
            {t.finance && (
              <Tabs.Tab value="finanzas" leftSection={<IconReportMoney size={14} />} style={{ fontWeight: 600 }}>
                Finanzas
                {t.finance.financialHealth === 'quiebra' && (
                  <Box component="span" ml={4} style={{ color: '#EF4444', fontSize: 10 }}>●</Box>
                )}
              </Tabs.Tab>
            )}
          </Tabs.List>

          {/* ── Plantilla ── */}
          <Tabs.Panel value="plantilla">
            <Paper p="md" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
              <Group justify="space-between" mb="xs">
                <Text fw={700}>Plantilla</Text>
                <Text size="xs" c="dimmed">{t.squad.length} jugadores</Text>
              </Group>
              <PositionBreakdown squad={t.squad} />
              <SquadTable squad={t.squad} />
            </Paper>
          </Tabs.Panel>

          {/* ── Historial ── */}
          <Tabs.Panel value="historial">
            <Stack gap="md">
              <Paper p="md" style={{ border: '1px solid rgba(255,255,255,0.06)', borderLeft: '3px solid #10B981' }}>
                <Text fw={700} mb="md">Trayectoria</Text>
                <TrajectorySection trajectory={t.trajectory} />
              </Paper>

              <Paper p="md" style={{ border: '1px solid rgba(255,255,255,0.06)', borderLeft: '3px solid #F59E0B' }}>
                <Group gap="sm" mb="md">
                  <IconTrophy size={16} color="#F59E0B" />
                  <Text fw={700}>Palmarés</Text>
                  {t.palmares.length > 0 && (
                    <Badge size="xs" color="yellow" variant="light">{t.palmares.reduce((acc, p) => acc + p.count, 0)} título{t.palmares.reduce((acc, p) => acc + p.count, 0) !== 1 ? 's' : ''}</Badge>
                  )}
                </Group>
                <PalmaresSection palmares={t.palmares} />
              </Paper>

              {/* Requirements & Compliance */}
              {(t.requirements.breaches.length > 0 || t.requirements.sanctions.length > 0) && (
                <Paper p="md" style={{ border: '1px solid rgba(239,68,68,0.3)', borderLeft: '3px solid #EF4444', background: 'rgba(239,68,68,0.03)' }}>
                  <Text fw={700} mb="sm">Requisitos y normas</Text>
                  {t.requirements.breaches.length > 0 && (
                    <Stack gap={4} mb="sm">
                      <Text size="xs" fw={600} c="red" tt="uppercase" style={{ letterSpacing: '0.04em' }}>Incumplimientos activos</Text>
                      {t.requirements.breaches.map((b) => (
                        <Group key={b.normId} gap="xs">
                          <Box style={{ width: 6, height: 6, borderRadius: '50%', background: b.sanctioned ? '#EF4444' : '#F59E0B', flexShrink: 0 }} />
                          <Text size="xs">
                            {b.tipo === 'tope_plantilla' && `Fuerza ${b.valorActual} supera tope de ${b.valor}`}
                            {b.tipo === 'minimo_competitivo' && `Fuerza ${b.valorActual} por debajo del mínimo de ${b.valor}`}
                            {b.tipo === 'tope_salarial' && `Masa salarial supera el tope`}
                          </Text>
                          {b.sanctioned && <Badge size="xs" color="red" variant="light">Sancionado</Badge>}
                        </Group>
                      ))}
                    </Stack>
                  )}
                  {t.requirements.sanctions.length > 0 && (
                    <Stack gap={4}>
                      <Text size="xs" fw={600} c="red" tt="uppercase" style={{ letterSpacing: '0.04em' }}>Sanciones</Text>
                      {t.requirements.sanctions.map((sa, i) => (
                        <Group key={i} gap="xs">
                          <Text size="xs" c="dimmed" style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>Año {sa.year}</Text>
                          <Text size="xs">{sa.motivo}</Text>
                          <Badge size="xs" color="red" variant="light">{sa.castigo}</Badge>
                        </Group>
                      ))}
                    </Stack>
                  )}
                </Paper>
              )}
            </Stack>
          </Tabs.Panel>

          {/* ── Club ── */}
          <Tabs.Panel value="club">
            <Paper p="md" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
              <Text fw={700} mb="md">Estructura del club</Text>
              <ClubStructure t={t} />
            </Paper>
          </Tabs.Panel>

          {/* ── Finanzas ── */}
          {t.finance && (
            <Tabs.Panel value="finanzas">
              <FinanzasTab finance={t.finance} />
            </Tabs.Panel>
          )}
        </Tabs>
        )}
      </Grid.Col>
    </Grid>
  );
}
