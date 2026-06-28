import { useRef, useState } from 'react';
import {
  Box,
  Button,
  Card,
  Container,
  Group,
  Paper,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { IconCheck, IconDownload, IconPlus, IconUpload, IconX, IconTrophy } from '@tabler/icons-react';
import { api } from '../api';

const ACCENT_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444', '#F97316'];

export function GamesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [seed, setSeed] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const games = useQuery({ queryKey: ['games'], queryFn: api.listGames });

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
      notifications.show({
        color: 'red',
        icon: <IconX size={18} />,
        title: 'Error',
        message: error.message,
      });
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
      notifications.show({ color: 'red', icon: <IconX size={18} />, title: 'Error al importar', message: error.message });
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
    <Container size="md" py="xl" className="page-enter">
      <Stack gap="lg">
        {/* Hero Section */}
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
            <IconTrophy size={48} color="#10B981" />
          </Group>
          <Title
            order={1}
            style={{
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              fontWeight: 800,
              fontSize: '40px',
              letterSpacing: '-0.02em',
              color: '#F9FAFB',
            }}
          >
            FOOTBALL GM
          </Title>
          <Text c="dimmed" size="sm" mt="xs" fs="italic">
            Eres el comisionado. Dirige una competición y hazla crecer.
          </Text>
        </Paper>

        {/* Create Form */}
        <Card
          p="lg"
          radius="lg"
          style={{
            border: '1px solid rgba(16,185,129,0.3)',
          }}
        >
          <Title order={4} mb="md">
            Nueva partida
          </Title>
          <Group align="end">
            <TextInput
              label="Nombre"
              placeholder="Mi competición"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              style={{ flex: 1 }}
              styles={{
                input: {
                  ':focus': {
                    boxShadow: '0 0 0 2px rgba(16,185,129,0.3)',
                  },
                },
              }}
            />
            <TextInput
              label="Semilla (opcional)"
              placeholder="aleatoria"
              value={seed}
              onChange={(e) => setSeed(e.currentTarget.value.replace(/[^0-9]/g, ''))}
              w={160}
              styles={{
                input: {
                  fontFamily: '"Geist Mono", monospace',
                  ':focus': {
                    boxShadow: '0 0 0 2px rgba(16,185,129,0.3)',
                  },
                },
              }}
            />
            <Group>
              <Button
                onClick={() => create.mutate()}
                loading={create.isPending}
                leftSection={<IconPlus size={16} />}
                variant="gradient"
                gradient={{ from: '#10B981', to: '#059669' }}
                size="md"
              >
                Crear
              </Button>
              <Button
                onClick={() => fileInputRef.current?.click()}
                loading={importMutation.isPending}
                leftSection={<IconUpload size={16} />}
                variant="outline"
                size="md"
              >
                Importar
              </Button>
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
                      navigate({
                        to: '/games/$gameId',
                        params: { gameId: String(g.id) },
                      })
                    }
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '';
                    }}
                  >
                    <Group justify="space-between" wrap="nowrap">
                      <Box>
                        <Text fw={700} size="md">
                          {g.name}
                        </Text>
                        <Group gap="xs" mt={2}>
                          <Text size="sm" c="dimmed">
                            Año {g.currentYear}
                          </Text>
                          <Text size="sm" c="dimmed">
                            ·
                          </Text>
                          <Text size="sm" c="dimmed" style={{ fontFamily: '"Geist Mono", monospace' }}>
                            Seed {g.seed}
                          </Text>
                        </Group>
                      </Box>
                      <Group gap="xs">
                        <Button
                          size="xs"
                          variant="subtle"
                          leftSection={<IconDownload size={14} />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExport(g.id, g.name);
                          }}
                        >
                          Exportar
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate({
                              to: '/games/$gameId',
                              params: { gameId: String(g.id) },
                            });
                          }}
                        >
                          Abrir
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
    </Container>
  );
}
