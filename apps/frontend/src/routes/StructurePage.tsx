import { useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Grid,
  Group,
  Paper,
  Skeleton,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { IconLayoutGrid, IconPlus, IconRefresh } from '@tabler/icons-react';
import type { StructureTeam } from '@football-gm/contracts';
import { api } from '../api';
import { useMutationWithFeedback } from '../useMutationWithFeedback';
import { QK } from '../query-keys';
import { PageHero } from '../components/PageHero';
import { AssemblyRedirectBanner } from '../components/AssemblyRedirectBanner';

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

  const [teamName, setTeamName] = useState('');
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

  return (
    <div className="page-enter">
      <PageHero
        icon={IconLayoutGrid}
        title="Estructura de la liga"
        subtitle="Antes de crecer o abrir una división nueva se celebra una liga de nivelación que reparte los equipos por mérito."
      />

      <Box mb="md">
        <AssemblyRedirectBanner
          gameId={gameId}
          message="Expandir divisiones (celebrar una liga de nivelación) ahora se propone y vota en la asamblea de clubes."
        />
      </Box>

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

      <Paper p="md" mb="md" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
        <Group justify="space-between" mb="sm">
          <div>
            <Text fw={700}>Formato de liga</Text>
            <Text size="xs" c="dimmed">
              Una vuelta o ida y vuelta. Se aplica al construir el calendario
              al comenzar la temporada.
            </Text>
          </div>
          {summary.data && (
            <Badge size="lg" variant="light" color="gray">
              {summary.data.leagueFormat === 'ida' ? 'Una vuelta' : 'Ida y vuelta'}
            </Badge>
          )}
        </Group>
        <AssemblyRedirectBanner
          gameId={gameId}
          message="Cambiar el formato de liga ahora se propone y vota en la asamblea de clubes."
        />
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
