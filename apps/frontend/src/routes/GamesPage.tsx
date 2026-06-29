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
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  IconCheck,
  IconDownload,
  IconPlus,
  IconShield,
  IconTrash,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { ExportReminderBanner } from '../components/ExportReminderBanner';
import { FirstLoginModal, useOnboardingModal } from '../components/FirstLoginModal';

const ACCENT_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444', '#F97316'];
const GAME_LIMIT = 3;

export function GamesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user, isAdmin, logout } = useAuth();
  const [name, setName] = useState('');
  const [seed, setSeed] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const onboarding = useOnboardingModal();

  const games = useQuery({ queryKey: ['games'], queryFn: api.listGames });

  const activeCount = games.data?.length ?? 0;
  const atLimit = !isAdmin && activeCount >= GAME_LIMIT;

  const create = useMutation({
    mutationFn: () =>
      api.createGame({
        name: name.trim() || 'Mi competición',
        seed: seed ? Number(seed) : undefined,
      }),
    onSuccess: async ({ id }) => {
      notifications.show({
        color: 'green',
        icon: <IconCheck size={18} />,
        title: 'Éxito',
        message: 'Partida creada',
      });
      await qc.invalidateQueries({ queryKey: ['games'] });
      navigate({ to: '/games/$gameId', params: { gameId: String(id) } });
    },
    onError: (error: Error) => {
      const msg = error.message.includes('GAME_LIMIT_REACHED')
        ? 'Límite de 3 partidas alcanzado. Borra una para crear otra.'
        : error.message;
      notifications.show({ color: 'red', icon: <IconX size={18} />, title: 'Error', message: msg });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const payload = JSON.parse(text) as { name: string; state: unknown };
      return api.importGame(payload.name, payload.state);
    },
    onSuccess: async ({ id }) => {
      notifications.show({ color: 'green', icon: <IconCheck size={18} />, title: 'Importado', message: 'Partida importada correctamente' });
      await qc.invalidateQueries({ queryKey: ['games'] });
      navigate({ to: '/games/$gameId', params: { gameId: String(id) } });
    },
    onError: (error: Error) => {
      const msg = error.message.includes('GAME_LIMIT_REACHED')
        ? 'Límite de 3 partidas alcanzado. Borra una para importar otra.'
        : error.message;
      notifications.show({ color: 'red', icon: <IconX size={18} />, title: 'Error al importar', message: msg });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteGame(id),
    onSuccess: async () => {
      notifications.show({ color: 'green', icon: <IconCheck size={18} />, message: 'Partida eliminada' });
      setDeleteTarget(null);
      await qc.invalidateQueries({ queryKey: ['games'] });
    },
    onError: () => {
      notifications.show({ color: 'red', icon: <IconX size={18} />, message: 'Error al eliminar la partida' });
    },
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

        {/* Hero */}
        <Paper
          p="xl"
          radius="lg"
          style={{
            background: 'linear-gradient(180deg, #0B0F14 0%, #111820 100%)',
            border: '1px solid rgba(255,255,255,0.06)',
            textAlign: 'center',
          }}
        >
          <Group justify="center" mb="sm">
            <img src="/logo.png" alt="Football GM" style={{ width: 120, height: 120, objectFit: 'contain' }} />
          </Group>
          <Text c="dimmed" size="sm" mt="xs" fs="italic">
            Eres el comisionado. Dirige una competición y hazla crecer.
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

          <Group align="end">
            <TextInput
              label="Nombre"
              placeholder="Mi competición"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              style={{ flex: 1 }}
              disabled={atLimit}
            />
            <TextInput
              label="Semilla (opcional)"
              placeholder="aleatoria"
              value={seed}
              onChange={(e) => setSeed(e.currentTarget.value.replace(/[^0-9]/g, ''))}
              w={160}
              disabled={atLimit}
              styles={{ input: { fontFamily: '"Geist Mono", monospace' } }}
            />
            <Group>
              <Tooltip label={atLimit ? 'Límite alcanzado' : ''} disabled={!atLimit}>
                <Button
                  onClick={() => create.mutate()}
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
          </Group>
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
                          <Text size="sm" c="dimmed" style={{ fontFamily: '"Geist Mono", monospace' }}>
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
            <Text c="dimmed">Aún no hay partidas. Crea una arriba.</Text>
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
