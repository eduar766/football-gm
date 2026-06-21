import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
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
import { IconCheck, IconTrophy, IconX } from '@tabler/icons-react';
import type {
  CupCategory,
  CupFormat,
  CupStatus,
  CupType,
} from '@football-gm/contracts';
import { api } from '../api';

const TIPO_LABEL: Record<CupType, string> = {
  copa: 'Copa',
  liga_juvenil: 'Liga juvenil',
  torneo_verano: 'Torneo de verano',
};

const STATUS_CONFIG: Record<CupStatus, { label: string; gradient: string }> = {
  en_curso: { label: 'En curso', gradient: 'linear-gradient(135deg, #2563EB, #3B82F6)' },
  finalizada: { label: 'Finalizada', gradient: 'linear-gradient(135deg, #059669, #10B981)' },
};

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
    return all.map((t) => ({ value: String(t.teamId), label: t.name }));
  }, [structure.data]);

  const [name, setName] = useState('Copa de la Federación');
  const [tipo, setTipo] = useState<CupType>('copa');
  const [formato, setFormato] = useState<CupFormat>('eliminatoria');
  const [categoria, setCategoria] = useState<CupCategory>('primer_equipo');
  const [participants, setParticipants] = useState<string[]>([]);

  const create = useMutation({
    mutationFn: () =>
      api.createCup(id, {
        name, tipo, formato, categoria,
        participantTeamIds: participants.map(Number),
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
        list.map((c, i) => {
          const sc = STATUS_CONFIG[c.status];
          return (
            <Paper
              key={c.id}
              p="md"
              mb="md"
              className="stagger-item"
              style={{
                border: '1px solid rgba(255,255,255,0.06)',
                borderLeft: '3px solid #F59E0B',
                animationDelay: `${i * 50}ms`,
              }}
            >
              <Group justify="space-between" mb="sm">
                <div>
                  <Group gap="sm">
                    <IconTrophy size={18} color="#F59E0B" />
                    <Text fw={700} size="lg">{c.name}</Text>
                  </Group>
                  <Text size="xs" c="dimmed" ml={30}>
                    {TIPO_LABEL[c.tipo]} ·{' '}
                    {c.formato === 'liga' ? 'liga' : c.formato === 'eliminatoria_ida_vuelta' ? 'eliminatoria (ida y vuelta)' : 'eliminatoria'}
                    {c.categoria === 'juvenil' ? ' · juvenil' : ''} · año {c.year}
                  </Text>
                </div>
                <Group gap="xs">
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
                </Group>
              </Group>
              {c.championTeamName && c.status === 'finalizada' && (
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
                        {c.championTeamName}
                      </Text>
                    </div>
                  </Group>
                </Box>
              )}
              {(() => {
                const isIdaVuelta = c.formato === 'eliminatoria_ida_vuelta';
                // Group rounds: for ida_vuelta, pair consecutive rounds (ida+vuelta)
                // with the same logical round number.
                type RoundGroup = { logicalNumero: number; legs: { numero: number; label: string; matches: typeof c.rounds[0]['matches'] }[] };
                const groups: RoundGroup[] = [];
                if (isIdaVuelta) {
                  const seen = new Set<number>();
                  for (const r of c.rounds) {
                    if (seen.has(r.numero)) continue;
                    const logicalNumero = r.numero;
                    const ida = c.rounds.find((x) => x.numero === logicalNumero && x.leg === 'ida');
                    const vuelta = c.rounds.find((x) => x.numero === logicalNumero + 1 && x.leg === 'vuelta');
                    const legs: RoundGroup['legs'] = [];
                    if (ida) legs.push({ numero: ida.numero, label: 'Ida', matches: ida.matches });
                    if (vuelta) legs.push({ numero: vuelta.numero, label: 'Vuelta', matches: vuelta.matches });
                    groups.push({ logicalNumero, legs });
                    seen.add(logicalNumero);
                    if (vuelta) seen.add(vuelta.numero);
                  }
                } else {
                  for (const r of c.rounds) {
                    groups.push({ logicalNumero: r.numero, legs: [{ numero: r.numero, label: '', matches: r.matches }] });
                  }
                }
                return groups.map((g) => {
                  const allMatches = g.legs.flatMap((l) => l.matches);
                  const realMatches = allMatches.filter(
                    (m) => m.homeTeamName !== 'BYE' && m.awayTeamName !== 'BYE',
                  );
                  if (realMatches.length === 0) return null;
                  return (
                    <Box key={g.logicalNumero} style={{ marginBottom: 16 }}>
                      <Group gap="sm" mb={6}>
                        <Box
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            background: 'rgba(245,158,11,0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text fw={700} style={{ fontFamily: '"Geist Mono", monospace', fontSize: '11px', color: '#F59E0B' }}>
                            {g.logicalNumero}
                          </Text>
                        </Box>
                        <Text size="sm" fw={600}>Ronda {g.logicalNumero}</Text>
                      </Group>
                      {g.legs.map((leg) => (
                        <Box key={leg.numero} ml={isIdaVuelta ? 16 : 0} mb={isIdaVuelta ? 8 : 0}>
                          {isIdaVuelta && (
                            <Text size="xs" fw={600} c="dimmed" mb={4} ml={30}>
                              {leg.label}
                            </Text>
                          )}
                          <Table>
                            <Table.Tbody>
                              {leg.matches.filter((m) => m.homeTeamName !== 'BYE' && m.awayTeamName !== 'BYE').map((m, i) => (
                                <Table.Tr
                                  key={i}
                                  style={{
                                    background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                                  }}
                                >
                                  <Table.Td fw={m.winnerTeamId === m.homeTeamId ? 700 : 400} style={{ textAlign: 'right' }}>
                                    {m.homeTeamName}
                                  </Table.Td>
                                  <Table.Td ta="center">
                                    {m.played ? (
                                      <Group gap="xs" justify="center">
                                        <Text
                                          fw={800}
                                          style={{
                                            fontFamily: '"Geist Mono", monospace',
                                            fontSize: '18px',
                                            color: '#F9FAFB',
                                            minWidth: 28,
                                            textAlign: 'center',
                                          }}
                                        >
                                          {m.homeGoals}
                                        </Text>
                                        <Text c="dimmed" style={{ fontFamily: '"Geist Mono", monospace' }}>–</Text>
                                        <Text
                                          fw={800}
                                          style={{
                                            fontFamily: '"Geist Mono", monospace',
                                            fontSize: '18px',
                                            color: '#F9FAFB',
                                            minWidth: 28,
                                            textAlign: 'center',
                                          }}
                                        >
                                          {m.awayGoals}
                                        </Text>
                                      </Group>
                                    ) : (
                                      <Text c="dimmed" style={{ fontFamily: '"Geist Mono", monospace' }}>vs</Text>
                                    )}
                                  </Table.Td>
                                  <Table.Td fw={m.winnerTeamId === m.awayTeamId ? 700 : 400}>
                                    {m.awayTeamName}
                                  </Table.Td>
                                  <Table.Td ta="right">
                                    {m.played && m.winnerTeamId !== null ? (
                                      <Box
                                        style={{
                                          display: 'inline-flex',
                                          padding: '2px 10px',
                                          borderRadius: 12,
                                          background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
                                          color: '#fff',
                                          fontWeight: 600,
                                          fontSize: '12px',
                                        }}
                                      >
                                        {m.winnerTeamId === m.homeTeamId ? m.homeTeamName : m.awayTeamName}
                                      </Box>
                                    ) : null}
                                  </Table.Td>
                                </Table.Tr>
                              ))}
                            </Table.Tbody>
                          </Table>
                        </Box>
                      ))}
                    </Box>
                  );
                });
              })()}
            </Paper>
          );
        })
      )}
    </div>
  );
}
