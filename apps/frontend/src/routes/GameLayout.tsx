import {
  Badge,
  Box,
  Container,
  Group,
  Paper,
  ScrollArea,
  SimpleGrid,
  Skeleton,
  Tabs,
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

  const tabs = [
    { value: 'dashboard', label: 'Resumen' },
    { value: 'teams', label: 'Equipos' },
    { value: 'federations', label: 'Federaciones' },
    { value: 'market', label: 'Mercado' },
    { value: 'negotiations', label: 'Negociaciones' },
    { value: 'structure', label: 'Estructura' },
    { value: 'economy', label: 'Economía' },
    { value: 'norms', label: 'Normas' },
    { value: 'events', label: 'Eventos' },
    { value: 'cups', label: 'Copas' },
    { value: 'prizes', label: 'Premios' },
    { value: 'transfers', label: 'Fichajes' },
    { value: 'history', label: 'Historial' },
  ];

  return (
    <Container size="lg" py="lg">
      <Paper withBorder p="md" mb="md">
        {summary.isLoading || !summary.data ? (
          <Group>
            <Skeleton height={40} width={40} circle />
            <Box>
              <Skeleton height={18} width={160} mb={6} />
              <Skeleton height={14} width={120} />
            </Box>
            <Box ml="auto">
              <Skeleton height={50} width={300} />
            </Box>
          </Group>
        ) : (
          <Group justify="space-between">
            <div>
              <Text size="lg" fw={700}>
                {summary.data.federation.name}
              </Text>
              <Text size="sm" c="dimmed">
                {summary.data.name}
              </Text>
            </div>
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xl">
              <Stat label="Temporada" value={String(summary.data.year)} />
              <Stat
                label="Prestigio"
                value={`${summary.data.federation.prestige}`}
                extra={`Tier ${summary.data.federation.tier}`}
              />
              <Stat
                label="Jornada"
                value={
                  summary.data.seasonOver
                    ? 'Final'
                    : `${summary.data.currentMatchday}/${summary.data.totalMatchdays}`
                }
              />
              <Stat
                label="Impulsos"
                value={`${summary.data.impulsesRemaining}/${summary.data.impulsesPerSeason}`}
              />
            </SimpleGrid>
          </Group>
        )}
      </Paper>

      <Tabs value={active} onChange={go} mb="md">
        <ScrollArea.Autosize mx="auto" scrollbarSize={0}>
          <Tabs.List>
            {tabs.map((tab) => {
              const Icon = TAB_ICONS[tab.value as keyof typeof TAB_ICONS];
              const isEvents = tab.value === 'events';
              const hasPending = summary.data && summary.data.pendingEventsCount > 0;
              return (
                <Tooltip
                  key={tab.value}
                  label={tab.label}
                  position="bottom"
                  disabled={!isMobile}
                  withArrow
                >
                  <Tabs.Tab
                    value={tab.value}
                    leftSection={<Icon size={16} />}
                    rightSection={
                      isEvents && hasPending ? (
                        <Badge size="xs" color="yellow" variant="filled" circle>
                          {summary.data!.pendingEventsCount}
                        </Badge>
                      ) : undefined
                    }
                  >
                    {isMobile ? undefined : tab.label}
                  </Tabs.Tab>
                </Tooltip>
              );
            })}
          </Tabs.List>
        </ScrollArea.Autosize>
      </Tabs>

      <Outlet />
    </Container>
  );
}

function Stat({
  label,
  value,
  extra,
}: {
  label: string;
  value: string;
  extra?: string;
}) {
  return (
    <div>
      <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
        {label}
      </Text>
      <Group gap={6} align="baseline">
        <Text fw={700}>{value}</Text>
        {extra && (
          <Badge size="sm" variant="light" color="yellow">
            {extra}
          </Badge>
        )}
      </Group>
    </div>
  );
}
