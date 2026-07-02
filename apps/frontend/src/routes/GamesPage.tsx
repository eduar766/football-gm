import { useRef, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  Container,
  Group,
  Modal,
  Paper,
  SegmentedControl,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import type { WorldSize } from '@football-gm/contracts';
import { notifications } from '@mantine/notifications';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  IconDownload,
  IconPlus,
  IconShield,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react';
import { api } from '../api';
import { useMutationWithFeedback } from '../useMutationWithFeedback';
import { QK } from '../query-keys';
import { useAuth } from '../contexts/AuthContext';
import { ExportReminderBanner } from '../components/ExportReminderBanner';
import { FirstLoginModal, useOnboardingModal } from '../components/FirstLoginModal';
import { EmptyState } from '../components/EmptyState';

const ACCENT_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444', '#F97316'];
const GAME_LIMIT = 3;

export function GamesPage() {
  const navigate = useNavigate();
  const { user, isAdmin, logout } = useAuth();
  const [name, setName] = useState('');
  const [seed, setSeed] = useState('');
  const [commissionerName, setCommissionerName] = useState('');
  const [federationName, setFederationName] = useState('');
  const [worldSize, setWorldSize] = useState<WorldSize>('estandar');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const onboarding = useOnboardingModal();

  const games = useQuery({ queryKey: QK.games(), queryFn: api.listGames });

  const activeCount = games.data?.length ?? 0;
  const atLimit = !isAdmin && activeCount >= GAME_LIMIT;

  const create = useMutationWithFeedback({
    mutationFn: () =>
      api.createGame({
        name: name.trim() || 'Mi competición',
        seed: seed ? Number(seed) : undefined,
        commissionerName: commissionerName.trim() || undefined,
        federationName: federationName.trim() || undefined,
        worldSize,
      }),
    queryKeyToInvalidate: ['games'],
    successMessage: 'Partida creada',
    onSuccess: ({ id }) => {
      navigate({ to: '/games/$gameId', params: { gameId: String(id) } });
    },
    onError: (error: Error) => {
      if (error.message.includes('GAME_LIMIT_REACHED')) {
        error.message = 'Límite de 3 partidas alcanzado. Borra una para crear otra.';
      }
    },
  });

  const importMutation = useMutationWithFeedback({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const payload = JSON.parse(text) as { name: string; state: unknown };
      return api.importGame(payload.name, payload.state);
    },
    queryKeyToInvalidate: ['games'],
    successMessage: 'Partida importada correctamente',
    onSuccess: ({ id }) => {
      navigate({ to: '/games/$gameId', params: { gameId: String(id) } });
    },
    onError: (error: Error) => {
      if (error.message.includes('GAME_LIMIT_REACHED')) {
        error.message = 'Límite de 3 partidas alcanzado. Borra una para importar otra.';
      }
    },
  });

  const deleteMutation = useMutationWithFeedback({
    mutationFn: (id: number) => api.deleteGame(id),
    queryKeyToInvalidate: ['games'],
    successMessage: 'Partida eliminada',
    onSuccess: () => setDeleteTarget(null),
  });

  const handleExport = async (gameId: number, gameName: string) => {
    try {
      const data = await api.exportGame(gameId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${gameName.replace(/[^a-z0-9]/gi, '_')}_save.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      notifications.show({ color: 'red', title: 'Error al exportar', message: String(e) });
    }
  };

  return (
    <>
    <FirstLoginModal opened={onboarding.opened} onClose={onboarding.close} />
    <Container size="md" py="xl" className="page-enter">
      <Stack gap="lg">
        <ExportReminderBanner hasGames={(games.data?.length ?? 0) > 0} />
        {/* Header with user info */}
        <Group justify="space-between" align="center">
          <Box />
          {user && (
            <Group gap="sm">
              <Text size="sm" c="dimmed">{user.email}</Text>
              {isAdmin && <Badge color="yellow" size="xs">Admin</Badge>}
              <Badge color="teal" size="xs" variant="outline">Beta</Badge>
              {isAdmin && (
                <Button
                  size="xs"
                  variant="subtle"
                  color="yellow"
                  leftSection={<IconShield size={13} />}
                  onClick={() => navigate({ to: '/admin' })}
                >
                  Panel admin
                </Button>
              )}
              <Button size="xs" variant="subtle" color="gray" onClick={logout}>
                Salir
              </Button>
            </Group>
          )}
        </Group>

        {/* Hero — title screen */}
        <Paper
          p={40}
          radius="lg"
          style={{
            position: 'relative',
            overflow: 'hidden',
            background:
              'radial-gradient(120% 140% at 50% -20%, rgba(16,185,129,0.14), transparent 60%), linear-gradient(180deg, #0b1218 0%, var(--surface-0) 100%)',
            border: '1px solid var(--border-2)',
            textAlign: 'center',
            boxShadow: 'var(--panel-shadow)',
          }}
        >
          <Group justify="center" mb="md">
            <img
              src="/logo.png"
              alt="Football GM"
              style={{
                width: 104,
                height: 104,
                objectFit: 'contain',
                filter: 'drop-shadow(0 0 28px rgba(16,185,129,0.45))',
              }}
            />
          </Group>
          <Text
            component="div"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 34,
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: '#F4F7FA',
              lineHeight: 1,
            }}
          >
            FOOTBALL GM
          </Text>
          <Text
            component="div"
            className="hud-eyebrow"
            mt={8}
            style={{ letterSpacing: '0.28em' }}
          >
            Commissioner Console
          </Text>
          <Text c="dimmed" size="sm" mt="md" maw={480} mx="auto">
            Eres el comisionado. Dirige una competición y hazla crecer hasta
            convertirla en una liga de clase mundial.
          </Text>
        </Paper>

        {/* Create Form */}
        <Card
          p="lg"
          radius="lg"
          style={{
            border: `1px solid ${atLimit ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
            opacity: atLimit ? 0.7 : 1,
          }}
        >
          <Group justify="space-between" align="center" mb="md">
            <Title order={4}>Nueva partida</Title>
            {!isAdmin && (
              <Badge
                color={atLimit ? 'red' : 'teal'}
                variant="light"
              >
                {activeCount}/{GAME_LIMIT} partidas
              </Badge>
            )}
          </Group>

          {atLimit && (
            <Text size="sm" c="red" mb="md">
              Has alcanzado el límite de {GAME_LIMIT} partidas. Elimina una para crear otra.
            </Text>
          )}

          <Stack gap="sm">
            <Group align="end" grow>
              <TextInput
                label="Nombre de la partida"
                placeholder="Mi competición"
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                disabled={atLimit}
              />
              <TextInput
                label="Semilla (opcional)"
                placeholder="aleatoria"
                value={seed}
                onChange={(e) => setSeed(e.currentTarget.value.replace(/[^0-9]/g, ''))}
                disabled={atLimit}
                styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' } }}
              />
            </Group>
            <Group align="end" grow>
              <TextInput
                label="Comisionado/a (opcional)"
                placeholder="Tu nombre"
                value={commissionerName}
                onChange={(e) => setCommissionerName(e.currentTarget.value)}
                disabled={atLimit}
              />
              <TextInput
                label="Federación (opcional)"
                placeholder="aleatoria"
                value={federationName}
                onChange={(e) => setFederationName(e.currentTarget.value)}
                disabled={atLimit}
              />
            </Group>
            <div>
              <Text size="sm" fw={500} mb={4}>
                Tamaño del mundo
              </Text>
              <SegmentedControl
                fullWidth
                value={worldSize}
                onChange={(v) => setWorldSize(v as WorldSize)}
                disabled={atLimit}
                data={[
                  { label: 'Pequeño (10)', value: 'pequeno' },
                  { label: 'Estándar (15)', value: 'estandar' },
                  { label: 'Grande (20)', value: 'grande' },
                ]}
              />
            </div>
            <Group>
              <Tooltip label={atLimit ? 'Límite alcanzado' : ''} disabled={!atLimit}>
                <Button
                  onClick={() => create.mutate(undefined as void)}
                  loading={create.isPending}
                  leftSection={<IconPlus size={16} />}
                  variant="gradient"
                  gradient={{ from: '#10B981', to: '#059669' }}
                  size="md"
                  disabled={atLimit}
                >
                  Crear
                </Button>
              </Tooltip>
              <Tooltip label={atLimit ? 'Límite alcanzado' : ''} disabled={!atLimit}>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  loading={importMutation.isPending}
                  leftSection={<IconUpload size={16} />}
                  variant="outline"
                  size="md"
                  disabled={atLimit}
                >
                  Importar
                </Button>
              </Tooltip>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) importMutation.mutate(file);
                  e.target.value = '';
                }}
              />
            </Group>
          </Stack>
        </Card>

        {/* Saved Games */}
        <Box>
          <Title order={4} mb="md">
            Partidas guardadas
          </Title>
          {games.isLoading ? (
            <Stack>
              <Skeleton height={80} radius="md" />
              <Skeleton height={80} radius="md" />
            </Stack>
          ) : games.data && games.data.length > 0 ? (
            <Stack gap="sm">
              {games.data.map((g, i) => {
                const accent = ACCENT_COLORS[g.currentYear % ACCENT_COLORS.length];
                return (
                  <Paper
                    key={g.id}
                    p="md"
                    radius="md"
                    withBorder
                    className="stagger-item"
                    style={{
                      borderLeft: `3px solid ${accent}`,
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                      animationDelay: `${i * 50}ms`,
                    }}
                    onClick={() =>
                      navigate({ to: '/games/$gameId', params: { gameId: String(g.id) } })
                    }
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
                  >
                    <Group justify="space-between" wrap="nowrap">
                      <Box>
                        <Text fw={700} size="md">{g.name}</Text>
                        <Group gap="xs" mt={2}>
                          <Text size="sm" c="dimmed">Año {g.currentYear}</Text>
                          <Text size="sm" c="dimmed">·</Text>
                          <Text size="sm" c="dimmed" style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>
                            Seed {g.seed}
                          </Text>
                        </Group>
                      </Box>
                      <Group gap="xs" wrap="nowrap">
                        <Button
                          size="xs"
                          variant="subtle"
                          leftSection={<IconDownload size={14} />}
                          onClick={(e) => { e.stopPropagation(); void handleExport(g.id, g.name); }}
                        >
                          Exportar
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={(e) => { e.stopPropagation(); navigate({ to: '/games/$gameId', params: { gameId: String(g.id) } }); }}
                        >
                          Abrir
                        </Button>
                        <Button
                          size="xs"
                          variant="subtle"
                          color="red"
                          leftSection={<IconTrash size={14} />}
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: g.id, name: g.name }); }}
                        >
                          Borrar
                        </Button>
                      </Group>
                    </Group>
                  </Paper>
                );
              })}
            </Stack>
          ) : (
            <EmptyState
              icon={IconShield}
              title="Aún no hay partidas"
              description="Crea tu primera competición arriba y empieza tu carrera como comisionado/a."
            />
          )}
        </Box>
      </Stack>

      {/* Delete confirmation modal */}
      <Modal
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Eliminar partida"
        centered
        size="sm"
      >
        {deleteTarget && (
          <Stack gap="md">
            <Text>
              ¿Seguro que quieres eliminar <strong>{deleteTarget.name}</strong>?
              Esta acción es permanente y no se puede deshacer.
            </Text>
            <Text size="sm" c="yellow">
              Recomendamos exportar tu partida antes de borrarla si quieres conservarla.
            </Text>
            <Group justify="space-between">
              <Button
                variant="subtle"
                leftSection={<IconDownload size={14} />}
                onClick={() => { void handleExport(deleteTarget.id, deleteTarget.name); }}
              >
                Exportar primero
              </Button>
              <Group gap="xs">
                <Button variant="default" onClick={() => setDeleteTarget(null)}>
                  Cancelar
                </Button>
                <Button
                  color="red"
                  leftSection={<IconTrash size={14} />}
                  loading={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(deleteTarget.id)}
                >
                  Eliminar
                </Button>
              </Group>
            </Group>
          </Stack>
        )}
      </Modal>
    </Container>
    </>
  );
}
