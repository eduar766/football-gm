import { useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Container,
  Group,
  Modal,
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
  const confidence = summary.data?.boardConfidence?.value ?? null;
  const gameOver = summary.data?.gameOver ?? null;

  const isPre = summary.data?.phase === 'pretemporada';
  const phaseColor = isPre ? theme.colors.gold[5] : theme.colors.accent[3];
  const phaseChip = summary.data ? (
    <Box
      py={7}
      px={11}
      mt="sm"
      mb="sm"
      style={{
        borderRadius: 9,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: isPre ? 'rgba(245,158,11,0.10)' : 'rgba(16,185,129,0.08)',
        border: `1px solid ${isPre ? 'rgba(245,158,11,0.28)' : 'rgba(16,185,129,0.22)'}`,
      }}
    >
      <Box
        className="pulse-dot"
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: phaseColor,
          flexShrink: 0,
        }}
      />
      <Text
        size="xs"
        fw={700}
        tt="uppercase"
        style={{
          color: phaseColor,
          letterSpacing: '0.06em',
          fontFamily: theme.fontFamilyMonospace,
        }}
      >
        {isPre
          ? `Pretemporada · Año ${summary.data.year}`
          : summary.data.seasonOver
            ? `Temporada ${summary.data.year} · Final`
            : `Temporada · J${summary.data.currentMatchday}/${summary.data.totalMatchdays}`}
      </Text>
    </Box>
  ) : null;

  const headerContent = (
    <Group gap="sm" wrap="nowrap" align="center">
      <Box
        style={{
          width: 40,
          height: 40,
          flexShrink: 0,
          borderRadius: 11,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(16,185,129,0.10)',
          border: '1px solid rgba(16,185,129,0.28)',
          boxShadow: '0 0 18px -6px rgba(16,185,129,0.6)',
        }}
      >
        <img
          src="/logo.png"
          alt="Football GM"
          style={{ width: 28, height: 28, objectFit: 'contain' }}
        />
      </Box>
      <div style={{ minWidth: 0 }}>
        <Text
          component="div"
          className="hud-eyebrow"
          style={{ fontSize: 9, letterSpacing: '0.16em' }}
        >
          Comisionado
        </Text>
        <Text
          fw={700}
          size="sm"
          truncate
          style={{ fontFamily: 'var(--font-display)', lineHeight: 1.2 }}
        >
          {summary.data?.federation.name ?? '...'}
        </Text>
        <Text size="xs" c="dimmed" truncate>
          {summary.data?.name ?? ''}
        </Text>
      </div>
    </Group>
  );

  const statPills = (
    <Box
      p="sm"
      mb="sm"
      style={{
        borderRadius: 12,
        background: 'var(--surface-2)',
        border: '1px solid var(--border-1)',
      }}
    >
      <Text component="div" className="hud-eyebrow" mb={8} style={{ fontSize: 9 }}>
        Estado de la liga
      </Text>
      <Stack gap={10}>
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
      <Stat
        label="Confianza junta"
        value={`${summary.data?.boardConfidence?.value ?? '—'}/100`}
        color={
          confidence == null
            ? 'white'
            : confidence <= 30
              ? theme.colors.red[5]
              : confidence < 60
                ? theme.colors.gold[5]
                : theme.colors.accent[4]
        }
      />
      </Stack>
    </Box>
  );

  const gameOverModal = (
    <Modal
      opened={!!gameOver}
      onClose={() => {}}
      withCloseButton={false}
      centered
      closeOnClickOutside={false}
      closeOnEscape={false}
      title={<Text fw={800} c="red">Has sido destituido</Text>}
    >
      <Stack>
        <Text size="sm">{gameOver?.message}</Text>
        <Text size="xs" c="dimmed">
          Temporada {gameOver?.year}. Tu etapa como comisionado/a ha terminado.
        </Text>
        <Group justify="flex-end">
          <Button variant="light" onClick={() => navigate({ to: '/' })}>
            Volver al inicio
          </Button>
        </Group>
      </Stack>
    </Modal>
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
        {gameOverModal}

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
        radius={0}
        style={{
          width: 236,
          minWidth: 236,
          minHeight: '100vh',
          position: 'sticky',
          top: 0,
          alignSelf: 'flex-start',
          height: '100vh',
          overflowY: 'auto',
          borderRight: '1px solid var(--border-2)',
          background:
            'linear-gradient(180deg, #0c1219 0%, var(--surface-0) 100%)',
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
                component="div"
                className="hud-eyebrow"
                px={8}
                pb={6}
                pt={2}
                style={{ fontSize: 9.5 }}
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
                      gap: 10,
                      padding: '7px 10px',
                      marginLeft: -6,
                      marginRight: -6,
                      cursor: 'pointer',
                      borderRadius: 9,
                      position: 'relative',
                      borderLeft: isActive
                        ? `2px solid ${theme.colors.accent[3]}`
                        : '2px solid transparent',
                      background: isActive
                        ? 'linear-gradient(90deg, rgba(16,185,129,0.16), rgba(16,185,129,0.03))'
                        : 'transparent',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background =
                          'rgba(148,176,205,0.06)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <Icon
                      size={18}
                      stroke={isActive ? 2.1 : 1.7}
                      color={isActive ? theme.colors.accent[3] : '#8695A6'}
                    />
                    <Text
                      size="sm"
                      fw={isActive ? 700 : 500}
                      style={{
                        color: isActive ? '#EAF2F8' : '#B4C0CC',
                        fontFamily: isActive ? 'var(--font-display)' : undefined,
                        letterSpacing: isActive ? '0.01em' : undefined,
                      }}
                    >
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
      {gameOverModal}
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
    <Group
      justify="space-between"
      align="center"
      wrap="nowrap"
      aria-label={`${label}: ${value}${extra ? ` (${extra})` : ''}`}
    >
      <Text
        component="span"
        className="hud-eyebrow"
        style={{ fontSize: 10, letterSpacing: '0.08em' }}
      >
        {label}
      </Text>
      <Group gap={6} align="baseline" wrap="nowrap">
        <Text
          fw={700}
          style={{
            fontFamily: theme.fontFamilyMonospace,
            fontSize: 15,
            color: color ?? 'white',
          }}
        >
          {value}
        </Text>
        {extra && (
          <Badge size="sm" variant="light" color="gold">
            {extra}
          </Badge>
        )}
      </Group>
    </Group>
  );
}
