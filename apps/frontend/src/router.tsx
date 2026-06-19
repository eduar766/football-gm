import { lazy, Suspense } from 'react';
import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { Loader } from '@mantine/core';
import { RootLayout } from './App';
import { GamesPage } from './routes/GamesPage';
import { GameLayout } from './routes/GameLayout';
import { DashboardPage } from './routes/DashboardPage';
import { TeamsPage } from './routes/TeamsPage';
import { TeamDetailPage } from './routes/TeamDetailPage';
import { FederationPage } from './routes/FederationPage';
import { FederationsPage } from './routes/FederationsPage';
import { MarketPage } from './routes/MarketPage';
import { NegotiationsPage } from './routes/NegotiationsPage';
import { StructurePage } from './routes/StructurePage';
import { NormsPage } from './routes/NormsPage';
import { EventsPage } from './routes/EventsPage';
import { CupsPage } from './routes/CupsPage';
import { TransfersPage } from './routes/TransfersPage';
import { PrizesPage } from './routes/PrizesPage';

const EconomyPage = lazy(() =>
  import('./routes/EconomyPage').then((m) => ({ default: m.EconomyPage }))
);
const HistoryPage = lazy(() =>
  import('./routes/HistoryPage').then((m) => ({ default: m.HistoryPage }))
);

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<Loader />}>{children}</Suspense>;
}

const rootRoute = createRootRoute({ component: RootLayout });

const gamesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: GamesPage,
});

const gameRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'games/$gameId',
  component: GameLayout,
});

const dashboardRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: '/',
  component: DashboardPage,
});
const teamsRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: 'teams',
  component: TeamsPage,
});
const teamDetailRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: 'teams/$teamId',
  component: TeamDetailPage,
});
const federationRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: 'federation',
  component: FederationPage,
});
const federationsRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: 'federations',
  component: FederationsPage,
});
const marketRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: 'market',
  component: MarketPage,
});
const negotiationsRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: 'negotiations',
  component: NegotiationsPage,
});
const structureRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: 'structure',
  component: StructurePage,
});
const economyRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: 'economy',
  component: () => <SuspenseWrapper><EconomyPage /></SuspenseWrapper>,
});
const eventsRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: 'events',
  component: EventsPage,
});
const cupsRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: 'cups',
  component: CupsPage,
});
const normsRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: 'norms',
  component: NormsPage,
});
const historyRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: 'history',
  component: () => <SuspenseWrapper><HistoryPage /></SuspenseWrapper>,
});
const transfersRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: 'transfers',
  component: TransfersPage,
});
const prizesRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: 'prizes',
  component: PrizesPage,
});

const routeTree = rootRoute.addChildren([
  gamesRoute,
  gameRoute.addChildren([
    dashboardRoute,
    teamsRoute,
    teamDetailRoute,
    federationRoute,
    federationsRoute,
    marketRoute,
    negotiationsRoute,
    structureRoute,
    economyRoute,
    normsRoute,
    eventsRoute,
    cupsRoute,
    historyRoute,
    transfersRoute,
    prizesRoute,
  ]),
]);

export const router = createRouter({ routeTree, defaultPreload: 'intent' });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
