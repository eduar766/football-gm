import type {
  AccessRequestDto,
  AdminUserDto,
  CommissionerReportsResponse,
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
  FederationLogResponse,
  MailboxResponse,
  PreseasonChecklistResponse,
  LoginResponse,
  MarketResponse,
  NegotiationDto,
  NextFixturesResponse,
  NormsResponse,
  NormType,
  PrizesResponse,
  StandingsResponse,
  StructureResponse,
  LevelingPlan,
  TransfersResponse,
  TeamDetail,
  TeamListItem,
  TeamEconomiesResponse,
  WorldRankingResponse,
  WorldStandingsResponse,
  SeasonReportsResponse,
  AssemblyStateResponse,
  ProposeMeasureRequest,
  PledgeKind,
} from '@football-gm/contracts';
import { TOKEN_KEY, API } from './constants';
import { ApiError } from './api-error';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API}${path}`, {
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...init,
  });
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = '/login';
    throw new ApiError(401, null, 'Unauthorized');
  }
  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, body, `${res.status} ${res.statusText}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    req<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => req<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  changePassword: (currentPassword: string, newPassword: string) =>
    req<{ ok: boolean }>('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  requestReset: (email: string) =>
    req<{ ok: boolean }>('/auth/request-reset', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token: string, newPassword: string) =>
    req<{ ok: boolean }>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) }),
  requestAccess: (name: string, email: string, reason: string) =>
    req<{ ok: boolean }>('/auth/request-access', { method: 'POST', body: JSON.stringify({ name, email, reason }) }),

  // Admin
  adminGetRequests: () =>
    req<{ pending: AccessRequestDto[]; reviewed: AccessRequestDto[] }>('/admin/requests'),
  adminApproveRequest: (id: number, temporaryPassword?: string) =>
    req<{ userId: number }>(`/admin/requests/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ temporaryPassword }),
    }),
  adminRejectRequest: (id: number, reason?: string) =>
    req<{ ok: boolean }>(`/admin/requests/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  adminGetUsers: () => req<AdminUserDto[]>('/admin/users'),
  adminRevokeUser: (id: number) => req<{ ok: boolean }>(`/admin/users/${id}`, { method: 'DELETE' }),
  adminRestoreUser: (id: number) =>
    req<{ ok: boolean }>(`/admin/users/${id}/restore`, { method: 'POST' }),

  // Games
  listGames: () => req<GameListItem[]>('/games'),
  createGame: (body: CreateGameRequest) =>
    req<{ id: number }>('/games', { method: 'POST', body: JSON.stringify(body) }),
  deleteGame: (id: number) => req<{ ok: boolean }>(`/games/${id}`, { method: 'DELETE' }),
  summary: (id: number) => req<GameSummary>(`/games/${id}`),
  preseasonChecklist: (id: number) =>
    req<PreseasonChecklistResponse>(`/games/${id}/preseason-checklist`),
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
  runLevelingLeague: (id: number, plan?: LevelingPlan) =>
    req<StructureResponse>(`/games/${id}/leveling-league`, {
      method: 'POST',
      body: JSON.stringify({ plan }),
    }),
  createOwnTeam: (id: number, name: string) =>
    req<StructureResponse>(`/games/${id}/teams`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  randomTeamName: (id: number) =>
    req<{ name: string }>(`/games/${id}/random-team-name`),
  teams: (id: number) => req<TeamListItem[]>(`/games/${id}/teams`),
  team: (id: number, teamId: number) =>
    req<TeamDetail>(`/games/${id}/teams/${teamId}`),
  federation: (id: number) => req<FederationOverview>(`/games/${id}/federation`),
  history: (id: number) => req<HistoryResponse>(`/games/${id}/history`),
  federationLog: (id: number) =>
    req<FederationLogResponse>(`/games/${id}/federation-log`),
  seasonReports: (id: number) =>
    req<SeasonReportsResponse>(`/games/${id}/season-reports`),
  mailbox: (id: number) => req<MailboxResponse>(`/games/${id}/mailbox`),
  markMailRead: (id: number, msgId: number) =>
    req<MailboxResponse>(`/games/${id}/mailbox/${msgId}/read`, { method: 'POST' }),
  markAllMailRead: (id: number) =>
    req<MailboxResponse>(`/games/${id}/mailbox/read-all`, { method: 'POST' }),
  resolveDemand: (id: number, demandId: number, accept: boolean, amount?: number) =>
    req<MailboxResponse>(`/games/${id}/demands/${demandId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ accept, amount }),
    }),
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
  accelerateNegotiation: (id: number, negId: number) =>
    req<NegotiationDto[]>(`/games/${id}/negotiations/accelerate`, {
      method: 'POST',
      body: JSON.stringify({ negId }),
    }),
  assembly: (id: number) => req<AssemblyStateResponse>(`/games/${id}/assembly`),
  proposeMeasure: (id: number, body: ProposeMeasureRequest) =>
    req<AssemblyStateResponse>(`/games/${id}/assembly/proposals`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  withdrawProposal: (id: number, proposalId: number) =>
    req<AssemblyStateResponse>(`/games/${id}/assembly/proposals/withdraw`, {
      method: 'POST',
      body: JSON.stringify({ proposalId }),
    }),
  revealIntention: (id: number, proposalId: number, teamId: number) =>
    req<AssemblyStateResponse>(`/games/${id}/assembly/proposals/reveal`, {
      method: 'POST',
      body: JSON.stringify({ proposalId, teamId }),
    }),
  buyVote: (id: number, proposalId: number, teamId: number) =>
    req<AssemblyStateResponse>(`/games/${id}/assembly/proposals/buy-vote`, {
      method: 'POST',
      body: JSON.stringify({ proposalId, teamId }),
    }),
  pledgeForVote: (id: number, proposalId: number, teamId: number, kind: PledgeKind, refId?: number, amount?: number) =>
    req<AssemblyStateResponse>(`/games/${id}/assembly/proposals/pledge`, {
      method: 'POST',
      body: JSON.stringify({ proposalId, teamId, kind, refId, amount }),
    }),
  economy: (id: number) => req<EconomyResponse>(`/games/${id}/economy`),
  setEconomyPolicy: (id: number, policy: { talentInvestment: number }) =>
    req<EconomyResponse>(`/games/${id}/economy/policy`, {
      method: 'POST',
      body: JSON.stringify(policy),
    }),
  prizes: (id: number) => req<PrizesResponse>(`/games/${id}/prizes`),
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
    req<PrizesResponse>(`/games/${id}/prizes/${prizeId}/remove`, { method: 'POST' }),
  signContract: (id: number, offerId: number) =>
    req<EconomyResponse>(`/games/${id}/economy/contracts`, {
      method: 'POST',
      body: JSON.stringify({ offerId }),
    }),
  cancelContract: (id: number, contractId: number) =>
    req<EconomyResponse>(`/games/${id}/economy/contracts/${contractId}/cancel`, { method: 'POST' }),
  teamEconomies: (id: number) => req<TeamEconomiesResponse>(`/games/${id}/economy/teams`),
  rescueTeam: (id: number, teamId: number, amount: number, withholdPrizes: boolean) =>
    req<TeamEconomiesResponse>(`/games/${id}/economy/rescue`, {
      method: 'POST',
      body: JSON.stringify({ teamId, amount, withholdPrizes }),
    }),
  compliance: (id: number) => req<ComplianceResponse>(`/games/${id}/economy/compliance`),
  transfers: (id: number) => req<TransfersResponse>(`/games/${id}/transfers`),
  norms: (id: number) => req<NormsResponse>(`/games/${id}/norms`),
  addNorm: (id: number, tipo: NormType, valor: number) =>
    req<NormsResponse>(`/games/${id}/norms`, {
      method: 'POST',
      body: JSON.stringify({ tipo, valor }),
    }),
  removeNorm: (id: number, normId: number) =>
    req<NormsResponse>(`/games/${id}/norms/${normId}/remove`, { method: 'POST' }),
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
  nextFixtures: (id: number) => req<NextFixturesResponse>(`/games/${id}/next-fixtures`),
  applyImpulse: (id: number, homeTeamId: number, awayTeamId: number, favoredTeamId: number) =>
    req<NextFixturesResponse>(`/games/${id}/impulses`, {
      method: 'POST',
      body: JSON.stringify({ homeTeamId, awayTeamId, favoredTeamId }),
    }),
  cups: (id: number) => req<CupsResponse>(`/games/${id}/cups`),
  createCup: (id: number, body: CreateCupRequest) =>
    req<CupsResponse>(`/games/${id}/cups`, { method: 'POST', body: JSON.stringify(body) }),
  editCup: (id: number, cupId: number, participantTeamIds: number[]) =>
    req<CupsResponse>(`/games/${id}/cups/${cupId}`, { method: 'PATCH', body: JSON.stringify({ participantTeamIds }) }),
  deleteCup: (id: number, cupId: number) =>
    req<CupsResponse>(`/games/${id}/cups/${cupId}`, { method: 'DELETE' }),
  createInterLeagueCup: (
    id: number,
    name: string,
    formato: string,
    playerTeamIds: number[],
    rivalFederationIds: number[],
  ) =>
    req<CupsResponse>(`/games/${id}/cups/inter-league`, {
      method: 'POST',
      body: JSON.stringify({ name, formato, playerTeamIds, rivalFederationIds }),
    }),
  worldRanking: (id: number) => req<WorldRankingResponse>(`/games/${id}/world-ranking`),
  worldStandings: (id: number) => req<WorldStandingsResponse>(`/games/${id}/world-standings`),
  commissionerReports: (id: number) => req<CommissionerReportsResponse>(`/games/${id}/commissioner-reports`),
  exportGame: (id: number) => req<{ name: string; state: unknown }>(`/games/${id}/export`),
  importGame: (name: string, state: unknown) =>
    req<{ id: number }>('/games/import', { method: 'POST', body: JSON.stringify({ name, state }) }),
  setLeagueFormat: (id: number, format: 'ida' | 'ida_vuelta') =>
    req<GameSummary>(`/games/${id}/league-format`, { method: 'POST', body: JSON.stringify({ format }) }),
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
  vetoTransfer: (id: number, playerId: number) =>
    req<GameSummary>(`/games/${id}/veto-transfer`, {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    }),
  cancelTransferVeto: (id: number, playerId: number) =>
    req<GameSummary>(`/games/${id}/veto-transfer/${playerId}`, { method: 'DELETE' }),
};
