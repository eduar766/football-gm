import { useState } from 'react';
import {
  Anchor,
  Box,
  Button,
  Container,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { IconCheck, IconLock } from '@tabler/icons-react';
import { api } from '../api';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  // token may be in the URL query string
  const search = useSearch({ strict: false }) as { token?: string };
  const tokenFromUrl = search?.token ?? '';

  const [email, setEmail] = useState('');
  const [token] = useState(tokenFromUrl);
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.requestReset(email.trim());
      setRequestSent(true);
    } catch {
      setError('Error al enviar el email. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    try {
      await api.resetPassword(token, newPassword);
      setDone(true);
      notifications.show({ color: 'green', icon: <IconCheck size={16} />, message: 'Contraseña restablecida' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Token inválido o expirado.');
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
            Restablecer contraseña
          </Title>
        </Box>

        {done ? (
          <Stack gap="md" ta="center">
            <Text c="green" fw={600}>Contraseña restablecida correctamente.</Text>
            <Anchor onClick={() => navigate({ to: '/login' })} style={{ cursor: 'pointer' }}>
              Ir al login
            </Anchor>
          </Stack>
        ) : requestSent && !token ? (
          <Stack gap="md" ta="center">
            <Text>Hemos enviado un enlace a <strong>{email}</strong>.</Text>
            <Text size="sm" c="dimmed">Revisa tu bandeja de entrada (y la carpeta de spam).</Text>
            <Anchor onClick={() => navigate({ to: '/login' })} style={{ cursor: 'pointer' }}>
              Volver al login
            </Anchor>
          </Stack>
        ) : token ? (
          <form onSubmit={(e) => { void handleReset(e); }}>
            <Stack gap="md">
              <PasswordInput
                label="Nueva contraseña"
                description="Mínimo 8 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.currentTarget.value)}
                required
                autoFocus
              />
              <PasswordInput
                label="Confirmar contraseña"
                value={confirm}
                onChange={(e) => setConfirm(e.currentTarget.value)}
                required
              />
              {error && <Text size="sm" c="red">{error}</Text>}
              <Button type="submit" loading={loading} fullWidth variant="gradient" gradient={{ from: '#10B981', to: '#059669' }}>
                Guardar nueva contraseña
              </Button>
            </Stack>
          </form>
        ) : (
          <form onSubmit={(e) => { void handleRequestReset(e); }}>
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                Introduce tu email y te enviaremos un enlace para restablecer tu contraseña.
              </Text>
              <TextInput
                label="Email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                required
                autoFocus
              />
              {error && <Text size="sm" c="red">{error}</Text>}
              <Button type="submit" loading={loading} fullWidth variant="gradient" gradient={{ from: '#10B981', to: '#059669' }}>
                Enviar enlace
              </Button>
              <Anchor size="sm" ta="center" onClick={() => navigate({ to: '/login' })} style={{ cursor: 'pointer' }}>
                Volver al login
              </Anchor>
            </Stack>
          </form>
        )}
      </Paper>
    </Container>
  );
}
