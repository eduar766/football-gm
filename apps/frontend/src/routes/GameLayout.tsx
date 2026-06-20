import {
  Badge,
  Box,
  Container,
  Group,
  Paper,
  Skeleton,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import {
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from '@tanstack/react-router';
import {
  IconAddressBook,
  IconAward,
  IconBuildingBank,
  IconBuildingStore,
  IconClipboardList,
  IconCoin,
  IconExchange,
  IconHome,
  IconHierarchy,
  IconHistory,
  IconMessageCircle,
  IconTrophy,
  IconUsers,
} from '@tabler/icons-react';
import { api } from '../api';

const TAB_ICONS = {
  dashboard: IconHome,
  teams: IconUsers,
  federations: IconBuildingBank,
  market: IconBuildingStore,
  negotiations: IconAddressBook,
  structure: IconHierarchy,
  economy: IconCoin,
  norms: IconClipboardList,
  events: IconMessageCircle,
  cups: IconTrophy,
  prizes: IconAward,
  transfers: IconExchange,
  history: IconHistory,
} as const;

const NAV_SECTIONS = [
  {
    title: 'RESUMEN',
    items: [{ value: 'dashboard', label: 'Resumen' }],
  },
  {
    title: 'GESTIÓN',
    items: [
      { value: 'teams', label: 'Equipos' },
      { value: 'federations', label: 'Federaciones' },
      { value: 'market', label: 'Mercado' },
      { value: 'negotiations', label: 'Negociaciones' },
    ],
  },
  {
    title: 'OPERACIONES',
    items: [
      { value: 'structure', label: 'Estructura' },
      { value: 'economy', label: 'Economía' },
      { value: 'norms', label: 'Normas' },
      { value: 'events', label: 'Eventos' },
    ],
  },
  {
    title: 'COMPETICIONES',
    items: [
      { value: 'cups', label: 'Copas' },
      { value: 'prizes', label: 'Premios' },
    ],
  },
  {
    title: 'ARCHIVO',
    items: [
      { value: 'transfers', label: 'Fichajes' },
      { value: 'history', label: 'Historial' },
    ],
  },
] as const;

export function GameLayout() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');

  const summary = useQuery({
    queryKey: ['summary', id],
    queryFn: () => api.summary(id),
  });

  const p = location.pathname;
  const active = p.includes('/negotiations')
    ? 'negotiations'
    : p.includes('/federations')
      ? 'federations'
      : p.includes('/market')
        ? 'market'
        : p.includes('/structure')
          ? 'structure'
          : p.includes('/economy')
            ? 'economy'
            : p.includes('/norms')
              ? 'norms'
              : p.includes('/events')
                ? 'events'
                : p.includes('/cups')
                  ? 'cups'
                  : p.includes('/transfers')
                    ? 'transfers'
                    : p.includes('/prizes')
                      ? 'prizes'
                      : p.includes('/teams')
                        ? 'teams'
                        : p.includes('/history')
                          ? 'history'
                          : 'dashboard';

  const go = (value: string | null) => {
    const params = { gameId };
    if (value === 'teams') navigate({ to: '/games/$gameId/teams', params });
    else if (value === 'federations')
      navigate({ to: '/games/$gameId/federations', params });
    else if (value === 'market')
      navigate({ to: '/games/$gameId/market', params });
    else if (value === 'negotiations')
      navigate({ to: '/games/$gameId/negotiations', params });
    else if (value === 'structure')
      navigate({ to: '/games/$gameId/structure', params });
    else if (value === 'economy')
      navigate({ to: '/games/$gameId/economy', params });
    else if (value === 'norms')
      navigate({ to: '/games/$gameId/norms', params });
    else if (value === 'events')
      navigate({ to: '/games/$gameId/events', params });
    else if (value === 'cups')
      navigate({ to: '/games/$gameId/cups', params });
    else if (value === 'transfers')
      navigate({ to: '/games/$gameId/transfers', params });
    else if (value === 'prizes')
      navigate({ to: '/games/$gameId/prizes', params });
    else if (value === 'history')
      navigate({ to: '/games/$gameId/history', params });
    else navigate({ to: '/games/$gameId', params });
  };

  const hasPending = summary.data && summary.data.pendingEventsCount > 0;

  const headerContent = (
    <div>
      <Text fw={700} style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
        {summary.data?.federation.name ?? '...'}
      </Text>
      <Text size="sm" c="dimmed">
        {summary.data?.name ?? ''}
      </Text>
    </div>
  );

  const statPills = (
    <Stack gap={6}>
      <Stat
        label="Temporada"
        value={String(summary.data?.year ?? '—')}
        color="white"
      />
      <Stat
        label="Prestigio"
        value={String(summary.data?.federation.prestige ?? '—')}
        extra={`Tier ${summary.data?.federation.tier ?? '?'}`}
        color="#F59E0B"
      />
      <Stat
        label="Jornada"
        value={
          summary.data?.seasonOver
            ? 'Final'
            : `${summary.data?.currentMatchday ?? '?'}/${summary.data?.totalMatchdays ?? '?'}`
        }
        color="white"
      />
      <Stat
        label="Impulsos"
        value={`${summary.data?.impulsesRemaining ?? '?'}/${summary.data?.impulsesPerSeason ?? '?'}`}
        color="#8B5CF6"
      />
    </Stack>
  );

  if (isMobile) {
    return (
      <Box>
        <Box
          p="md"
          style={{
            borderBottom: '1px solid var(--mantine-color-default-border)',
            background: 'var(--mantine-color-dark-6)',
          }}
        >
          <Group justify="space-between" align="center">
            {headerContent}
          </Group>
        </Box>

        <Container size="xl" py="md">
          <Outlet />
        </Container>

        <Box
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            borderTop: '1px solid var(--mantine-color-default-border)',
            background: 'var(--mantine-color-dark-7)',
            overflowX: 'auto',
          }}
        >
          <Group
            gap={0}
            p={4}
            wrap="nowrap"
            style={{ minWidth: 'max-content' }}
          >
            {NAV_SECTIONS.map((section) =>
              section.items.map((item) => {
                const Icon = TAB_ICONS[item.value as keyof typeof TAB_ICONS];
                const isActive = active === item.value;
                const isEvents = item.value === 'events';
                return (
                  <Tooltip
                    key={item.value}
                    label={item.label}
                    position="top"
                    withArrow
                  >
                    <Box
                      onClick={() => go(item.value)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        padding: '6px 12px',
                        cursor: 'pointer',
                        borderRadius: 8,
                        background: isActive
                          ? 'rgba(16,185,129,0.08)'
                          : 'transparent',
                        borderBottom: isActive
                          ? '2px solid #10B981'
                          : '2px solid transparent',
                        position: 'relative',
                      }}
                    >
                      <Icon
                        size={18}
                        color={isActive ? '#10B981' : undefined}
                      />
                      {isEvents && hasPending && (
                        <Badge
                          size="xs"
                          color="yellow"
                          variant="filled"
                          circle
                          style={{
                            position: 'absolute',
                            top: 2,
                            right: 4,
                          }}
                        >
                          {summary.data!.pendingEventsCount}
                        </Badge>
                      )}
                    </Box>
                  </Tooltip>
                );
              })
            )}
          </Group>
        </Box>
      </Box>
    );
  }

  return (
    <Group gap={0} align="stretch" style={{ minHeight: '100vh' }}>
      <Paper
        style={{
          width: 220,
          minWidth: 220,
          minHeight: '100vh',
          borderRight: '1px solid var(--mantine-color-default-border)',
          display: 'flex',
          flexDirection: 'column',
        }}
        p="md"
      >
        <Box mb="lg">
          {summary.isLoading || !summary.data ? (
            <Group>
              <Skeleton height={40} width={40} circle />
              <Box>
                <Skeleton height={18} width={160} mb={6} />
                <Skeleton height={14} width={120} />
              </Box>
            </Group>
          ) : (
            headerContent
          )}
        </Box>

        <Box style={{ flex: 1 }}>
          {NAV_SECTIONS.map((section) => (
            <Box key={section.title} mb="md">
              <Text
                size="xs"
                c="dimmed"
                tt="uppercase"
                fw={500}
                p={8}
                pb={4}
              >
                {section.title}
              </Text>
              {section.items.map((item) => {
                const Icon = TAB_ICONS[item.value as keyof typeof TAB_ICONS];
                const isActive = active === item.value;
                const isEvents = item.value === 'events';
                return (
                  <Box
                    key={item.value}
                    onClick={() => go(item.value)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 10px',
                      marginLeft: -10,
                      marginRight: -10,
                      cursor: 'pointer',
                      borderRadius: 6,
                      borderLeft: isActive
                        ? '3px solid #10B981'
                        : '3px solid transparent',
                      background: isActive
                        ? 'rgba(16,185,129,0.08)'
                        : 'transparent',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background =
                          'rgba(255,255,255,0.04)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <Icon size={18} color={isActive ? '#10B981' : undefined} />
                    <Text size="sm" fw={isActive ? 600 : 400}>
                      {item.label}
                    </Text>
                    {isEvents && hasPending && (
                      <Badge
                        size="xs"
                        color="yellow"
                        variant="filled"
                        circle
                        ml="auto"
                      >
                        {summary.data!.pendingEventsCount}
                      </Badge>
                    )}
                  </Box>
                );
              })}
            </Box>
          ))}
        </Box>

        <Box pt="md" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
          {summary.isLoading || !summary.data ? (
            <Skeleton height={80} />
          ) : (
            statPills
          )}
        </Box>
      </Paper>

      <Container size="xl" py="lg" style={{ flex: 1 }}>
        <Outlet />
      </Container>
    </Group>
  );
}

function Stat({
  label,
  value,
  extra,
  color,
}: {
  label: string;
  value: string;
  extra?: string;
  color?: string;
}) {
  return (
    <Box>
      <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
        {label}
      </Text>
      <Group gap={6} align="baseline">
        <Text
          fw={700}
          style={{
            fontFamily: '"Geist Mono", monospace',
            color: color ?? 'white',
          }}
        >
          {value}
        </Text>
        {extra && (
          <Badge size="sm" variant="light" color="yellow">
            {extra}
          </Badge>
        )}
      </Group>
    </Box>
  );
}
