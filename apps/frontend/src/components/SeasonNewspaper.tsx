import {
  ActionIcon,
  Badge,
  Box,
  Group,
  Modal,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconCircleX,
  IconCoin,
  IconMedal,
  IconNews,
  IconScale,
  IconStar,
  IconTrophy,
  IconWorld,
  IconX,
  type TablerIcon,
} from '@tabler/icons-react';
import type { FeaturedTagDto, SeasonReportDto } from '@football-gm/contracts';
import { AWARD_LABEL, AWARD_ICON, CUP_TIPO_LABEL, FED_LOG_STYLE, ERA_NAME } from '../domain-labels';

const FEATURED_TAG_LABEL: Record<FeaturedTagDto, string> = {
  derbi: 'Derbi',
  titulo: 'Duelo por el título',
  goleada: 'Goleada',
  remontada: 'Remontada',
  hat_trick: 'Hat-trick',
};

interface Props {
  report: SeasonReportDto | null;
  federationName: string;
  opened: boolean;
  onClose: () => void;
}

export function SeasonNewspaper({ report, federationName, opened, onClose }: Props) {
  if (!report) return null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      fullScreen
      withCloseButton={false}
      padding={0}
      transitionProps={{ transition: 'fade', duration: 200 }}
      styles={{
        content: { background: 'var(--surface-0)' },
        body: { padding: 0, height: '100%' },
      }}
    >
      <ScrollArea h="100vh" type="auto">
        <Box maw={880} mx="auto" px={{ base: 'md', sm: 'xl' }} py="xl">
          <Masthead federationName={federationName} year={report.year} onClose={onClose} />
          <FrontPage report={report} />
          <SecondaryColumn report={report} />
          <StatusBar report={report} />
          <SportsSection report={report} />
          <RecordsSection report={report} />
          <EconomySection report={report} />
          <WorldSection report={report} />
          <BriefsSection report={report} />
        </Box>
      </ScrollArea>
    </Modal>
  );
}

function SectionTitle({ icon: Icon, color, title }: { icon: TablerIcon; color: string; title: string }) {
  return (
    <Group gap="xs" mb="md">
      <Icon size={16} color={color} />
      <Text
        fw={800}
        tt="uppercase"
        style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.05em', fontSize: 14, color }}
      >
        {title}
      </Text>
    </Group>
  );
}

function Masthead({ federationName, year, onClose }: { federationName: string; year: number; onClose: () => void }) {
  return (
    <Group justify="space-between" align="flex-start" mb="xl" pb="md" style={{ borderBottom: '2px solid var(--border-2)' }}>
      <div>
        <Text component="div" className="hud-eyebrow" mb={4}>
          Edición · Temporada {year}
        </Text>
        <Text
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 38,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
            color: '#F4F7FA',
          }}
        >
          {federationName}
        </Text>
      </div>
      <ActionIcon variant="subtle" color="gray" size="lg" onClick={onClose} aria-label="Cerrar periódico">
        <IconX size={20} />
      </ActionIcon>
    </Group>
  );
}

function FrontPage({ report }: { report: SeasonReportDto }) {
  return (
    <Box className="stagger-item" mb="xl">
      {report.eraCompleted && (
        <Paper
          p="sm"
          mb="md"
          style={{
            border: '1px solid rgba(245,158,11,0.4)',
            borderLeft: '3px solid #F59E0B',
            background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.03))',
          }}
        >
          <Group gap="xs">
            <IconMedal size={20} color="#F59E0B" />
            <Text fw={800} size="sm" tt="uppercase">
              Edición especial — Era completada: {ERA_NAME[report.eraCompleted.era] ?? report.eraCompleted.era}
            </Text>
          </Group>
        </Paper>
      )}
      <Text
        style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, lineHeight: 1.3 }}
        mb="md"
      >
        {report.headline}
      </Text>
      <Paper
        p="lg"
        style={{
          borderLeft: '3px solid #F59E0B',
          background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(245,158,11,0.02))',
        }}
      >
        <Group gap="md">
          <Box
            style={{
              width: 44,
              height: 44,
              flexShrink: 0,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #F59E0B, #D97706)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconTrophy size={22} color="#000" />
          </Box>
          <div>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Campeón</Text>
            <Text fw={800} size="xl">{report.champion.name}</Text>
            <Text className="mono" size="sm" c="dimmed">{report.champion.points} pts</Text>
          </div>
        </Group>
      </Paper>
    </Box>
  );
}

function SecondaryColumn({ report }: { report: SeasonReportDto }) {
  const items: { color: string; icon: TablerIcon; label: string; name: string; detail: string }[] = [];
  if (report.revelation) {
    items.push({ color: '#10B981', icon: IconStar, label: 'Revelación', name: report.revelation.name, detail: report.revelation.reason });
  }
  if (report.disappointment) {
    items.push({ color: '#EF4444', icon: IconAlertTriangle, label: 'Decepción', name: report.disappointment.name, detail: report.disappointment.reason });
  }
  if (report.balanceIndex !== null) {
    items.push({ color: '#8B5CF6', icon: IconScale, label: 'Equilibrio competitivo', name: report.balanceIndex.toFixed(2), detail: 'Índice de la 1ª división' });
  }
  if (items.length === 0) return null;

  return (
    <SimpleGrid cols={{ base: 1, sm: items.length }} spacing="md" className="stagger-item" mb="xl" style={{ animationDelay: '70ms' }}>
      {items.map((it) => (
        <Paper key={it.label} p="md" style={{ borderLeft: `3px solid ${it.color}` }}>
          <Group gap="xs" mb={6}>
            <it.icon size={14} color={it.color} />
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>{it.label}</Text>
          </Group>
          <Text fw={700}>{it.name}</Text>
          <Text size="xs" c="dimmed" mt={2}>{it.detail}</Text>
        </Paper>
      ))}
    </SimpleGrid>
  );
}

function StatTile({ label, before, after, delta, reasons }: { label: string; before: number; after: number; delta: number; reasons?: string[] }) {
  const color = delta > 0 ? '#10B981' : delta < 0 ? '#EF4444' : 'rgba(255,255,255,0.4)';
  return (
    <Box>
      <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb={4}>{label}</Text>
      <Group gap={6} align="baseline">
        <Text className="mono" size="sm" c="dimmed">{before}</Text>
        <Text size="xs" c="dimmed">→</Text>
        <Text className="mono" fw={800} size="lg">{after}</Text>
        <Text className="mono" size="xs" fw={700} style={{ color }}>{delta > 0 ? `+${delta}` : delta}</Text>
      </Group>
      {reasons && reasons.length > 0 && (
        <Stack gap={2} mt={4}>
          {reasons.map((r, i) => (
            <Text key={i} size="xs" c="dimmed">· {r}</Text>
          ))}
        </Stack>
      )}
    </Box>
  );
}

function StatusBar({ report }: { report: SeasonReportDto }) {
  const p = report.prestige;
  const bc = report.boardConfidence;
  return (
    <Paper className="stagger-item" p="md" mb="xl" style={{ animationDelay: '140ms', background: 'rgba(255,255,255,0.02)' }}>
      <Text fw={700} size="sm" mb="md">Estado de la federación</Text>
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
        <StatTile label="Prestigio" before={p.before} after={p.after} delta={p.delta} />
        <StatTile label="Confianza de la junta" before={bc.before} after={bc.after} delta={bc.after - bc.before} reasons={bc.reasons} />
        {report.mandate && (
          <Box>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb={4}>Mandato</Text>
            <Group gap={6}>
              {report.mandate.met ? <IconCircleCheck size={16} color="#10B981" /> : <IconCircleX size={16} color="#EF4444" />}
              <Text fw={600} size="sm">{report.mandate.met ? 'Cumplido' : 'Fallido'}</Text>
            </Group>
            <Text size="xs" c="dimmed" mt={2}>{report.mandate.description}</Text>
          </Box>
        )}
      </SimpleGrid>
      {report.structuralNotes.length > 0 && (
        <Stack gap={4} mt="md" pt="md" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {report.structuralNotes.map((n, i) => (
            <Text key={i} size="xs" c="dimmed">• {n}</Text>
          ))}
        </Stack>
      )}
    </Paper>
  );
}

function FeaturedMatchCard({ match }: { match: NonNullable<SeasonReportDto['featuredMatch']> }) {
  return (
    <Paper
      p="lg"
      style={{
        background: 'linear-gradient(135deg, rgba(16,185,129,0.14), rgba(59,130,246,0.06))',
        border: '1px solid rgba(16,185,129,0.3)',
      }}
    >
      <Group gap={6} mb="sm">
        {match.tags.map((t) => (
          <Badge key={t} size="sm" variant="light" color="teal">{FEATURED_TAG_LABEL[t]}</Badge>
        ))}
      </Group>
      <Group justify="center" gap="xl" mb="md" wrap="nowrap">
        <Text fw={700} ta="right" style={{ flex: 1 }}>{match.homeName}</Text>
        <Text className="mono" fw={900} style={{ fontSize: 28 }}>{match.homeGoals}-{match.awayGoals}</Text>
        <Text fw={700} style={{ flex: 1 }}>{match.awayName}</Text>
      </Group>
      <Text size="sm" c="dimmed" ta="center" mb={match.moments.length > 0 ? 'md' : 0}>{match.narrative}</Text>
      {match.moments.length > 0 && (
        <Stack gap={6} mt="sm" pt="sm" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          {match.moments.map((m, i) => (
            <Group key={i} gap="xs" wrap="nowrap">
              <Text className="mono" size="xs" c="dimmed" style={{ minWidth: 32 }}>{m.minute}'</Text>
              <Text size="xs" fw={600} style={{ flex: 1 }}>{m.playerName ?? '—'}</Text>
              <Text className="mono" size="xs" c="dimmed">{m.runningScore}</Text>
            </Group>
          ))}
        </Stack>
      )}
    </Paper>
  );
}

function AwardsList({ awards }: { awards: SeasonReportDto['awards'] }) {
  return (
    <Stack gap="xs">
      {awards.map((a, i) => (
        <Group key={i} justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <Text size="sm">{AWARD_ICON[a.tipo]}</Text>
            <div>
              <Text size="sm" fw={600}>{a.playerName}</Text>
              <Text size="xs" c="dimmed">{AWARD_LABEL[a.tipo]} · {a.teamName}</Text>
            </div>
          </Group>
          <Text className="mono" fw={700} size="sm" style={{ color: '#F59E0B' }}>{a.valor}</Text>
        </Group>
      ))}
    </Stack>
  );
}

function CupResultsList({ cups }: { cups: SeasonReportDto['cupResults'] }) {
  return (
    <Stack gap="xs">
      {cups.map((c) => (
        <Paper key={c.cupId} p="sm" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)' }}>
          <Group justify="space-between" wrap="nowrap">
            <div>
              <Text size="xs" c="dimmed">{CUP_TIPO_LABEL[c.tipo]}</Text>
              <Text fw={700} size="sm">{c.name}</Text>
            </div>
            <div style={{ textAlign: 'right' }}>
              <Text fw={700} size="sm" style={{ color: '#F59E0B' }}>🏆 {c.championTeamName}</Text>
              {c.runnerUpTeamName && <Text size="xs" c="dimmed">vs {c.runnerUpTeamName}</Text>}
            </div>
          </Group>
        </Paper>
      ))}
    </Stack>
  );
}

function SportsSection({ report }: { report: SeasonReportDto }) {
  if (report.awards.length === 0 && report.cupResults.length === 0 && !report.featuredMatch) return null;
  return (
    <Box className="stagger-item" mb="xl" style={{ animationDelay: '210ms' }}>
      <SectionTitle icon={IconTrophy} color="#F59E0B" title="Deportes" />
      <Stack gap="md">
        {report.featuredMatch && <FeaturedMatchCard match={report.featuredMatch} />}
        {(report.awards.length > 0 || report.cupResults.length > 0) && (
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            {report.awards.length > 0 && (
              <Paper p="md">
                <Text fw={700} size="sm" mb="sm">Galardones</Text>
                <AwardsList awards={report.awards} />
              </Paper>
            )}
            {report.cupResults.length > 0 && (
              <Paper p="md">
                <Text fw={700} size="sm" mb="sm">Copas</Text>
                <CupResultsList cups={report.cupResults} />
              </Paper>
            )}
          </SimpleGrid>
        )}
      </Stack>
    </Box>
  );
}

function RecordsSection({ report }: { report: SeasonReportDto }) {
  if (!report.biggestWinThisSeason && report.allTimeRecordBrokenThisSeason.length === 0) return null;
  return (
    <Box className="stagger-item" mb="xl" style={{ animationDelay: '280ms' }}>
      <SectionTitle icon={IconMedal} color="#8B5CF6" title="Récords" />
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        {report.biggestWinThisSeason && (
          <Paper p="md" style={{ borderLeft: '3px solid #8B5CF6' }}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb={4}>Mayor goleada de la temporada</Text>
            <Text className="mono" fw={800} size="xl" style={{ color: '#8B5CF6' }}>
              {report.biggestWinThisSeason.homeGoals}–{report.biggestWinThisSeason.awayGoals}
            </Text>
            <Text size="sm">{report.biggestWinThisSeason.homeName} vs {report.biggestWinThisSeason.awayName}</Text>
          </Paper>
        )}
        {report.allTimeRecordBrokenThisSeason.length > 0 && (
          <Paper p="md" style={{ borderLeft: '3px solid #8B5CF6', background: 'rgba(139,92,246,0.06)' }}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb={4}>Récords históricos batidos</Text>
            <Stack gap={4}>
              {report.allTimeRecordBrokenThisSeason.map((r, i) => (
                <Text key={i} size="sm" fw={600}>🏅 {r.detail}</Text>
              ))}
            </Stack>
          </Paper>
        )}
      </SimpleGrid>
    </Box>
  );
}

function EconomyRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  const color = value > 0 ? '#10B981' : value < 0 ? '#EF4444' : undefined;
  return (
    <Group justify="space-between">
      <Text size="sm" c="dimmed" fw={bold ? 700 : 400}>{label}</Text>
      <Text className="mono" size="sm" fw={bold ? 800 : 600} style={{ color }}>
        {value > 0 ? '+' : ''}{value.toLocaleString('es-ES')}
      </Text>
    </Group>
  );
}

function EconomySection({ report }: { report: SeasonReportDto }) {
  const e = report.economy;
  if (!e && report.notableTransfers.length === 0) return null;
  return (
    <Box className="stagger-item" mb="xl" style={{ animationDelay: '350ms' }}>
      <SectionTitle icon={IconCoin} color="#10B981" title="Economía" />
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        {e && (
          <Paper p="md">
            <Stack gap={6}>
              <EconomyRow label="Ingresos por taquilla" value={e.matchday} />
              <EconomyRow label="Merchandising" value={e.merchandise} />
              <EconomyRow label="Premios" value={e.prizes} />
              <EconomyRow label="Ingresos por traspasos" value={e.transferIncome} />
              <EconomyRow label="Costes de operación" value={-e.operatingCost} />
              <EconomyRow label="Costes de normativa" value={-e.normCost} />
              <EconomyRow label="Cantera / talento" value={-e.talent} />
              <EconomyRow label="Gasto en traspasos" value={-e.transferFees} />
              <Box pt={6} mt={4} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <EconomyRow label="Balance neto" value={e.net} bold />
              </Box>
              <Text size="xs" c="dimmed" mt={4}>
                Tesorería resultante: <Text span className="mono" fw={700}>{e.treasuryAfter.toLocaleString('es-ES')}</Text>
              </Text>
            </Stack>
          </Paper>
        )}
        {report.notableTransfers.length > 0 && (
          <Paper p="md">
            <Text fw={700} size="sm" mb="sm">Traspasos destacados</Text>
            <Stack gap="xs">
              {report.notableTransfers.map((t) => (
                <Group key={t.playerId} justify="space-between" wrap="nowrap">
                  <div>
                    <Text size="sm" fw={600}>{t.playerName}</Text>
                    <Text size="xs" c="dimmed">{t.fromTeamName} → {t.toTeamName}</Text>
                  </div>
                  <Text className="mono" fw={700} size="sm" style={{ color: '#10B981' }}>
                    {t.transferFee.toLocaleString('es-ES')}
                  </Text>
                </Group>
              ))}
            </Stack>
          </Paper>
        )}
      </SimpleGrid>
    </Box>
  );
}

function WorldSection({ report }: { report: SeasonReportDto }) {
  if (report.worldNews.length === 0 && report.globalRankingTop5.length === 0) return null;
  return (
    <Box className="stagger-item" mb="xl" style={{ animationDelay: '420ms' }}>
      <SectionTitle icon={IconWorld} color="#3B82F6" title="Mundo" />
      {report.globalRankingTop5.length > 0 && (
        <Paper p="md" mb="md">
          <Group justify="space-between" mb="sm">
            <Text fw={700} size="sm">Ranking mundial</Text>
            {report.playerFederationGlobalRank !== null && (
              <Badge size="sm" color="blue" variant="light">Tu federación: #{report.playerFederationGlobalRank}</Badge>
            )}
          </Group>
          <Stack gap={4}>
            {report.globalRankingTop5.map((r) => (
              <Group key={r.federationId} justify="space-between">
                <Text size="sm">#{r.rank} {r.federationName}</Text>
                <Text className="mono" size="xs" c="dimmed">{r.score.toFixed(1)}</Text>
              </Group>
            ))}
          </Stack>
        </Paper>
      )}
      {report.worldNews.length > 0 && (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          {report.worldNews.map((w) => (
            <Paper key={w.federationId} p="md" style={{ borderLeft: '3px solid #3B82F6', background: 'rgba(59,130,246,0.03)' }}>
              <Text fw={700} size="sm" mb={6} style={{ color: '#60A5FA' }}>{w.federationName}</Text>
              <Text size="sm">🏆 {w.championName}{w.runnerUpName ? ` (vs ${w.runnerUpName})` : ''}</Text>
              {w.topScorer && (
                <Text size="xs" c="dimmed" mt={2}>⚽ {w.topScorer.name} — {w.topScorer.goals} goles ({w.topScorer.teamName})</Text>
              )}
              {w.cupWinnerName && <Text size="xs" c="dimmed" mt={2}>🏆 Copa: {w.cupWinnerName}</Text>}
              {(w.promoted.length > 0 || w.relegated.length > 0) && (
                <Group gap="xs" mt={6}>
                  {w.promoted.length > 0 && <Text size="xs" c="teal">↑ {w.promoted.join(', ')}</Text>}
                  {w.relegated.length > 0 && <Text size="xs" c="red">↓ {w.relegated.join(', ')}</Text>}
                </Group>
              )}
            </Paper>
          ))}
        </SimpleGrid>
      )}
    </Box>
  );
}

function BriefsSection({ report }: { report: SeasonReportDto }) {
  if (report.briefs.length === 0) return null;
  return (
    <Box className="stagger-item" style={{ animationDelay: '490ms' }}>
      <SectionTitle icon={IconNews} color="rgba(148,176,205,0.7)" title="Breves" />
      <Stack gap="xs">
        {report.briefs.map((b, i) => {
          const style = FED_LOG_STYLE[b.type];
          return (
            <Group key={i} gap="sm" wrap="nowrap">
              <Text size="sm">{style.emoji}</Text>
              <div>
                <Text size="sm" fw={600}>{b.title}</Text>
                <Text size="xs" c="dimmed">{b.detail}</Text>
              </div>
            </Group>
          );
        })}
      </Stack>
    </Box>
  );
}
