import { useState } from 'react';
import {
  Box,
  Button,
  Container,
  Paper,
  PasswordInput,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useNavigate } from '@tanstack/react-router';
import { IconCheck, IconLock } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';

export function ChangePasswordPage() {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (next.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    setLoading(true);
    try {
      await api.changePassword(current, next);
      await refreshUser();
      notifications.show({
        color: 'green',
        icon: <IconCheck size={16} />,
        message: 'Contraseña actualizada',
      });
      navigate({ to: '/' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cambiar la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size={420} py={80}>
      <Paper p="xl" withBorder radius="lg">
        <Box ta="center" mb="lg">
          <IconLock size={36} color="#10B981" />
          <Title order={3} mt="sm">
            Cambia tu contraseña
          </Title>
          <Text size="sm" c="dimmed" mt={4}>
            Es tu primer acceso. Establece una contraseña propia.
          </Text>
        </Box>

        <form onSubmit={(e) => { void handleSubmit(e); }}>
          <Stack gap="md">
            <PasswordInput
              label="Contraseña temporal actual"
              value={current}
              onChange={(e) => setCurrent(e.currentTarget.value)}
              required
              autoFocus
            />
            <PasswordInput
              label="Nueva contraseña"
              description="Mínimo 8 caracteres"
              value={next}
              onChange={(e) => setNext(e.currentTarget.value)}
              required
            />
            <PasswordInput
              label="Confirmar nueva contraseña"
              value={confirm}
              onChange={(e) => setConfirm(e.currentTarget.value)}
              required
            />

            {error && (
              <Text size="sm" c="red">
                {error}
              </Text>
            )}

            <Button
              type="submit"
              loading={loading}
              fullWidth
              variant="gradient"
              gradient={{ from: '#10B981', to: '#059669' }}
              size="md"
              mt="xs"
            >
              Guardar contraseña
            </Button>
          </Stack>
        </form>
      </Paper>
    </Container>
  );
}
