import { useState } from 'react';
import {
  Anchor,
  Box,
  Button,
  Container,
  Group,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useNavigate } from '@tanstack/react-router';
import { IconX } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';

export function LoginPage() {

  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate({ to: '/' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      if (msg.includes('PENDING_APPROVAL')) {
        setError('Tu cuenta está pendiente de aprobación. Te avisaremos por email.');
      } else {
        setError('Email o contraseña incorrectos.');
      }
      notifications.show({
        color: 'red',
        icon: <IconX size={16} />,
        message: error ?? msg,
        autoClose: 4000,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size={420} py={80}>
      <Stack gap="lg">
        <Box ta="center">
          <Group justify="center" mb="sm">
            <img src="/logo.png" alt="Football GM" style={{ width: 100, height: 100, objectFit: 'contain' }} />
          </Group>
          <Text c="dimmed" size="sm" mt={4}>
            Beta
          </Text>
        </Box>

        <Paper p="xl" withBorder radius="lg">
          <Title order={3} mb="md">
            Iniciar sesión
          </Title>

          <form onSubmit={(e) => { void handleSubmit(e); }}>
            <Stack gap="md">
              <TextInput
                label="Email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                required
                autoFocus
              />
              <PasswordInput
                label="Contraseña"
                placeholder="Tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
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
                Entrar
              </Button>
            </Stack>
          </form>

          <Stack gap={6} mt="md">
            <Anchor
              size="sm"
              c="dimmed"
              onClick={() => navigate({ to: '/reset-password' })}
              style={{ cursor: 'pointer' }}
            >
              ¿Olvidaste tu contraseña?
            </Anchor>
          </Stack>
        </Paper>

        <Text ta="center" size="sm" c="dimmed">
          ¿No tienes acceso?{' '}
          <Anchor onClick={() => navigate({ to: '/request-access' })} style={{ cursor: 'pointer' }}>
            Solicitar acceso a la beta
          </Anchor>
        </Text>
      </Stack>
    </Container>
  );
}
