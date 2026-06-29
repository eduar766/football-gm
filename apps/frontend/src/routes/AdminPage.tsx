import { useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Container,
  Group,
  Modal,
  Paper,
  PasswordInput,
  ScrollArea,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  IconArrowLeft,
  IconCheck,
  IconShield,
  IconUser,
  IconUserOff,
  IconUsers,
  IconX,
} from '@tabler/icons-react';
import type { AccessRequestDto } from '@football-gm/contracts';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';

function generatePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pwd = '';
  for (let i = 0; i < 10; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd;
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function RequestCard({
  req,
  onApprove,
  onReject,
}: {
  req: AccessRequestDto;
  onApprove: (req: AccessRequestDto) => void;
  onReject: (req: AccessRequestDto) => void;
}) {
  const isPending = req.status === 'pending';
  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between" align="flex-start">
        <Box style={{ flex: 1 }}>
          <Group gap="xs" mb={4}>
            <Text fw={700}>{req.name}</Text>
            <Text size="sm" c="dimmed">·</Text>
            <Text size="sm" c="dimmed">{req.email}</Text>
            {!isPending && (
              <Badge
                size="xs"
                color={req.status === 'approved' ? 'green' : 'red'}
                variant="light"
              >
                {req.status === 'approved' ? 'Aprobado' : 'Rechazado'}
              </Badge>
            )}
          </Group>
          <Text size="sm" c="dimmed" mb={4}>
            {formatDate(req.requestedAt)}
          </Text>
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
            {req.reason}
          </Text>
        </Box>
        {isPending && (
          <Group gap="xs" style={{ flexShrink: 0 }}>
            <Button
              size="xs"
              color="green"
              leftSection={<IconCheck size={14} />}
              onClick={() => onApprove(req)}
            >
              Aprobar
            </Button>
            <Button
              size="xs"
              variant="outline"
              color="red"
              leftSection={<IconX size={14} />}
              onClick={() => onReject(req)}
            >
              Rechazar
            </Button>
          </Group>
        )}
      </Group>
    </Paper>
  );
}

export function AdminPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [approveTarget, setApproveTarget] = useState<AccessRequestDto | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AccessRequestDto | null>(null);
  const [tempPassword, setTempPassword] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [approvedPassword, setApprovedPassword] = useState<string | null>(null);

  const requests = useQuery({
    queryKey: ['admin-requests'],
    queryFn: api.adminGetRequests,
  });

  const users = useQuery({
    queryKey: ['admin-users'],
    queryFn: api.adminGetUsers,
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      api.adminApproveRequest(id, password),
    onSuccess: (_, { password }) => {
      setApprovedPassword(password);
      void qc.invalidateQueries({ queryKey: ['admin-requests'] });
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: () => {
      notifications.show({ color: 'red', icon: <IconX size={16} />, message: 'Error al aprobar' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      api.adminRejectRequest(id, reason),
    onSuccess: () => {
      notifications.show({
        color: 'teal',
        icon: <IconCheck size={16} />,
        message: 'Solicitud rechazada',
      });
      setRejectTarget(null);
      setRejectReason('');
      void qc.invalidateQueries({ queryKey: ['admin-requests'] });
    },
    onError: () => {
      notifications.show({ color: 'red', icon: <IconX size={16} />, message: 'Error al rechazar' });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: number) => api.adminRevokeUser(id),
    onSuccess: () => {
      notifications.show({ color: 'orange', message: 'Acceso revocado' });
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => api.adminRestoreUser(id),
    onSuccess: () => {
      notifications.show({ color: 'green', icon: <IconCheck size={16} />, message: 'Acceso restaurado' });
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const handleOpenApprove = (req: AccessRequestDto) => {
    setApproveTarget(req);
    setApprovedPassword(null);
    setTempPassword(generatePassword());
  };

  const handleApprove = () => {
    if (!approveTarget) return;
    approveMutation.mutate({ id: approveTarget.id, password: tempPassword });
  };

  const handleReject = () => {
    if (!rejectTarget) return;
    rejectMutation.mutate({ id: rejectTarget.id, reason: rejectReason || undefined });
  };

  const pendingCount = requests.data?.pending.length ?? 0;

  return (
    <Container size="lg" py="xl">
      <Group mb="xl" align="center">
        <Button
          variant="subtle"
          color="gray"
          size="xs"
          leftSection={<IconArrowLeft size={14} />}
          onClick={() => navigate({ to: '/' })}
        >
          Mis partidas
        </Button>
        <Box style={{ flex: 1 }} />
        <Group gap="xs">
          <IconShield size={20} color="#F59E0B" />
          <Title order={4} style={{ color: '#F59E0B' }}>
            Panel Admin
          </Title>
          <Badge color="yellow" size="xs">
            {user?.email}
          </Badge>
        </Group>
      </Group>

      <Tabs defaultValue="requests">
        <Tabs.List mb="md">
          <Tabs.Tab
            value="requests"
            leftSection={<IconUser size={16} />}
            rightSection={
              pendingCount > 0 ? (
                <Badge size="xs" color="yellow" variant="filled" circle>
                  {pendingCount}
                </Badge>
              ) : undefined
            }
          >
            Solicitudes
          </Tabs.Tab>
          <Tabs.Tab value="users" leftSection={<IconUsers size={16} />}>
            Usuarios
          </Tabs.Tab>
        </Tabs.List>

        {/* TAB: SOLICITUDES */}
        <Tabs.Panel value="requests">
          <Stack gap="lg">
            <Box>
              <Text fw={600} mb="sm">
                Pendientes ({pendingCount})
              </Text>
              {requests.isLoading ? (
                <Text c="dimmed">Cargando...</Text>
              ) : pendingCount === 0 ? (
                <Text c="dimmed" size="sm">
                  No hay solicitudes pendientes.
                </Text>
              ) : (
                <Stack gap="sm">
                  {requests.data!.pending.map((req) => (
                    <RequestCard
                      key={req.id}
                      req={req}
                      onApprove={handleOpenApprove}
                      onReject={setRejectTarget}
                    />
                  ))}
                </Stack>
              )}
            </Box>

            {(requests.data?.reviewed.length ?? 0) > 0 && (
              <Box>
                <Text fw={600} mb="sm" c="dimmed">
                  Revisadas ({requests.data!.reviewed.length})
                </Text>
                <Stack gap="xs">
                  {requests.data!.reviewed.map((req) => (
                    <RequestCard
                      key={req.id}
                      req={req}
                      onApprove={handleOpenApprove}
                      onReject={setRejectTarget}
                    />
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        </Tabs.Panel>

        {/* TAB: USUARIOS */}
        <Tabs.Panel value="users">
          {users.isLoading ? (
            <Text c="dimmed">Cargando...</Text>
          ) : (
            <ScrollArea>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Email</Table.Th>
                    <Table.Th>Rol</Table.Th>
                    <Table.Th>Estado</Table.Th>
                    <Table.Th>Último acceso</Table.Th>
                    <Table.Th>Juegos</Table.Th>
                    <Table.Th>Acciones</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {users.data?.map((u) => (
                    <Table.Tr key={u.id}>
                      <Table.Td>
                        <Text size="sm" style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>
                          {u.email}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          size="xs"
                          color={u.role === 'admin' ? 'yellow' : 'teal'}
                          variant="light"
                        >
                          {u.role}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          size="xs"
                          color={u.approved ? 'green' : 'red'}
                          variant="dot"
                        >
                          {u.approved ? 'Activo' : 'Revocado'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {formatDate(u.lastActiveAt)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{u.gameCount}</Text>
                      </Table.Td>
                      <Table.Td>
                        {u.id !== user?.id && (
                          u.approved ? (
                            <Button
                              size="xs"
                              variant="subtle"
                              color="red"
                              leftSection={<IconUserOff size={13} />}
                              loading={revokeMutation.isPending}
                              onClick={() => revokeMutation.mutate(u.id)}
                            >
                              Revocar
                            </Button>
                          ) : (
                            <Button
                              size="xs"
                              variant="subtle"
                              color="green"
                              leftSection={<IconUser size={13} />}
                              loading={restoreMutation.isPending}
                              onClick={() => restoreMutation.mutate(u.id)}
                            >
                              Restaurar
                            </Button>
                          )
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          )}
        </Tabs.Panel>
      </Tabs>

      {/* APPROVE MODAL */}
      <Modal
        opened={!!approveTarget}
        onClose={() => { setApproveTarget(null); setApprovedPassword(null); }}
        title={`Aprobar solicitud — ${approveTarget?.name ?? ''}`}
        centered
        size="sm"
      >
        {approveTarget && (
          <Stack gap="md">
            {approvedPassword ? (
              <>
                <Box
                  p="md"
                  style={{
                    borderRadius: 8,
                    background: 'rgba(16,185,129,0.08)',
                    border: '1px solid rgba(16,185,129,0.25)',
                  }}
                >
                  <Text size="sm" c="dimmed" mb={4}>Solicitud aprobada. Email enviado a:</Text>
                  <Text fw={600}>{approveTarget.email}</Text>
                  <Text size="xs" c="dimmed" mt="xs">Contraseña temporal (solo visible ahora):</Text>
                  <Text
                    fw={700}
                    size="lg"
                    style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: '#10B981' }}
                  >
                    {approvedPassword}
                  </Text>
                </Box>
                <Button onClick={() => { setApproveTarget(null); setApprovedPassword(null); }}>
                  Cerrar
                </Button>
              </>
            ) : (
              <>
                <Text size="sm">
                  Se creará una cuenta para <strong>{approveTarget.email}</strong> y se le enviará
                  un email con la contraseña temporal.
                </Text>
                <PasswordInput
                  label="Contraseña temporal"
                  description="Generada automáticamente — puedes editarla"
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.currentTarget.value)}
                />
                <Group justify="flex-end">
                  <Button variant="default" onClick={() => setApproveTarget(null)}>
                    Cancelar
                  </Button>
                  <Button
                    color="green"
                    leftSection={<IconCheck size={14} />}
                    loading={approveMutation.isPending}
                    disabled={tempPassword.length < 8}
                    onClick={handleApprove}
                  >
                    Aprobar y enviar email
                  </Button>
                </Group>
              </>
            )}
          </Stack>
        )}
      </Modal>

      {/* REJECT MODAL */}
      <Modal
        opened={!!rejectTarget}
        onClose={() => { setRejectTarget(null); setRejectReason(''); }}
        title={`Rechazar solicitud — ${rejectTarget?.name ?? ''}`}
        centered
        size="sm"
      >
        {rejectTarget && (
          <Stack gap="md">
            <Text size="sm">
              Se notificará a <strong>{rejectTarget.email}</strong> que su solicitud no ha sido
              aprobada.
            </Text>
            <Textarea
              label="Motivo del rechazo (opcional)"
              placeholder="Se incluirá en el email de respuesta..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.currentTarget.value)}
              minRows={2}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setRejectTarget(null)}>
                Cancelar
              </Button>
              <Button
                color="red"
                leftSection={<IconX size={14} />}
                loading={rejectMutation.isPending}
                onClick={handleReject}
              >
                Rechazar
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Container>
  );
}
