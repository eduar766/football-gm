import { useState } from 'react';
import {
  Button,
  Card,
  Container,
  Group,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { IconCheck, IconPlus, IconX } from '@tabler/icons-react';
import { api } from '../api';

export function GamesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [seed, setSeed] = useState('');

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

  return (
    <Container size="md" py="xl" className="page-enter">
      <Stack gap="lg">
        <div>
          <Title order={2}>Football GM</Title>
          <Text c="dimmed" size="sm">
            Eres el comisionado. Dirige una competición y hazla crecer.
          </Text>
        </div>

        <Card withBorder>
          <Stack>
            <Title order={4}>Nueva partida</Title>
            <Group align="end">
              <TextInput
                label="Nombre"
                placeholder="Mi competición"
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                style={{ flex: 1 }}
              />
              <TextInput
                label="Semilla (opcional)"
                placeholder="aleatoria"
                value={seed}
                onChange={(e) => setSeed(e.currentTarget.value.replace(/[^0-9]/g, ''))}
                w={160}
              />
              <Button
                onClick={() => create.mutate()}
                loading={create.isPending}
                leftSection={<IconPlus size={16} />}
              >
                Crear
              </Button>
            </Group>
          </Stack>
        </Card>

        <Card withBorder>
          <Title order={4} mb="sm">
            Partidas guardadas
          </Title>
          {games.isLoading ? (
            <Stack>
              <Skeleton height={40} />
              <Skeleton height={40} />
              <Skeleton height={40} />
            </Stack>
          ) : games.data && games.data.length > 0 ? (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Nombre</Table.Th>
                  <Table.Th>Año</Table.Th>
                  <Table.Th>Semilla</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {games.data.map((g) => (
                  <Table.Tr key={g.id}>
                    <Table.Td>{g.name}</Table.Td>
                    <Table.Td>{g.currentYear}</Table.Td>
                    <Table.Td>{g.seed}</Table.Td>
                    <Table.Td align="right">
                      <Button
                        onClick={() =>
                          navigate({
                            to: '/games/$gameId',
                            params: { gameId: String(g.id) },
                          })
                        }
                        size="xs"
                        variant="light"
                      >
                        Abrir
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <Text c="dimmed">Aún no hay partidas. Crea una arriba.</Text>
          )}
        </Card>
      </Stack>
    </Container>
  );
}
