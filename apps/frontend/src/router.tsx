import { lazy, Suspense } from 'react';
import { createRootRoute, createRoute, createRouter, Outlet, redirect } from '@tanstack/react-router';
import { Center, Loader } from '@mantine/core';
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
import { WorldPage } from './routes/WorldPage';
import { LoginPage } from './routes/LoginPage';
import { ChangePasswordPage } from './routes/ChangePasswordPage';
import { ResetPasswordPage } from './routes/ResetPasswordPage';
import { RequestAccessPage } from './routes/RequestAccessPage';
import { AdminPage } from './routes/AdminPage';

const TOKEN_KEY = 'fgm_token';

const EconomyPage = lazy(() =>
  import('./routes/EconomyPage').then((m) => ({ default: m.EconomyPage }))
);
const HistoryPage = lazy(() =>
  import('./routes/HistoryPage').then((m) => ({ default: m.HistoryPage }))
);

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<Center h="100vh"><Loader /></Center>}>{children}</Suspense>;
}

// Guard wrapper used by protected routes
function AuthGuard() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) throw redirect({ to: '/login' });
  return <Outlet />;
}

const rootRoute = createRootRoute({ component: RootLayout });

/* ---- public routes ---- */
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'login',
  component: LoginPage,
});
const requestAccessRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'request-access',
  component: RequestAccessPage,
});
const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'reset-password',
  component: ResetPasswordPage,
});
const changePasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'change-password',
  component: ChangePasswordPage,
});

/* ---- protected root ---- */
const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'protected',
  component: AuthGuard,
});

const gamesRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/',
  component: GamesPage,
});

const adminRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: 'admin',
  component: AdminPage,
});

const gameRoute = createRoute({
  getParentRoute: () => protectedRoute,
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
const federationDetailRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: 'federations/$fedId',
  component: FederationPage,
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
const worldRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: 'world',
  component: WorldPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  requestAccessRoute,
  resetPasswordRoute,
  changePasswordRoute,
  protectedRoute.addChildren([
    gamesRoute,
    adminRoute,
    gameRoute.addChildren([
      dashboardRoute,
      teamsRoute,
      teamDetailRoute,
      federationRoute,
      federationsRoute,
      federationDetailRoute,
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
      worldRoute,
    ]),
  ]),
]);

export const router = createRouter({ routeTree, defaultPreload: 'intent' });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
