import { useState } from 'react';
import {
  Anchor,
  Box,
  Button,
  Container,
  Paper,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useNavigate } from '@tanstack/react-router';
import { IconCheck, IconSend, IconTrophy } from '@tabler/icons-react';
import { api } from '../api';

export function RequestAccessPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (name.trim().length < 2) {
      setError('El nombre debe tener al menos 2 caracteres.');
      return;
    }
    if (reason.trim().length < 20) {
      setError('El motivo debe tener al menos 20 caracteres.');
      return;
    }

    setLoading(true);
    try {
      await api.requestAccess(name.trim(), email.trim(), reason.trim());
      setSent(true);
      notifications.show({
        color: 'green',
        icon: <IconCheck size={16} />,
        message: 'Solicitud enviada correctamente',
      });
    } catch {
      setError('Error al enviar la solicitud. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size={480} py={80}>
      <Paper p="xl" withBorder radius="lg">
        <Box ta="center" mb="lg">
          <IconTrophy size={36} color="#10B981" />
          <Title order={3} mt="sm">
            Solicitar acceso beta
          </Title>
          <Text size="sm" c="dimmed" mt={4}>
            Football GM es una beta privada. Cuéntanos quién eres y te damos acceso.
          </Text>
        </Box>

        {sent ? (
          <Stack gap="md" ta="center">
            <Box
              p="md"
              style={{
                borderRadius: 8,
                background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.25)',
              }}
            >
              <IconCheck size={28} color="#10B981" />
              <Text fw={600} mt="xs">Solicitud enviada</Text>
              <Text size="sm" c="dimmed" mt={4}>
                Te avisaremos por email cuando revisemos tu solicitud. Puede tardar unos días.
              </Text>
            </Box>
            <Anchor
              size="sm"
              onClick={() => navigate({ to: '/login' })}
              style={{ cursor: 'pointer' }}
            >
              ← Volver al login
            </Anchor>
          </Stack>
        ) : (
          <form onSubmit={(e) => { void handleSubmit(e); }}>
            <Stack gap="md">
              <TextInput
                label="Nombre completo"
                placeholder="Tu nombre"
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                required
                autoFocus
              />
              <TextInput
                label="Email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                required
              />
              <Textarea
                label="¿Por qué quieres participar en la beta?"
                placeholder="Cuéntanos brevemente qué te interesa del juego..."
                value={reason}
                onChange={(e) => setReason(e.currentTarget.value)}
                minRows={3}
                maxRows={6}
                required
                description={`${reason.length}/300 caracteres (mínimo 20)`}
                styles={{
                  description: {
                    color: reason.length > 300 ? 'var(--mantine-color-red-5)' : undefined,
                  },
                }}
              />
              {error && (
                <Text size="sm" c="red">
                  {error}
                </Text>
              )}
              <Button
                type="submit"
                loading={loading}
                disabled={reason.length > 300}
                fullWidth
                leftSection={<IconSend size={16} />}
                variant="gradient"
                gradient={{ from: '#10B981', to: '#059669' }}
              >
                Enviar solicitud
              </Button>
              <Text size="sm" ta="center" c="dimmed">
                ¿Ya tienes cuenta?{' '}
                <Anchor onClick={() => navigate({ to: '/login' })} style={{ cursor: 'pointer' }}>
                  Iniciar sesión
                </Anchor>
              </Text>
            </Stack>
          </form>
        )}
      </Paper>
    </Container>
  );
}
