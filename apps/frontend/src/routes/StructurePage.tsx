import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Grid,
  Group,
  NumberInput,
  Paper,
  SegmentedControl,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { IconLayoutGrid, IconPlus, IconRefresh } from '@tabler/icons-react';
import type { LevelingPlan, StructureTeam } from '@football-gm/contracts';
import { api } from '../api';
import { useMutationWithFeedback } from '../useMutationWithFeedback';
import { QK } from '../query-keys';
import { PageHero } from '../components/PageHero';

const TIER_COLORS: Record<number, string> = {
  1: '#F59E0B',
  2: '#94A3B8',
  3: '#D97706',
  4: '#6B7280',
  5: '#6B7280',
};

function TeamRows({ teams }: { teams: StructureTeam[] }) {
  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Equipo</Table.Th>
          <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Fuerza</Table.Th>
          <Table.Th style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }} ta="right">Arraigo</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {teams.map((t, i) => (
          <Table.Tr
            key={t.teamId}
            style={{
              borderLeft: '3px solid transparent',
              transition: 'border-color 0.15s',
              background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderLeftColor = '#10B981';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderLeftColor = 'transparent';
            }}
          >
            <Table.Td fw={600}>{t.name}</Table.Td>
            <Table.Td ta="right">
              <Text fw={700} style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: t.strength >= 70 ? '#10B981' : t.strength >= 50 ? '#F59E0B' : '#EF4444' }}>
                {t.strength}
              </Text>
            </Table.Td>
            <Table.Td ta="right">
              <Text fw={600} style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: t.arraigo >= 70 ? '#EF4444' : t.arraigo >= 40 ? '#F59E0B' : '#10B981' }}>
                {t.arraigo}
              </Text>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

export function StructurePage() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);

  const structure = useQuery({
    queryKey: QK.structure(id),
    queryFn: () => api.structure(id),
  });
  const summary = useQuery({
    queryKey: QK.summary(id),
    queryFn: () => api.summary(id),
  });

  const level = useMutationWithFeedback({
    mutationFn: (plan?: LevelingPlan) => api.runLevelingLeague(id, plan),
    queryKeyToInvalidate: ['structure', 'standings', 'summary', 'teams', 'federations', 'economy'],
    successMessage: 'Liga de nivelación ejecutada',
  });

  const setFormat = useMutationWithFeedback({
    mutationFn: (format: 'ida' | 'ida_vuelta') => api.setLeagueFormat(id, format),
    queryKeyToInvalidate: ['structure', 'standings', 'summary', 'teams', 'federations', 'economy'],
    successMessage: 'Formato de liga actualizado',
  });

  const [teamName, setTeamName] = useState('');
  const [planDivs, setPlanDivs] = useState<{ size: number; format: 'ida' | 'ida_vuelta' }[]>([]);
  const create = useMutationWithFeedback({
    mutationFn: () => api.createOwnTeam(id, teamName.trim()),
    queryKeyToInvalidate: ['structure', 'standings', 'summary', 'teams', 'federations', 'economy'],
    successMessage: 'Equipo propio creado',
    onSuccess: () => setTeamName(''),
  });

  if (structure.isLoading || summary.isLoading) {
    return (
      <div className="page-enter">
        <Skeleton height={120} radius="md" mb="md" />
        <Skeleton height={60} radius="md" mb="md" />
        <Skeleton height={200} radius="md" mb="md" />
        <Grid>
          <Grid.Col span={6}><Skeleton height={200} radius="md" /></Grid.Col>
          <Grid.Col span={6}><Skeleton height={200} radius="md" /></Grid.Col>
        </Grid>
      </div>
    );
  }

  const pending = structure.data?.pending ?? [];
  const isPreseason = summary.data?.phase === 'pretemporada';

  // Fase 14.7: total pool of player teams that the leveling league redistributes.
  const poolSize =
    (structure.data?.divisions ?? []).reduce((a, d) => a + d.teams.length, 0) + pending.length;

  const buildDefault = (count: number): { size: number; format: 'ida' | 'ida_vuelta' }[] => {
    const base = Math.floor(poolSize / count);
    const rem = poolSize % count;
    return Array.from({ length: count }, (_, i) => ({
      size: base + (i < rem ? 1 : 0),
      format: 'ida_vuelta' as const,
    }));
  };
  const divs = planDivs.length ? planDivs : buildDefault(1);
  const plannedTotal = divs.reduce((a, d) => a + d.size, 0);
  const planValid = plannedTotal === poolSize && divs.every((d) => d.size >= 2);
  const submitPlan = () => {
    const plan: LevelingPlan = {
      divisions: divs.map((d, i) => ({ orden: i + 1, size: d.size, format: d.format })),
    };
    level.mutate(plan);
  };

  return (
    <div className="page-enter">
      <PageHero
        icon={IconLayoutGrid}
        title="Estructura de la liga"
        subtitle="Antes de crecer o abrir una división nueva se celebra una liga de nivelación que reparte los equipos por mérito."
      />

      <Group justify="flex-end" mb="md">
        <Button
          onClick={() =>
            modals.openConfirmModal({
              title: 'Celebrar liga de nivelación',
              children: (
                <Text size="sm">Se ejecutará una liga de nivelación que repartirá los equipos por mérito entre las divisiones. ¿Continuar?</Text>
              ),
              labels: { confirm: 'Confirmar', cancel: 'Cancelar' },
              confirmProps: { color: 'yellow' },
              onConfirm: () => level.mutate(undefined),
            })
          }
          loading={level.isPending}
          disabled={!isPreseason}
          variant="gradient"
          gradient={{ from: '#F59E0B', to: '#D97706' }}
          leftSection={<IconRefresh size={16} />}
        >
          Celebrar liga de nivelación
        </Button>
      </Group>

      {!isPreseason && summary.data && (
        <Alert color="gray" mb="md" title="Cambios estructurales bloqueados">
          La temporada está en curso. Los cambios de estructura, formato, copas
          y equipos solo pueden hacerse en pretemporada. Cierra la
          temporada para volver a esta ventana.
        </Alert>
      )}
      {pending.length > 0 && (
        <Alert color="blue" mb="md" title="Equipos pendientes de integración">
          {pending.map((t) => t.name).join(', ')} — adheridos por negociación.
          Celebra una liga de nivelación para colocarlos en una división.
        </Alert>
      )}

      {isPreseason && poolSize >= 2 && (
        <Paper p="md" mb="md" style={{ border: '1px solid rgba(255,255,255,0.06)', borderLeft: '3px solid #F59E0B' }}>
          <Group justify="space-between" mb="xs">
            <div>
              <Text fw={700}>Planificar nivelación</Text>
              <Text size="xs" c="dimmed">
                Decide cuántas divisiones, cuántos equipos en cada una y su formato.
                Los mejores de la nivelación van a 1ª; los peores caen a 2ª/3ª.
              </Text>
            </div>
            <Badge size="lg" variant="light" color={planValid ? 'teal' : 'red'}>
              {plannedTotal}/{poolSize} equipos
            </Badge>
          </Group>

          <Group mb="sm">
            <Text size="sm" fw={500}>Nº de divisiones</Text>
            <SegmentedControl
              value={String(divs.length)}
              onChange={(v) => setPlanDivs(buildDefault(Number(v)))}
              data={['1', '2', '3'].filter((n) => Number(n) * 2 <= poolSize).map((n) => ({ value: n, label: n }))}
            />
          </Group>

          <Stack gap="xs">
            {divs.map((d, i) => (
              <Group key={i} justify="space-between" wrap="nowrap">
                <Text size="sm" style={{ width: 90 }}>
                  {i === 0 ? 'Primera' : i === 1 ? 'Segunda' : 'Tercera'}
                </Text>
                <NumberInput
                  size="xs"
                  min={2}
                  max={poolSize}
                  value={d.size}
                  onChange={(v) =>
                    setPlanDivs(divs.map((x, j) => (j === i ? { ...x, size: Number(v) || 0 } : x)))
                  }
                  w={100}
                />
                <SegmentedControl
                  size="xs"
                  value={d.format}
                  onChange={(v) =>
                    setPlanDivs(divs.map((x, j) => (j === i ? { ...x, format: v as 'ida' | 'ida_vuelta' } : x)))
                  }
                  data={[
                    { value: 'ida', label: 'Una vuelta' },
                    { value: 'ida_vuelta', label: 'Ida y vuelta' },
                  ]}
                />
              </Group>
            ))}
          </Stack>

          <Group justify="flex-end" mt="sm">
            <Button
              size="sm"
              color="yellow"
              disabled={!planValid || level.isPending}
              loading={level.isPending}
              onClick={submitPlan}
            >
              Ejecutar nivelación con este plan
            </Button>
          </Group>
          {!planValid && (
            <Text size="xs" c="red" mt={4} ta="right">
              Los tamaños deben sumar {poolSize} y cada división tener ≥2 equipos.
            </Text>
          )}
        </Paper>
      )}

      <Paper p="md" mb="md" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
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

      <Paper p="md" mb="md" style={{ border: '1px solid rgba(255,255,255,0.06)', borderLeft: '3px solid #10B981' }}>
        <Text fw={700} mb={4}>
          Crear equipo propio
        </Text>
        <Text size="xs" c="dimmed" mb="sm">
          Construye un club desde cero: entra débil en la división más baja y
          se incluye en el calendario de la próxima temporada. No depende de
          tier ni negociación, pero cuesta 5 M€.
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
            onClick={async () => {
              const { name } = await api.randomTeamName(id);
              setTeamName(name);
            }}
            variant="default"
            leftSection={<IconRefresh size={16} />}
          >
            Aleatorio
          </Button>
          <Button
            onClick={() => create.mutate(undefined as void)}
            loading={create.isPending}
            disabled={teamName.trim().length === 0 || !isPreseason}
            leftSection={<IconPlus size={16} />}
            variant="gradient"
            gradient={{ from: '#10B981', to: '#059669' }}
          >
            Crear (5 M€)
          </Button>
        </Group>
      </Paper>

      <Grid>
        {structure.data?.divisions.map((d, i) => (
          <Grid.Col key={d.orden} span={{ base: 12, md: 6 }}>
            <Paper
              p="md"
              className="stagger-item"
              style={{
                border: '1px solid rgba(255,255,255,0.06)',
                borderLeft: `3px solid ${TIER_COLORS[d.orden] ?? '#6B7280'}`,
                animationDelay: `${i * 50}ms`,
              }}
            >
              <Group justify="space-between" mb="sm">
                <Text fw={700}>
                  {d.name}
                </Text>
                <Text size="xs" c="dimmed" style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>
                  {d.teams.length} equipos
                </Text>
              </Group>
              <TeamRows teams={d.teams} />
            </Paper>
          </Grid.Col>
        ))}
        {pending.length > 0 && (
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Paper
              p="md"
              className="stagger-item"
              style={{
                border: '1px solid rgba(255,255,255,0.06)',
                borderLeft: '3px solid #F97316',
                animationDelay: `${(structure.data?.divisions.length ?? 0) * 50}ms`,
              }}
            >
              <Group justify="space-between" mb="sm">
                <Text fw={700}>Pendientes de integración</Text>
                <Text size="xs" c="dimmed" style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>
                  {pending.length} equipos
                </Text>
              </Group>
              <TeamRows teams={pending} />
            </Paper>
          </Grid.Col>
        )}
      </Grid>
    </div>
  );
}
