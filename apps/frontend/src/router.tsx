import { lazy, Suspense } from 'react';
import { createRootRoute, createRoute, createRouter, Outlet, redirect } from '@tanstack/react-router';
import { Center, Loader } from '@mantine/core';
import { RootLayout } from './App';
import { GamesPage } from './routes/GamesPage';
import { GameLayout } from './routes/GameLayout';
import { AdminPage } from './routes/AdminPage';
import { TOKEN_KEY } from './constants';

const DashboardPage = lazy(() => import('./routes/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const TeamsPage = lazy(() => import('./routes/TeamsPage').then((m) => ({ default: m.TeamsPage })));
const TeamDetailPage = lazy(() => import('./routes/TeamDetailPage').then((m) => ({ default: m.TeamDetailPage })));
const FederationPage = lazy(() => import('./routes/FederationPage').then((m) => ({ default: m.FederationPage })));
const FederationsPage = lazy(() => import('./routes/FederationsPage').then((m) => ({ default: m.FederationsPage })));
const MarketPage = lazy(() => import('./routes/MarketPage').then((m) => ({ default: m.MarketPage })));
const NegotiationsPage = lazy(() => import('./routes/NegotiationsPage').then((m) => ({ default: m.NegotiationsPage })));
const StructurePage = lazy(() => import('./routes/StructurePage').then((m) => ({ default: m.StructurePage })));
const EconomyPage = lazy(() => import('./routes/EconomyPage').then((m) => ({ default: m.EconomyPage })));
const NormsPage = lazy(() => import('./routes/NormsPage').then((m) => ({ default: m.NormsPage })));
const EventsPage = lazy(() => import('./routes/EventsPage').then((m) => ({ default: m.EventsPage })));
const CupsPage = lazy(() => import('./routes/CupsPage').then((m) => ({ default: m.CupsPage })));
const TransfersPage = lazy(() => import('./routes/TransfersPage').then((m) => ({ default: m.TransfersPage })));
const PrizesPage = lazy(() => import('./routes/PrizesPage').then((m) => ({ default: m.PrizesPage })));
const WorldPage = lazy(() => import('./routes/WorldPage').then((m) => ({ default: m.WorldPage })));
const HistoryPage = lazy(() => import('./routes/HistoryPage').then((m) => ({ default: m.HistoryPage })));
const LoginPage = lazy(() => import('./routes/LoginPage').then((m) => ({ default: m.LoginPage })));
const ChangePasswordPage = lazy(() => import('./routes/ChangePasswordPage').then((m) => ({ default: m.ChangePasswordPage })));
const ResetPasswordPage = lazy(() => import('./routes/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));
const RequestAccessPage = lazy(() => import('./routes/RequestAccessPage').then((m) => ({ default: m.RequestAccessPage })));

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<Center h="100vh"><Loader /></Center>}>{children}</Suspense>;
}

const rootRoute = createRootRoute({ component: RootLayout });

/* ---- public routes ---- */
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'login',
  component: () => <SuspenseWrapper><LoginPage /></SuspenseWrapper>,
});
const requestAccessRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'request-access',
  component: () => <SuspenseWrapper><RequestAccessPage /></SuspenseWrapper>,
});
const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'reset-password',
  component: () => <SuspenseWrapper><ResetPasswordPage /></SuspenseWrapper>,
});
const changePasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'change-password',
  component: () => <SuspenseWrapper><ChangePasswordPage /></SuspenseWrapper>,
});

/* ---- protected root ---- */
const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'protected',
  beforeLoad: () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) throw redirect({ to: '/login' });
  },
  component: Outlet,
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
  component: () => <SuspenseWrapper><DashboardPage /></SuspenseWrapper>,
});
const teamsRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: 'teams',
  component: () => <SuspenseWrapper><TeamsPage /></SuspenseWrapper>,
});
const teamDetailRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: 'teams/$teamId',
  component: () => <SuspenseWrapper><TeamDetailPage /></SuspenseWrapper>,
});
const federationRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: 'federation',
  component: () => <SuspenseWrapper><FederationPage /></SuspenseWrapper>,
});
const federationsRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: 'federations',
  component: () => <SuspenseWrapper><FederationsPage /></SuspenseWrapper>,
});
const federationDetailRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: 'federations/$fedId',
  component: () => <SuspenseWrapper><FederationPage /></SuspenseWrapper>,
});
const marketRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: 'market',
  component: () => <SuspenseWrapper><MarketPage /></SuspenseWrapper>,
});
const negotiationsRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: 'negotiations',
  component: () => <SuspenseWrapper><NegotiationsPage /></SuspenseWrapper>,
});
const structureRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: 'structure',
  component: () => <SuspenseWrapper><StructurePage /></SuspenseWrapper>,
});
const economyRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: 'economy',
  component: () => <SuspenseWrapper><EconomyPage /></SuspenseWrapper>,
});
const eventsRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: 'events',
  component: () => <SuspenseWrapper><EventsPage /></SuspenseWrapper>,
});
const cupsRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: 'cups',
  component: () => <SuspenseWrapper><CupsPage /></SuspenseWrapper>,
});
const normsRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: 'norms',
  component: () => <SuspenseWrapper><NormsPage /></SuspenseWrapper>,
});
const historyRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: 'history',
  component: () => <SuspenseWrapper><HistoryPage /></SuspenseWrapper>,
});
const transfersRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: 'transfers',
  component: () => <SuspenseWrapper><TransfersPage /></SuspenseWrapper>,
});
const prizesRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: 'prizes',
  component: () => <SuspenseWrapper><PrizesPage /></SuspenseWrapper>,
});
const worldRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: 'world',
  component: () => <SuspenseWrapper><WorldPage /></SuspenseWrapper>,
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
