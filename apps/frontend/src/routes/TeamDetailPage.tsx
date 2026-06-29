import {
  Badge,
  Box,
  Button,
  Card,
  Grid,
  Group,
  Paper,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { IconHeart, IconTrophy, IconTrophyOff } from '@tabler/icons-react';
import { api } from '../api';
import { useMutationWithFeedback } from '../useMutationWithFeedback';
import { QK } from '../query-keys';
import { money as fmtMoney } from '../utils/format';

interface PlayerWithAge {
  age?: number;
}

const num = (n: number) => n.toLocaleString('es-ES');

const POS_COLORS: Record<string, { bg: string; text: string }> = {
  POR: { bg: '#FCD34D', text: '#78350F' },
  DEF: { bg: '#60A5FA', text: '#1E3A5F' },
  MID: { bg: '#34D399', text: '#064E3B' },
  DEL: { bg: '#F87171', text: '#7F1D1D' },
};

function strengthColor(v: number) {
  if (v >= 70) return '#10B981';
  if (v >= 50) return '#F59E0B';
  return '#EF4444';
}

function ratingColor(v: number) {
  if (v >= 70) return '#10B981';
  if (v >= 50) return '#F59E0B';
  return '#EF4444';
}

const ATTRS = [
  { key: 'strength', label: 'Fuerza', icon: '⚡', color: '#10B981' },
  { key: 'prestige', label: 'Prestigio', icon: '🏆', color: '#F59E0B' },
  { key: 'arraigo', label: 'Arraigo', icon: '🏠', color: '#3B82F6' },
  { key: 'presupuesto', label: 'Presupuesto', icon: '💰', color: '#059669' },
  { key: 'aficion', label: 'Afición', icon: '👥', color: '#8B5CF6' },
  { key: 'estadio', label: 'Estadio', icon: '🏟️', color: '#F97316' },
] as const;

export function TeamDetailPage() {
  const { gameId, teamId } = useParams({ strict: false }) as {
    gameId: string;
    teamId: string;
  };
  const id = Number(gameId);
  const tid = Number(teamId);
  const team = useQuery({
    queryKey: QK.team(id, tid),
    queryFn: () => api.team(id, tid),
  });
  const summary = useQuery({ queryKey: QK.summary(id), queryFn: () => api.summary(id) });

  const cultivate = useMutationWithFeedback({
    mutationFn: () => api.cultivateArraigo(id, tid),
    queryKeyToInvalidate: ['team', 'summary'],
    successMessage: 'Arraigo cultivado correctamente',
  });

  if (team.isLoading || !team.data) {
    return (
      <Grid>
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Skeleton height={300} radius="md" />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Skeleton height={250} radius="md" mb="md" />
          <Skeleton height={150} radius="md" />
        </Grid.Col>
      </Grid>
    );
  }

  const t = team.data;

  const attrValues: Record<string, string | number> = {
    strength: t.strength,
    prestige: t.prestige,
    arraigo: t.arraigo,
    presupuesto: fmtMoney(t.presupuesto),
    aficion: num(t.aficion),
    estadio: `${t.estadioNombre ?? '—'} (${num(t.estadioAforo ?? 0)})`,
  };

  return (
    <Grid className="page-enter">
      <Grid.Col span={{ base: 12, md: 5 }}>
        {/* Hero Card */}
        <Card
          p="xl"
          radius="lg"
          style={{
            background: 'linear-gradient(135deg, #111820 0%, #1A2332 100%)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <Group gap="sm" mb="xs">
            <IconTrophy size={22} color="#10B981" />
            <Text
              style={{
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                fontWeight: 800,
                fontSize: '28px',
                color: '#F9FAFB',
              }}
            >
              {t.name}
            </Text>
          </Group>

          <Group gap="xs" mb="lg">
            <Badge size="sm" variant="light" color="blue">
              {t.federationName ?? 'Sin federación'}
            </Badge>
            <Badge size="sm" variant="light" color="gray">
              {t.divisionName ?? 'Sin división'}
            </Badge>
          </Group>

          {/* Strength indicator */}
          <Group align="center" gap="md" mb="lg">
            <Box
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: `conic-gradient(${strengthColor(t.strength)} ${t.strength * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Box
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: '#1A2332',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                }}
              >
                <Text
                  fw={800}
                  size="xl"
                  c={strengthColor(t.strength)}
                  style={{ fontFamily: 'var(--mantine-font-family-monospace)', lineHeight: 1 }}
                >
                  {t.strength}
                </Text>
              </Box>
            </Box>
            <Box>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                Fuerza
              </Text>
              <Text size="sm" c="dimmed">
                Rating general del equipo
              </Text>
            </Box>
          </Group>

          {/* Attribute Grid */}
          <SimpleGrid cols={2} spacing="sm">
            {ATTRS.map((a, i) => (
              <Paper
                key={a.key}
                withBorder
                p="sm"
                radius="sm"
                className="stagger-item"
                style={{ background: 'rgba(255,255,255,0.03)', animationDelay: `${i * 50}ms` }}
              >
                <Group gap="sm" wrap="nowrap">
                  <Box
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: `${a.color}26`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      flexShrink: 0,
                    }}
                  >
                    {a.icon}
                  </Box>
                  <Box style={{ minWidth: 0 }}>
                    <Text
                      size="xs"
                      c="dimmed"
                      tt="uppercase"
                      fw={500}
                      style={{ fontSize: '10px', lineHeight: 1.2 }}
                    >
                      {a.label}
                    </Text>
                    <Text
                      fw={700}
                      size="sm"
                      style={{
                        fontFamily: 'var(--mantine-font-family-monospace)',
                        color: '#F9FAFB',
                      }}
                    >
                      {attrValues[a.key]}
                    </Text>
                  </Box>
                </Group>
                {a.key === 'strength' && (
                  <Box
                    mt="xs"
                    style={{
                      height: 4,
                      borderRadius: 2,
                      background: 'rgba(255,255,255,0.08)',
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      style={{
                        width: `${t.strength}%`,
                        height: '100%',
                        borderRadius: 2,
                        background:
                          t.strength >= 70
                            ? 'linear-gradient(90deg, #059669, #10B981)'
                            : t.strength >= 50
                              ? 'linear-gradient(90deg, #D97706, #F59E0B)'
                              : 'linear-gradient(90deg, #DC2626, #EF4444)',
                      }}
                    />
                  </Box>
                )}
              </Paper>
            ))}
          </SimpleGrid>
          {summary.data?.phase === 'pretemporada' && (
            <Button
              mt="md"
              size="compact-sm"
              variant="light"
              color="blue"
              leftSection={<IconHeart size={14} />}
              loading={cultivate.isPending}
              onClick={() => cultivate.mutate(undefined as void)}
            >
              Cultivar arraigo (2M€, +5-10)
            </Button>
          )}
        </Card>
      </Grid.Col>

      <Grid.Col span={{ base: 12, md: 7 }}>
        {/* Squad Table */}
        <Paper withBorder p="md" mb="md">
          <Group justify="space-between" mb="sm">
            <Text fw={700}>Plantilla</Text>
            <Text size="sm" c="dimmed">
              {t.squad.length} jugadores
            </Text>
          </Group>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Pos</Table.Th>
                <Table.Th>Jugador</Table.Th>
                <Table.Th ta="right">Edad</Table.Th>
                <Table.Th ta="right">Calidad</Table.Th>
                <Table.Th ta="right">TA</Table.Th>
                <Table.Th ta="right">TR</Table.Th>
                <Table.Th ta="right">Estado</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {t.squad.map((p, i) => {
                const unavailable =
                  p.matchesSuspendedLeft > 0 || p.injuredMatchesLeft > 0;
                const posKey = p.posicion.slice(0, 3).toUpperCase();
                const posCol = POS_COLORS[posKey] ?? { bg: '#6B7280', text: '#F9FAFB' };
                const qColor =
                  p.calidad >= 70 ? '#10B981' : p.calidad >= 50 ? '#F59E0B' : '#EF4444';
                return (
                  <Table.Tr
                    key={p.id}
                    className="stagger-item"
                    style={
                      unavailable
                        ? {
                            borderLeft: `3px solid ${
                              p.injuredMatchesLeft > 0 ? '#EF4444' : '#F97316'
                            }`,
                            animationDelay: `${i * 50}ms`,
                          }
                        : { borderLeft: `3px solid ${posCol.bg}`, animationDelay: `${i * 50}ms` }
                    }
                  >
                    <Table.Td>
                      <Badge
                        size="xs"
                        variant="filled"
                        style={{ backgroundColor: posCol.bg, color: posCol.text, fontWeight: 600 }}
                      >
                        {posKey}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{p.name}</Table.Td>
                    <Table.Td ta="right">
                      {(() => {
                        const age = (p as unknown as PlayerWithAge).age;
                        if (age == null) return <Text c="dimmed">—</Text>;
                        const color = age < 27 ? '#10B981' : age <= 31 ? '#F59E0B' : '#EF4444';
                        return (
                          <Text fw={600} style={{ fontFamily: 'var(--mantine-font-family-monospace)', color }}>
                            {age}
                          </Text>
                        );
                      })()}
                    </Table.Td>
                    <Table.Td ta="right">
                      <Group gap={6} justify="flex-end" wrap="nowrap">
                        <Text
                          fw={700}
                          style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: qColor }}
                        >
                          {p.calidad}
                        </Text>
                        <Box
                          style={{
                            width: 32,
                            height: 4,
                            borderRadius: 2,
                            background: 'rgba(255,255,255,0.08)',
                            overflow: 'hidden',
                          }}
                        >
                          <Box
                            style={{
                              width: `${p.calidad}%`,
                              height: '100%',
                              borderRadius: 2,
                              backgroundColor: qColor,
                            }}
                          />
                        </Box>
                      </Group>
                    </Table.Td>
                    <Table.Td ta="right">{p.yellowCardsThisSeason || ''}</Table.Td>
                    <Table.Td ta="right">{p.redCardsThisSeason || ''}</Table.Td>
                    <Table.Td ta="right">
                      {p.injuredMatchesLeft > 0 ? (
                        <Badge size="xs" color="red" variant="light">
                          Lesionado ({p.injuredMatchesLeft})
                        </Badge>
                      ) : p.matchesSuspendedLeft > 0 ? (
                        <Badge size="xs" color="orange" variant="light">
                          Sancionado ({p.matchesSuspendedLeft})
                        </Badge>
                      ) : null}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Paper>

        {/* Trajectory Table */}
        <Paper withBorder p="md" mb="md">
          <Text fw={700} mb="sm">
            Trayectoria
          </Text>
          {t.trajectory.length === 0 ? (
            <Text c="dimmed" size="sm">
              Sin temporadas cerradas todavía.
            </Text>
          ) : (
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Año</Table.Th>
                  <Table.Th>División</Table.Th>
                  <Table.Th ta="right">Puesto</Table.Th>
                  <Table.Th ta="right">Tendencia</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {t.trajectory.map((r, i) => {
                  const prev = i < t.trajectory.length - 1 ? t.trajectory[i + 1] : null;
                  let arrow: string | null = null;
                  let arrowColor: string | undefined;
                  if (prev) {
                    if (r.puestoFinal < prev.puestoFinal) {
                      arrow = '▲';
                      arrowColor = '#10B981';
                    } else if (r.puestoFinal > prev.puestoFinal) {
                      arrow = '▼';
                      arrowColor = '#EF4444';
                    }
                  }
                  const showSparkline = t.trajectory.length >= 3;
                  return (
                    <Table.Tr key={r.anio} className="stagger-item" style={{ animationDelay: `${i * 50}ms` }}>
                      <Table.Td fw={700}>{r.anio}</Table.Td>
                      <Table.Td>{r.divisionOrden ?? '—'}</Table.Td>
                      <Table.Td
                        ta="right"
                        fw={600}
                        style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}
                      >
                        {r.puestoFinal}º
                      </Table.Td>
                      <Table.Td ta="right">
                        {arrow ? (
                          <Text span fw={700} style={{ color: arrowColor }}>
                            {arrow}
                          </Text>
                        ) : showSparkline && i > 0 ? (
                          <Text span size="xs" c="dimmed">
                            —
                          </Text>
                        ) : null}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}
        </Paper>

        {/* Palmarés */}
        <Paper withBorder p="md" mb="md">
          <Group gap="sm" mb="sm">
            <IconTrophy size={16} color="#F59E0B" />
            <Text fw={700}>Palmarés</Text>
          </Group>
          {t.palmares.length === 0 ? (
            <Group gap="sm">
              <IconTrophyOff size={14} color="rgba(255,255,255,0.3)" />
              <Text c="dimmed" size="sm">
                Sin títulos aún.
              </Text>
            </Group>
          ) : (
            <SimpleGrid cols={2} spacing="sm">
              {t.palmares.map((p, i) => (
                <Paper
                  key={`${p.competition}-${p.isYouth ? 'j' : 'a'}`}
                  p="sm"
                  radius="sm"
                  className="stagger-item"
                  style={{
                    background: p.isYouth
                      ? 'rgba(139,92,246,0.06)'
                      : 'rgba(245,158,11,0.06)',
                    border: `1px solid ${p.isYouth ? 'rgba(139,92,246,0.2)' : 'rgba(245,158,11,0.2)'}`,
                    animationDelay: `${i * 50}ms`,
                  }}
                >
                  <Group gap="sm" wrap="nowrap">
                    <Box
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: p.isYouth
                          ? 'rgba(139,92,246,0.15)'
                          : 'rgba(245,158,11,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <IconTrophy
                        size={16}
                        color={p.isYouth ? '#8B5CF6' : '#F59E0B'}
                      />
                    </Box>
                    <Box style={{ minWidth: 0, flex: 1 }}>
                      <Text
                        size="xs"
                        fw={600}
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: '#F9FAFB',
                        }}
                      >
                        {p.competition}
                      </Text>
                      <Group gap={4}>
                        <Text
                          fw={800}
                          size="sm"
                          style={{
                            fontFamily: 'var(--mantine-font-family-monospace)',
                            color: p.isYouth ? '#8B5CF6' : '#F59E0B',
                          }}
                        >
                          {p.count}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {p.count === 1 ? 'título' : 'títulos'}
                        </Text>
                      </Group>
                    </Box>
                  </Group>
                </Paper>
              ))}
            </SimpleGrid>
          )}
        </Paper>

        {/* Rivalidades */}
        {t.rivalries && t.rivalries.length > 0 && (
          <Paper withBorder p="md" mb="md">
            <Group gap="sm" mb="sm">
              <IconHeart size={16} color="#EF4444" />
              <Text fw={700}>Rivalidades</Text>
            </Group>
            <Stack gap="xs">
              {t.rivalries.map((r) => {
                const isA = r.teamAId !== undefined;
                const rival = isA ? r.teamBName : r.teamAName;
                const { wins, draws, losses } = r.headToHead;
                return (
                  <Paper key={`${r.teamAId}-${r.teamBId}`} withBorder p="sm" radius="sm" style={{ background: 'rgba(239,68,68,0.04)', borderColor: 'rgba(239,68,68,0.15)' }}>
                    <Group justify="space-between">
                      <div>
                        <Text size="sm" fw={600}>{rival}</Text>
                        <Text size="xs" c="dimmed">{r.seasons} temporada{r.seasons !== 1 ? 's' : ''} en posiciones adyacentes</Text>
                      </div>
                      <Group gap={4}>
                        <Badge size="xs" color="green" variant="light">{wins}V</Badge>
                        <Badge size="xs" color="gray" variant="light">{draws}E</Badge>
                        <Badge size="xs" color="red" variant="light">{losses}D</Badge>
                      </Group>
                    </Group>
                  </Paper>
                );
              })}
            </Stack>
          </Paper>
        )}

        {/* Club Structure */}
        <Paper withBorder p="md">
          <Text fw={700} mb="sm">
            Estructura del club
          </Text>
          <Stack gap="sm">
            {[
              { label: 'Cantera', value: t.academiaRating },
              { label: 'Cuerpo médico', value: t.medicoRating },
              { label: 'Ojeadores', value: t.ojeadoresRating },
              { label: 'Cuerpo técnico', value: t.cuerpoTecnicoRating },
            ].map((s, i) => {
              const col = ratingColor(s.value);
              return (
                <Box key={s.label} className="stagger-item" style={{ animationDelay: `${i * 50}ms` }}>
                  <Group justify="space-between" mb={4}>
                    <Text size="sm">{s.label}</Text>
                    <Text
                      size="sm"
                      fw={700}
                      style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: col }}
                    >
                      {s.value}
                    </Text>
                  </Group>
                  <Box
                    style={{
                      height: 8,
                      borderRadius: 4,
                      background: 'rgba(255,255,255,0.08)',
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      style={{
                        width: `${s.value}%`,
                        height: '100%',
                        borderRadius: 4,
                        backgroundColor: col,
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </Box>
                </Box>
              );
            })}
          </Stack>
        </Paper>

        {/* Requirements & Compliance */}
        {(t.requirements.breaches.length > 0 || t.requirements.sanctions.length > 0) && (
          <Paper withBorder p="md" mt="md" style={{ borderLeft: '3px solid #EF4444' }}>
            <Text fw={700} mb="sm">
              Requisitos y normas
            </Text>
            {t.requirements.breaches.length > 0 && (
              <Stack gap={4} mb="sm">
                <Text size="xs" fw={600} c="red">Incumplimientos activos</Text>
                {t.requirements.breaches.map((b) => (
                  <Group key={`${b.normId}`} gap="xs">
                    <Box style={{ width: 6, height: 6, borderRadius: '50%', background: b.sanctioned ? '#EF4444' : '#F59E0B', flexShrink: 0 }} />
                    <Text size="xs">
                      {b.tipo === 'tope_plantilla' && `Fuerza ${b.valorActual} supera tope de ${b.valor}`}
                      {b.tipo === 'minimo_competitivo' && `Fuerza ${b.valorActual} por debajo del mínimo de ${b.valor}`}
                      {b.tipo === 'tope_salarial' && `Masa salarial supera el tope`}
                    </Text>
                    {b.sanctioned && (
                      <Badge size="xs" color="red" variant="light">Sancionado</Badge>
                    )}
                  </Group>
                ))}
              </Stack>
            )}
            {t.requirements.sanctions.length > 0 && (
              <Stack gap={4}>
                <Text size="xs" fw={600} c="red">Sanciones</Text>
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
      </Grid.Col>
    </Grid>
  );
}
