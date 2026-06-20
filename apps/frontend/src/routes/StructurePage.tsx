import { useState } from 'react';
import {
  Alert,
  Button,
  Grid,
  Group,
  Paper,
  SegmentedControl,
  Skeleton,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { IconCheck, IconPlus, IconRefresh, IconX } from '@tabler/icons-react';
import type { StructureTeam } from '@football-gm/contracts';
import { api } from '../api';

function TeamRows({ teams }: { teams: StructureTeam[] }) {
  return (
    <Table striped>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Equipo</Table.Th>
          <Table.Th ta="right">Fuerza</Table.Th>
          <Table.Th ta="right">Arraigo</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {teams.map((t) => (
          <Table.Tr key={t.teamId}>
            <Table.Td>{t.name}</Table.Td>
            <Table.Td ta="right">{t.strength}</Table.Td>
            <Table.Td ta="right">{t.arraigo}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

export function StructurePage() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);
  const qc = useQueryClient();

  const structure = useQuery({
    queryKey: ['structure', id],
    queryFn: () => api.structure(id),
  });
  const summary = useQuery({
    queryKey: ['summary', id],
    queryFn: () => api.summary(id),
  });

  const invalidate = () =>
    qc.invalidateQueries({
      predicate: (q) =>
        [
          'structure',
          'standings',
          'summary',
          'teams',
          'federations',
          'economy',
        ].includes(q.queryKey[0] as string),
    });

  const level = useMutation({
    mutationFn: () => api.runLevelingLeague(id),
    onSuccess: () => {
      notifications.show({
        color: 'green',
        icon: <IconCheck size={18} />,
        title: 'Éxito',
        message: 'Liga de nivelación ejecutada',
      });
      invalidate();
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

  const setFormat = useMutation({
    mutationFn: (format: 'ida' | 'ida_vuelta') =>
      api.setLeagueFormat(id, format),
    onSuccess: () => {
      notifications.show({
        color: 'green',
        icon: <IconCheck size={18} />,
        title: 'Éxito',
        message: 'Formato de liga actualizado',
      });
      invalidate();
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

  const [teamName, setTeamName] = useState('');
  const create = useMutation({
    mutationFn: () => api.createOwnTeam(id, teamName.trim()),
    onSuccess: () => {
      notifications.show({
        color: 'green',
        icon: <IconCheck size={18} />,
        title: 'Éxito',
        message: 'Equipo propio creado',
      });
      setTeamName('');
      invalidate();
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

  if (structure.isLoading || summary.isLoading) {
    return (
      <>
        <Skeleton height={60} radius="md" mb="md" />
        <Skeleton height={200} radius="md" mb="md" />
        <Skeleton height={60} radius="md" mb="md" />
        <Skeleton height={200} radius="md" />
      </>
    );
  }

  const pending = structure.data?.pending ?? [];
  const isPreseason = summary.data?.phase === 'pretemporada';

  return (
    <div className="page-enter">
      {!isPreseason && summary.data && (
        <Alert color="gray" mb="md" title="Cambios estructurales bloqueados">
          La temporada está en curso. Los cambios de estructura, formato, copas
          y equipos solo pueden hacerse en pretemporada (§4.8). Cierra la
          temporada para volver a esta ventana.
        </Alert>
      )}

      <Paper withBorder p="md" mb="md">
        <Group justify="space-between">
          <div>
            <Text fw={700}>Estructura de la liga</Text>
            <Text size="xs" c="dimmed">
              Antes de crecer o abrir una división nueva se celebra una liga de
              nivelación que reparte los equipos por mérito (§4.4).
            </Text>
          </div>
          <Button
            onClick={() =>
              modals.openConfirmModal({
                title: 'Celebrar liga de nivelación',
                children: (
                  <Text size="sm">
                    Se ejecutará una liga de nivelación que repartirá los equipos por mérito entre las divisiones. ¿Continuar?
                  </Text>
                ),
                labels: { confirm: 'Confirmar', cancel: 'Cancelar' },
                confirmProps: { color: 'yellow' },
                onConfirm: () => level.mutate(),
              })
            }
            loading={level.isPending}
            disabled={!isPreseason}
            color="yellow"
            leftSection={<IconRefresh size={16} />}
          >
            Celebrar liga de nivelación
          </Button>
        </Group>
        {pending.length > 0 && (
          <Alert color="blue" mt="md" title="Equipos pendientes de integración">
            {pending.map((t) => t.name).join(', ')} — adheridos por negociación.
            Celebra una liga de nivelación para colocarlos en una división.
          </Alert>
        )}
      </Paper>

      <Paper withBorder p="md" mb="md">
        <Group justify="space-between">
          <div>
            <Text fw={700}>Formato de liga</Text>
            <Text size="xs" c="dimmed">
              Una vuelta o ida y vuelta. Se aplica al construir el calendario
              al comenzar la temporada.
            </Text>
          </div>
          {summary.data && (
            <SegmentedControl
              value={summary.data.leagueFormat}
              onChange={(v) => setFormat.mutate(v as 'ida' | 'ida_vuelta')}
              disabled={setFormat.isPending || !isPreseason}
              data={[
                { value: 'ida', label: 'Una vuelta' },
                { value: 'ida_vuelta', label: 'Ida y vuelta' },
              ]}
            />
          )}
        </Group>
      </Paper>

      <Paper withBorder p="md" mb="md">
        <Text fw={700} mb={4}>
          Crear equipo propio
        </Text>
        <Text size="xs" c="dimmed" mb="sm">
          Construye un club desde cero: entra débil en la división más baja y
          se incluye en el calendario de la próxima temporada. No depende de
          tier ni negociación, pero cuesta 5 M€ (§4.3).
        </Text>
        <Group align="end">
          <TextInput
            label="Nombre del club"
            placeholder="CD Cantera"
            value={teamName}
            onChange={(e) => setTeamName(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Button
            onClick={() => create.mutate()}
            loading={create.isPending}
            disabled={teamName.trim().length === 0 || !isPreseason}
            leftSection={<IconPlus size={16} />}
          >
            Crear (5 M€)
          </Button>
        </Group>
      </Paper>

      <Grid>
        {structure.data?.divisions.map((d) => (
          <Grid.Col key={d.orden} span={{ base: 12, md: 6 }}>
            <Paper withBorder p="md">
              <Text fw={700} mb="sm">
                {d.name}{' '}
                <Text span c="dimmed" size="sm">
                  ({d.teams.length} equipos)
                </Text>
              </Text>
              <TeamRows teams={d.teams} />
            </Paper>
          </Grid.Col>
        ))}
        {pending.length > 0 && (
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Paper withBorder p="md">
              <Text fw={700} mb="sm">
                Pendientes de integración
              </Text>
              <TeamRows teams={pending} />
            </Paper>
          </Grid.Col>
        )}
      </Grid>
    </div>
  );
}
