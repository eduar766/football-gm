import { useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Container,
  Group,
  Paper,
  Skeleton,
  Stack,
  Text,
  Tooltip,
  useMantineTheme,
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
  IconGlobe,
  IconHome,
  IconInbox,
  IconHierarchy,
  IconHistory,
  IconMessageCircle,
  IconTrophy,
  IconUsers,
} from '@tabler/icons-react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { BugReportBanner } from '../components/BugReportBanner';
import { ChangelogModal } from '../components/ChangelogModal';
import { CURRENT_VERSION } from '../changelog';

const TAB_ICONS = {
  dashboard: IconHome,
  mailbox: IconInbox,
  world: IconGlobe,
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
    items: [
      { value: 'dashboard', label: 'Resumen' },
      { value: 'mailbox', label: 'Buzón' },
      { value: 'world', label: 'Mundo' },
    ],
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

const ROUTES: Record<string, string> = {
  negotiations: '/games/$gameId/negotiations',
  federations: '/games/$gameId/federations',
  market: '/games/$gameId/market',
  structure: '/games/$gameId/structure',
  economy: '/games/$gameId/economy',
  norms: '/games/$gameId/norms',
  events: '/games/$gameId/events',
  cups: '/games/$gameId/cups',
  transfers: '/games/$gameId/transfers',
  prizes: '/games/$gameId/prizes',
  teams: '/games/$gameId/teams',
  history: '/games/$gameId/history',
  world: '/games/$gameId/world',
  mailbox: '/games/$gameId/mailbox',
  dashboard: '/games/$gameId',
};

const ROUTE_KEYS = Object.keys(ROUTES) as string[];

export function GameLayout() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { logout } = useAuth();
  const [changelogOpen, setChangelogOpen] = useState(false);
  const theme = useMantineTheme();

  const summary = useQuery({
    queryKey: ['summary', id],
    queryFn: () => api.summary(id),
  });

  const p = location.pathname;
  const active = ROUTE_KEYS.find((k) => k !== 'dashboard' && p.includes(`/${k}`)) ?? 'dashboard';

  const go = (value: string | null) => {
    const to = (value && ROUTES[value]) ?? ROUTES.dashboard;
    navigate({ to, params: { gameId } });
  };

  const hasPending = summary.data && summary.data.pendingEventsCount > 0;
  const hasNormBreaches = summary.data && summary.data.normBreachCount > 0;
  const unreadMail = summary.data?.unreadMailCount ?? 0;

  const phaseChip = summary.data ? (
    <Box
      py={6}
      px={10}
      mb="sm"
      style={{
        borderRadius: 8,
        background: summary.data.phase === 'pretemporada'
          ? 'rgba(245,158,11,0.12)'
          : 'rgba(16,185,129,0.10)',
        border: `1px solid ${summary.data.phase === 'pretemporada' ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.25)'}`,
      }}
    >
      <Text
        size="xs"
        fw={700}
        tt="uppercase"
        style={{
          color: summary.data.phase === 'pretemporada' ? theme.colors.gold[5] : theme.colors.accent[4],
          letterSpacing: '0.04em',
          fontFamily: theme.fontFamilyMonospace,
        }}
      >
        {summary.data.phase === 'pretemporada'
          ? `Pretemporada · Año ${summary.data.year}`
          : summary.data.seasonOver
            ? `Temporada ${summary.data.year} · Final`
            : `Temporada · J${summary.data.currentMatchday}/${summary.data.totalMatchdays}`}
      </Text>
    </Box>
  ) : null;

  const headerContent = (
    <Group gap="xs" wrap="nowrap" align="center">
      <img
        src="/logo.png"
        alt="Football GM"
        style={{ width: 36, height: 36, objectFit: 'contain', flexShrink: 0 }}
      />
      <div>
        <Text fw={700} size="sm" style={{ fontFamily: theme.headings.fontFamily }}>
          {summary.data?.federation.name ?? '...'}
        </Text>
        <Text size="xs" c="dimmed">
          {summary.data?.name ?? ''}
        </Text>
      </div>
    </Group>
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
        color={theme.colors.gold[5]}
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
        color={theme.colors.violet[5]}
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
                const isMailbox = item.value === 'mailbox';
                return (
                  <Tooltip
                    key={item.value}
                    label={item.label}
                    position="top"
                    withArrow
                  >
                    <Box
                      onClick={() => go(item.value)}
                      role="button"
                      tabIndex={0}
                      aria-label={item.label}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          go(item.value);
                        }
                      }}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        padding: '6px 12px',
                        cursor: 'pointer',
                        borderRadius: 8,
                        background: isActive
                        ? `${theme.colors.accent[4]}14`
                        : 'transparent',
                      borderBottom: isActive
                        ? `2px solid ${theme.colors.accent[4]}`
                        : '2px solid transparent',
                        position: 'relative',
                      }}
                    >
                      <Icon
                        size={18}
                        color={isActive ? theme.colors.accent[4] : undefined}
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
                      {isMailbox && unreadMail > 0 && (
                        <Badge
                          size="xs"
                          color="blue"
                          variant="filled"
                          circle
                          style={{ position: 'absolute', top: 2, right: 4 }}
                        >
                          {unreadMail}
                        </Badge>
                      )}
                    </Box>
                  </Tooltip>
                );
              })
            )}
          </Group>
        </Box>
      <BugReportBanner />
      <ChangelogModal opened={changelogOpen} onClose={() => setChangelogOpen(false)} />
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
          {summary.isLoading ? (
            <Skeleton height={28} mt={8} radius="md" />
          ) : (
            phaseChip
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
                const isNorms = item.value === 'norms';
                const isMailbox = item.value === 'mailbox';
                return (
                  <Box
                    key={item.value}
                    onClick={() => go(item.value)}
                    role="button"
                    tabIndex={0}
                    aria-label={item.label}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        go(item.value);
                      }
                    }}
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
                        ? `3px solid ${theme.colors.accent[4]}`
                        : '3px solid transparent',
                      background: isActive
                        ? `${theme.colors.accent[4]}14`
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
                    <Icon size={18} color={isActive ? theme.colors.accent[4] : undefined} />
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
                    {isNorms && hasNormBreaches && !hasPending && (
                      <Badge
                        size="xs"
                        color="red"
                        variant="filled"
                        circle
                        ml="auto"
                      >
                        {summary.data!.normBreachCount}
                      </Badge>
                    )}
                    {isMailbox && unreadMail > 0 && (
                      <Badge
                        size="xs"
                        color="blue"
                        variant="filled"
                        circle
                        ml="auto"
                      >
                        {unreadMail}
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
          <Button
            size="xs"
            variant="subtle"
            color="gray"
            fullWidth
            mt="sm"
            onClick={() => { navigate({ to: '/' }); }}
          >
            ← Mis partidas
          </Button>
          <Button
            size="xs"
            variant="subtle"
            color="gray"
            fullWidth
            mt={4}
            onClick={logout}
          >
            Cerrar sesión
          </Button>
          <Button
            size="xs"
            variant="subtle"
            color="teal"
            fullWidth
            mt={4}
            onClick={() => setChangelogOpen(true)}
          >
            <Group gap={6} justify="center">
              <Text size="xs">Novedades</Text>
              <Badge size="xs" color="teal" variant="outline">{CURRENT_VERSION}</Badge>
            </Group>
          </Button>
        </Box>
      </Paper>

      <Container size="xl" py="lg" style={{ flex: 1 }}>
        <Outlet />
      </Container>

      <BugReportBanner />
      <ChangelogModal opened={changelogOpen} onClose={() => setChangelogOpen(false)} />
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
  const theme = useMantineTheme();
  return (
    <Box aria-label={`${label}: ${value}${extra ? ` (${extra})` : ''}`}>
      <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
        {label}
      </Text>
      <Group gap={6} align="baseline">
        <Text
          fw={700}
          style={{
            fontFamily: theme.fontFamilyMonospace,
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
