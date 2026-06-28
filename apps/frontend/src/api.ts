import type {
  ComplianceResponse,
  CreateCupRequest,
  CreateGameRequest,
  CupsResponse,
  EconomyResponse,
  EventAction,
  EventsResponse,
  FederationListItem,
  FederationOverview,
  GameListItem,
  GameSummary,
  HistoryResponse,
  MarketResponse,
  NegotiationDto,
  NextFixturesResponse,
  NormsResponse,
  NormType,
  PrizesResponse,
  StandingsResponse,
  StructureResponse,
  TransfersResponse,
  TeamDetail,
  TeamListItem,
} from '@football-gm/contracts';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { 'content-type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listGames: () => req<GameListItem[]>('/games'),
  createGame: (body: CreateGameRequest) =>
    req<{ id: number }>('/games', { method: 'POST', body: JSON.stringify(body) }),
  summary: (id: number) => req<GameSummary>(`/games/${id}`),
  startSeason: (id: number) =>
    req<GameSummary>(`/games/${id}/start-season`, { method: 'POST' }),
  advanceMatchday: (id: number) =>
    req<GameSummary>(`/games/${id}/advance-matchday`, { method: 'POST' }),
  advanceSeason: (id: number) =>
    req<GameSummary>(`/games/${id}/advance-season`, { method: 'POST' }),
  closeSeason: (id: number) =>
    req<GameSummary>(`/games/${id}/close-season`, { method: 'POST' }),
  standings: (id: number, division = 1) =>
    req<StandingsResponse>(`/games/${id}/standings?division=${division}`),
  structure: (id: number) => req<StructureResponse>(`/games/${id}/structure`),
  runLevelingLeague: (id: number) =>
    req<StructureResponse>(`/games/${id}/leveling-league`, { method: 'POST' }),
  createOwnTeam: (id: number, name: string) =>
    req<StructureResponse>(`/games/${id}/teams`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  teams: (id: number) => req<TeamListItem[]>(`/games/${id}/teams`),
  team: (id: number, teamId: number) =>
    req<TeamDetail>(`/games/${id}/teams/${teamId}`),
  federation: (id: number) => req<FederationOverview>(`/games/${id}/federation`),
  history: (id: number) => req<HistoryResponse>(`/games/${id}/history`),
  federations: (id: number) => req<FederationListItem[]>(`/games/${id}/federations`),
  federationById: (id: number, fedId: number) =>
    req<FederationOverview>(`/games/${id}/federations/${fedId}`),
  market: (id: number) => req<MarketResponse>(`/games/${id}/market`),
  negotiations: (id: number) => req<NegotiationDto[]>(`/games/${id}/negotiations`),
  startNegotiation: (id: number, targetTeamId: number) =>
    req<NegotiationDto[]>(`/games/${id}/negotiations`, {
      method: 'POST',
      body: JSON.stringify({ targetTeamId }),
    }),
  setOfferValue: (id: number, negId: number, offerValue: number) =>
    req<NegotiationDto[]>(`/games/${id}/negotiations/offer-value`, {
      method: 'PATCH',
      body: JSON.stringify({ negId, offerValue }),
    }),
  economy: (id: number) => req<EconomyResponse>(`/games/${id}/economy`),
  setEconomyPolicy: (
    id: number,
    policy: { talentInvestment: number },
  ) =>
    req<EconomyResponse>(`/games/${id}/economy/policy`, {
      method: 'POST',
      body: JSON.stringify(policy),
    }),
  prizes: (id: number) =>
    req<PrizesResponse>(`/games/${id}/prizes`),
  setLeaguePrize: (id: number, pool: number, shares: number[]) =>
    req<PrizesResponse>(`/games/${id}/prizes/league`, {
      method: 'POST',
      body: JSON.stringify({ pool, shares }),
    }),
  setCupPrize: (id: number, cupId: number, pool: number, shares: number[]) =>
    req<PrizesResponse>(`/games/${id}/prizes/cup`, {
      method: 'POST',
      body: JSON.stringify({ cupId, pool, shares }),
    }),
  removePrize: (id: number, prizeId: number) =>
    req<PrizesResponse>(`/games/${id}/prizes/${prizeId}/remove`, {
      method: 'POST',
    }),
  signContract: (id: number, offerId: number) =>
    req<EconomyResponse>(`/games/${id}/economy/contracts`, {
      method: 'POST',
      body: JSON.stringify({ offerId }),
    }),
  cancelContract: (id: number, contractId: number) =>
    req<EconomyResponse>(
      `/games/${id}/economy/contracts/${contractId}/cancel`,
      { method: 'POST' },
    ),
  compliance: (id: number) =>
    req<ComplianceResponse>(`/games/${id}/economy/compliance`),
  transfers: (id: number) =>
    req<TransfersResponse>(`/games/${id}/transfers`),
  norms: (id: number) => req<NormsResponse>(`/games/${id}/norms`),
  addNorm: (id: number, tipo: NormType, valor: number) =>
    req<NormsResponse>(`/games/${id}/norms`, {
      method: 'POST',
      body: JSON.stringify({ tipo, valor }),
    }),
  removeNorm: (id: number, normId: number) =>
    req<NormsResponse>(`/games/${id}/norms/${normId}/remove`, {
      method: 'POST',
    }),
  sanction: (id: number, teamId: number, normId: number) =>
    req<NormsResponse>(`/games/${id}/sanctions`, {
      method: 'POST',
      body: JSON.stringify({ teamId, normId }),
    }),
  events: (id: number) => req<EventsResponse>(`/games/${id}/events`),
  resolveEvent: (id: number, eventId: number, action: EventAction) =>
    req<EventsResponse>(`/games/${id}/events/${eventId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),
  nextFixtures: (id: number) =>
    req<NextFixturesResponse>(`/games/${id}/next-fixtures`),
  applyImpulse: (
    id: number,
    homeTeamId: number,
    awayTeamId: number,
    favoredTeamId: number,
  ) =>
    req<NextFixturesResponse>(`/games/${id}/impulses`, {
      method: 'POST',
      body: JSON.stringify({ homeTeamId, awayTeamId, favoredTeamId }),
    }),
  cups: (id: number) => req<CupsResponse>(`/games/${id}/cups`),
  createCup: (id: number, body: CreateCupRequest) =>
    req<CupsResponse>(`/games/${id}/cups`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  setLeagueFormat: (id: number, format: 'ida' | 'ida_vuelta') =>
    req<GameSummary>(`/games/${id}/league-format`, {
      method: 'POST',
      body: JSON.stringify({ format }),
    }),
  callReview: (id: number, matchday: number, homeTeamId: number, awayTeamId: number) =>
    req<GameSummary>(`/games/${id}/call-review`, {
      method: 'POST',
      body: JSON.stringify({ matchday, homeTeamId, awayTeamId }),
    }),
  emergencyMeeting: (id: number, teamId: number) =>
    req<GameSummary>(`/games/${id}/emergency-meeting`, {
      method: 'POST',
      body: JSON.stringify({ teamId }),
    }),
  postponeMatchday: (id: number) =>
    req<GameSummary>(`/games/${id}/postpone-matchday`, { method: 'POST' }),
  cultivateArraigo: (id: number, teamId: number) =>
    req<GameSummary>(`/games/${id}/cultivate-arraigo`, {
      method: 'POST',
      body: JSON.stringify({ teamId }),
    }),
};
