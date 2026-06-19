import { useMemo, useState } from 'react';
import {
  Alert,
  Badge,
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

const STATUS_COLOR: Record<CupStatus, string> = {
  en_curso: 'blue',
  finalizada: 'green',
};

export function CupsPage() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);
  const qc = useQueryClient();

  const cups = useQuery({ queryKey: ['cups', id], queryFn: () => api.cups(id) });
  const structure = useQuery({
    queryKey: ['structure', id],
    queryFn: () => api.structure(id),
  });
  const summary = useQuery({
    queryKey: ['summary', id],
    queryFn: () => api.summary(id),
  });
  const isPreseason = summary.data?.phase === 'pretemporada';

  const teamOptions = useMemo(() => {
    const all = (structure.data?.divisions ?? []).flatMap((d) => d.teams);
    return all.map((t) => ({
      value: String(t.teamId),
      label: t.name,
    }));
  }, [structure.data]);

  const [name, setName] = useState('Copa de la Federación');
  const [tipo, setTipo] = useState<CupType>('copa');
  const [formato, setFormato] = useState<CupFormat>('eliminatoria');
  const [categoria, setCategoria] = useState<CupCategory>('primer_equipo');
  const [participants, setParticipants] = useState<string[]>([]);

  const create = useMutation({
    mutationFn: () =>
      api.createCup(id, {
        name,
        tipo,
        formato,
        categoria,
        participantTeamIds: participants.map(Number),
      }),
    onSuccess: () => {
      notifications.show({
        color: 'green',
        icon: <IconCheck size={18} />,
        title: 'Éxito',
        message: 'Copa creada correctamente',
      });
      setParticipants([]);
      qc.invalidateQueries({
        predicate: (q) =>
          ['cups', 'summary', 'history'].includes(q.queryKey[0] as string),
      });
    },
    onError: (error: Error) => {
      notifications.show({
        color: 'red',
        icon: <IconX size={18} />,
        title: 'Error',
        message: error.message,
      });
    },
  });

  if (cups.isLoading || summary.isLoading) {
    return (
      <>
        <Skeleton height={60} radius="md" mb="md" />
        <Skeleton height={300} radius="md" mb="md" />
        <Skeleton height={200} radius="md" />
      </>
    );
  }

  const list = cups.data?.cups ?? [];

  return (
    <>
      {!isPreseason && summary.data && (
        <Alert color="gray" mb="md" title="Pretemporada solo">
          Las copas y ligas juveniles deben crearse en pretemporada para que el
          calendario las incluya desde la jornada 1 (§4.8). Cierra la temporada
          para volver a esta ventana.
        </Alert>
      )}

      <Card withBorder mb="md">
        <Text fw={700} mb={4}>
          Crear copa (§4.4)
        </Text>
        <Text size="xs" c="dimmed" mb="sm">
          Las copas se crean en pretemporada y el calendario las integra desde
          el inicio. El campeón entra al historial / palmarés. La categoría
          juvenil la disputan las canteras de los clubes.
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
              data={(Object.keys(TIPO_LABEL) as CupType[]).map((t) => ({
                value: t,
                label: TIPO_LABEL[t],
              }))}
              value={tipo}
              onChange={(v) => v && setTipo(v as CupType)}
            />
          </Group>
          <Group grow>
            <Select
              label="Formato"
              data={[
                { value: 'eliminatoria', label: 'Eliminatoria (a partido único)' },
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
          <Group>
            <Button
              onClick={() => create.mutate()}
              disabled={
                participants.length < 2 ||
                name.trim().length === 0 ||
                !isPreseason
              }
              loading={create.isPending}
              leftSection={<IconTrophy size={16} />}
            >
              Crear copa
            </Button>
          </Group>
        </Stack>
      </Card>

      {list.length === 0 ? (
        <Paper withBorder p="md">
          <Text c="dimmed" size="sm">
            Sin copas todavía.
          </Text>
        </Paper>
      ) : (
        list.map((c) => (
          <Paper withBorder p="md" mb="md" key={c.id}>
            <Group justify="space-between" mb="sm">
              <div>
                <Text fw={700}>{c.name}</Text>
                <Text size="xs" c="dimmed">
                  {TIPO_LABEL[c.tipo]} ·{' '}
                  {c.formato === 'liga' ? 'liga' : 'eliminatoria'}
                  {c.categoria === 'juvenil' ? ' · juvenil' : ''} · año {c.year}
                </Text>
              </div>
              <Group gap="xs">
                <Badge color={STATUS_COLOR[c.status]} variant="light">
                  {c.status === 'en_curso' ? 'En curso' : 'Finalizada'}
                </Badge>
                {c.championTeamName && (
                  <Badge color="yellow" variant="light">
                    Campeón: {c.championTeamName}
                  </Badge>
                )}
              </Group>
            </Group>
            {c.rounds.map((r) => (
              <div key={r.numero} style={{ marginBottom: 12 }}>
                <Text size="sm" fw={600} mb={4}>
                  Ronda {r.numero}
                </Text>
                <Table>
                  <Table.Tbody>
                    {r.matches.map((m, i) => (
                      <Table.Tr key={i}>
                        <Table.Td>{m.homeTeamName}</Table.Td>
                        <Table.Td ta="center" fw={600}>
                          {m.played
                            ? `${m.homeGoals} – ${m.awayGoals}`
                            : '—'}
                        </Table.Td>
                        <Table.Td>{m.awayTeamName}</Table.Td>
                        <Table.Td ta="right">
                          {m.played && m.winnerTeamId !== null ? (
                            <Badge size="xs" variant="light" color="grape">
                              {m.winnerTeamId === m.homeTeamId
                                ? m.homeTeamName
                                : m.awayTeamName}
                            </Badge>
                          ) : null}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </div>
            ))}
          </Paper>
        ))
      )}
    </>
  );
}
