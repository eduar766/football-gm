import { z } from 'zod';
import type {
  AwardType as EngineAwardType,
  CommercialContractType as EngineCommercialContractType,
  MandateType as EngineMandateType,
  NegotiationState as EngineNegotiationStateUnion,
  NormType as EngineNormType,
  PlayerPosition as EnginePlayerPosition,
  SeasonPhase as EngineSeasonPhase,
} from '@football-gm/engine';

// Single source of truth for the back/front contract. Backend validates with
// these at the boundary; frontend infers its types from the same schemas.
// Enum arrays use `satisfies` against the engine union type so the compiler
// catches removals immediately; additions in the engine generate a type error
// that forces a matching update here.

/* ----------------------------------------------------------------- enums */

export const CompetitionType = z.enum([
  'liga',
  'copa',
  'liga_juvenil',
  'torneo_verano',
  'liga_nivelacion',
]);
export type CompetitionType = z.infer<typeof CompetitionType>;

// These const arrays use `satisfies` to cross-validate against engine union types.
// If the engine removes a value, TypeScript errors here immediately.
// If the engine adds a value, add it here too (one-directional guard).
const _negotiationStateValues = [
  'gathering_requirements', 'offer', 'accepted', 'effective', 'rejected',
] as const satisfies [EngineNegotiationStateUnion, ...EngineNegotiationStateUnion[]];

const _commercialContractTypeValues = [
  'patrocinio', 'publicidad', 'derechos_tv', 'derechos_imagen',
] as const satisfies [EngineCommercialContractType, ...EngineCommercialContractType[]];

const _awardTypeValues = [
  'max_goleador', 'max_asistente', 'mejor_portero',
] as const satisfies [EngineAwardType, ...EngineAwardType[]];

const _playerPositionValues = [
  'POR', 'DEF', 'MED', 'DEL',
] as const satisfies [EnginePlayerPosition, ...EnginePlayerPosition[]];

export const EngineNegotiationState = z.enum(_negotiationStateValues);
export type EngineNegotiationState = z.infer<typeof EngineNegotiationState>;

export const CommercialContractType = z.enum(_commercialContractTypeValues);
export type CommercialContractType = z.infer<typeof CommercialContractType>;

export const AwardType = z.enum(_awardTypeValues);
export type AwardType = z.infer<typeof AwardType>;

export const PlayerPosition = z.enum(_playerPositionValues);
export type PlayerPosition = z.infer<typeof PlayerPosition>;

export const Id = z.number().int().positive();
export type Id = z.infer<typeof Id>;

export const Tier = z.number().int().min(1).max(5);
export type Tier = z.infer<typeof Tier>;

/* ------------------------------------------------------ requests / loop */

export const CreateGameRequest = z.object({
  name: z.string().min(1).max(80),
  seed: z.number().int().nonnegative().optional(),
});
export type CreateGameRequest = z.infer<typeof CreateGameRequest>;

export const GameListItem = z.object({
  id: Id,
  name: z.string(),
  seed: z.number().int(),
  currentYear: z.number().int(),
  createdAt: z.string(),
});
export type GameListItem = z.infer<typeof GameListItem>;

export const FederationBrief = z.object({
  id: Id,
  name: z.string(),
  prestige: z.number().int(),
  tier: Tier,
  isPlayer: z.boolean(),
});
export type FederationBrief = z.infer<typeof FederationBrief>;

const _seasonPhaseValues = [
  'pretemporada', 'temporada',
] as const satisfies [EngineSeasonPhase, ...EngineSeasonPhase[]];

const _mandateTypeValues = [
  'prestige_min', 'team_count', 'positive_balance',
] as const satisfies [EngineMandateType, ...EngineMandateType[]];

// Season lifecycle (§1, §4.8): pretemporada = setup window, temporada = playable.
export const SeasonPhase = z.enum(_seasonPhaseValues);
export type SeasonPhase = z.infer<typeof SeasonPhase>;

export const MandateType = z.enum(_mandateTypeValues);
export type MandateType = z.infer<typeof MandateType>;

export const BoardMandateDto = z.object({
  id: Id,
  type: MandateType,
  description: z.string(),
  target: z.number().int(),
  year: z.number().int(),
  met: z.boolean().nullable(),
});
export type BoardMandateDto = z.infer<typeof BoardMandateDto>;

// ── Batch 5: Narrativa emergente ─────────────────────────────────────────────

export const MatchReportScorerDto = z.object({
  minute: z.number().int(),
  playerName: z.string(),
  teamName: z.string(),
});
export type MatchReportScorerDto = z.infer<typeof MatchReportScorerDto>;

export const MatchReportDto = z.object({
  matchday: z.number().int(),
  homeTeamName: z.string(),
  awayTeamName: z.string(),
  homeGoals: z.number().int(),
  awayGoals: z.number().int(),
  yellowCount: z.number().int(),
  redCount: z.number().int(),
  goalscorers: z.array(MatchReportScorerDto),
});
export type MatchReportDto = z.infer<typeof MatchReportDto>;

export const HeadlineDto = z.object({
  type: z.string(),
  text: z.string(),
  teamId: Id.nullable(),
  importance: z.number().int(),
});
export type HeadlineDto = z.infer<typeof HeadlineDto>;

export const SeasonChronicleDto = z.object({
  year: z.number().int(),
  divisionOrden: z.number().int(),
  champion: z.object({ teamId: Id, name: z.string(), points: z.number().int() }),
  revelation: z.object({ teamId: Id, name: z.string(), reason: z.string() }).nullable(),
  disappointment: z.object({ teamId: Id, name: z.string(), reason: z.string() }).nullable(),
  bestPlayer: z.object({
    playerId: Id,
    name: z.string(),
    teamId: Id,
    teamName: z.string(),
    goals: z.number().int(),
  }).nullable(),
  headline: z.string(),
});
export type SeasonChronicleDto = z.infer<typeof SeasonChronicleDto>;

export const RivalryDto = z.object({
  teamAId: Id,
  teamAName: z.string(),
  teamBId: Id,
  teamBName: z.string(),
  seasons: z.number().int(),
  headToHead: z.object({
    wins: z.number().int(),
    draws: z.number().int(),
    losses: z.number().int(),
  }),
});
export type RivalryDto = z.infer<typeof RivalryDto>;

// Fase 11.1: rival match result for Dashboard display.
export const RivalMatchResultDto = z.object({
  matchday: z.number().int(),
  federationId: z.number().int(),
  homeName: z.string(),
  awayName: z.string(),
  homeGoals: z.number().int(),
  awayGoals: z.number().int(),
  isShock: z.boolean(),
  federationName: z.string().default(''),
});
export type RivalMatchResultDto = z.infer<typeof RivalMatchResultDto>;

// Everything the dashboard header needs to render the current loop state.
export const GameSummary = z.object({
  id: Id,
  name: z.string(),
  seed: z.number().int(),
  year: z.number().int(),
  phase: SeasonPhase,
  currentMatchday: z.number().int(),
  totalMatchdays: z.number().int(),
  seasonOver: z.boolean(),
  impulsesRemaining: z.number().int(),
  impulsesPerSeason: z.number().int(),
  pendingEventsCount: z.number().int(),
  normBreachCount: z.number().int().default(0),
  reviewsUsedThisSeason: z.number().int().default(0),
  leagueFormat: z.enum(['ida', 'ida_vuelta']),
  federation: FederationBrief,
  mandate: BoardMandateDto.nullable().default(null),
  consecutiveMandateFails: z.number().int().default(0),
  headlines: z.array(HeadlineDto).default([]),
  lastChronicle: SeasonChronicleDto.nullable().default(null),
  rivalLastMatchday: z.array(RivalMatchResultDto).default([]),
  matchReports: z.array(MatchReportDto).default([]),
});
export type GameSummary = z.infer<typeof GameSummary>;

/* ----------------------------------------------------------- standings */

export const StandingRowDto = z.object({
  teamId: Id,
  name: z.string(),
  played: z.number().int(),
  won: z.number().int(),
  drawn: z.number().int(),
  lost: z.number().int(),
  goalsFor: z.number().int(),
  goalsAgainst: z.number().int(),
  goalDiff: z.number().int(),
  points: z.number().int(),
});
export type StandingRowDto = z.infer<typeof StandingRowDto>;

export const DivisionRef = z.object({
  orden: z.number().int(),
  name: z.string(),
});
export type DivisionRef = z.infer<typeof DivisionRef>;

export const StandingsResponse = z.object({
  year: z.number().int(),
  divisionOrden: z.number().int(),
  divisionName: z.string(),
  availableDivisions: z.array(DivisionRef),
  rows: z.array(StandingRowDto),
});
export type StandingsResponse = z.infer<typeof StandingsResponse>;

/* --------------------------------------------------------- team views */

export const PlayerDto = z.object({
  id: Id,
  name: z.string(),
  posicion: PlayerPosition,
  calidad: z.number().int(),
  nationality: z.string().default('local'),
  cantera: z.boolean().default(false),
  // §7 realism: per-season cards and current availability state.
  yellowCardsThisSeason: z.number().int().default(0),
  redCardsThisSeason: z.number().int().default(0),
  matchesSuspendedLeft: z.number().int().default(0),
  injuredMatchesLeft: z.number().int().default(0),
});
export type PlayerDto = z.infer<typeof PlayerDto>;

export const TeamListItem = z.object({
  id: Id,
  name: z.string(),
  strength: z.number().int(),
  prestige: z.number().int(),
  divisionName: z.string().nullable(),
  federationId: Id.nullable(),
  federationName: z.string().nullable(),
});
export type TeamListItem = z.infer<typeof TeamListItem>;

export const TrajectoryRow = z.object({
  anio: z.number().int(),
  divisionOrden: z.number().int().nullable(),
  puestoFinal: z.number().int(),
});
export type TrajectoryRow = z.infer<typeof TrajectoryRow>;

export const PalmaresEntry = z.object({
  competition: z.string(),
  count: z.number().int(),
  isYouth: z.boolean(),
});
export type PalmaresEntry = z.infer<typeof PalmaresEntry>;

/* ----------------------------------- commissioner: norms & sanctions (§4.7) */

const _normTypeValues = [
  'tope_plantilla', 'minimo_competitivo', 'tope_salarial', 'tope_extrangeros', 'minimo_cantera', 'tope_edad_media',
] as const satisfies [EngineNormType, ...EngineNormType[]];

export const NormType = z.enum(_normTypeValues);
export type NormType = z.infer<typeof NormType>;

export const TeamDetail = z.object({
  id: Id,
  name: z.string(),
  strength: z.number().int(),
  prestige: z.number().int(),
  arraigo: z.number().int(),
  presupuesto: z.number().int(),
  aficion: z.number().int(),
  estadioNombre: z.string().nullable(),
  estadioAforo: z.number().int().nullable(),
  academiaRating: z.number().int(),
  medicoRating: z.number().int(),
  ojeadoresRating: z.number().int(),
  cuerpoTecnicoRating: z.number().int(),
  federationName: z.string().nullable(),
  divisionName: z.string().nullable(),
  squad: z.array(PlayerDto),
  trajectory: z.array(TrajectoryRow),
  palmares: z.array(PalmaresEntry),
  rivalries: z.array(RivalryDto).default([]),
  requirements: z.object({
    breaches: z.array(z.object({
      teamId: Id,
      teamName: z.string(),
      normId: Id,
      tipo: NormType,
      valor: z.number().int(),
      valorActual: z.number().int(),
      sanctioned: z.boolean(),
    })),
    sanctions: z.array(z.object({
      year: z.number().int(),
      motivo: z.string(),
      castigo: z.string(),
    })),
  }),
});
export type TeamDetail = z.infer<typeof TeamDetail>;

/* ------------------------------------------------------- federation */

export const FederationDivision = z.object({
  id: Id,
  name: z.string(),
  orden: z.number().int(),
  plazas: z.number().int(),
  teamCount: z.number().int(),
});
export type FederationDivision = z.infer<typeof FederationDivision>;

export const FederationTeamItem = z.object({
  teamId: Id,
  name: z.string(),
  strength: z.number().int(),
  arraigo: z.number().int(),
});
export type FederationTeamItem = z.infer<typeof FederationTeamItem>;

// Fase 11.2/11.4: rich per-season record for a rival federation (defined before FederationOverview).
export const RivalSeasonRecordDto = z.object({
  year: z.number().int(),
  federationId: z.number().int(),
  federationName: z.string(),
  championName: z.string(),
  runnerUpName: z.string().nullable(),
  topScorer: z.object({
    name: z.string(),
    teamName: z.string(),
    goals: z.number().int(),
  }).nullable(),
  relegated: z.array(z.string()),
  // Fase 11.4: winner of the top-4 mini-cup.
  cupWinner: z.object({ name: z.string(), teamId: z.number().int() }).optional(),
});
export type RivalSeasonRecordDto = z.infer<typeof RivalSeasonRecordDto>;

export const FederationOverview = z.object({
  id: Id,
  name: z.string(),
  prestige: z.number().int(),
  tier: Tier,
  isPlayer: z.boolean(),
  leagueName: z.string().nullable(),
  teamCount: z.number().int(),
  divisions: z.array(FederationDivision),
  confederationId: z.number().int().optional(),
  confederationName: z.string().optional(),
  standings: z.array(StandingRowDto).optional(),
  teams: z.array(FederationTeamItem).optional(),
  seasonHistory: z.array(RivalSeasonRecordDto).optional(),
});
export type FederationOverview = z.infer<typeof FederationOverview>;

/* ---------------------------------------------------- history (§6) */

export const SeasonRecordDto = z.object({
  anio: z.number().int(),
  championTeamId: Id,
  championName: z.string(),
  divisionName: z.string().nullable(),
});
export type SeasonRecordDto = z.infer<typeof SeasonRecordDto>;

export const PalmaresRow = z.object({
  teamId: Id,
  teamName: z.string(),
  titles: z.number().int(),
});
export type PalmaresRow = z.infer<typeof PalmaresRow>;

export const AwardDto = z.object({
  year: z.number().int(),
  tipo: AwardType,
  playerName: z.string(),
  teamName: z.string(),
  valor: z.number().int(),
});
export type AwardDto = z.infer<typeof AwardDto>;

export const GoalScorerRankingRow = z.object({
  playerId: Id,
  playerName: z.string(),
  teamName: z.string(),
  seasonsWon: z.number().int(),
  totalGoles: z.number().int(),
});
export type GoalScorerRankingRow = z.infer<typeof GoalScorerRankingRow>;

export const RivalChampionRow = z.object({
  year: z.number().int(),
  federationName: z.string(),
  championName: z.string(),
  points: z.number().int(),
});
export type RivalChampionRow = z.infer<typeof RivalChampionRow>;

// ── Batch 7: historical data ──────────────────────────────────────────────────

export const RecordBookDto = z.object({
  biggestWin: z.object({
    margin: z.number().int(),
    homeId: Id,
    homeName: z.string(),
    awayId: Id,
    awayName: z.string(),
    homeGoals: z.number().int(),
    awayGoals: z.number().int(),
    year: z.number().int(),
  }).nullable(),
  longestWinStreak: z.object({
    teamId: Id,
    teamName: z.string(),
    count: z.number().int(),
    year: z.number().int(),
  }).nullable(),
});
export type RecordBookDto = z.infer<typeof RecordBookDto>;

export const TeamTrajectoryData = z.object({
  teamId: Id,
  teamName: z.string(),
  rows: z.array(TrajectoryRow),
});
export type TeamTrajectoryData = z.infer<typeof TeamTrajectoryData>;

export const WorldRankingRow = z.object({
  federationId: Id,
  name: z.string(),
  cumulativeScore: z.number(),
  lastRank: z.number().int(),
  lastScore: z.number(),
  seasonsRanked: z.number().int(),
  isPlayer: z.boolean(),
});
export type WorldRankingRow = z.infer<typeof WorldRankingRow>;

export const WorldRankingResponse = z.object({
  rows: z.array(WorldRankingRow),
});
export type WorldRankingResponse = z.infer<typeof WorldRankingResponse>;

// Batch 12.1: live world standings
export const WorldDivisionStanding = z.object({
  orden: z.number().int(),
  name: z.string(),
  standings: z.array(StandingRowDto),
});
export type WorldDivisionStanding = z.infer<typeof WorldDivisionStanding>;

export const WorldFederationStanding = z.object({
  federationId: z.number().int(),
  federationName: z.string(),
  confederationName: z.string().optional(),
  prestige: z.number().int(),
  tier: Tier,
  matchdayProgress: z.number().int(),
  divisions: z.array(WorldDivisionStanding),
});
export type WorldFederationStanding = z.infer<typeof WorldFederationStanding>;

export const WorldStandingsResponse = z.object({
  federations: z.array(WorldFederationStanding),
});
export type WorldStandingsResponse = z.infer<typeof WorldStandingsResponse>;

export const ImportGameRequest = z.object({
  name: z.string().min(1).max(80),
  state: z.any(),
});
export type ImportGameRequest = z.infer<typeof ImportGameRequest>;

export const HistoryResponse = z.object({
  records: z.array(SeasonRecordDto),
  palmares: z.array(PalmaresRow),
  awards: z.array(AwardDto),
  topScorers: z.array(GoalScorerRankingRow),
  rivalChampions: z.array(RivalChampionRow),
  trajectoryData: z.array(TeamTrajectoryData).default([]),
  recordBook: RecordBookDto.nullable().default(null),
});
export type HistoryResponse = z.infer<typeof HistoryResponse>;

/* -------------------------------- commissioner: federations & market */

export const FederationListItem = z.object({
  id: Id,
  name: z.string(),
  prestige: z.number().int(),
  tier: Tier,
  isPlayer: z.boolean(),
  teamCount: z.number().int(),
  confederationId: z.number().int().optional(),
  confederationName: z.string().optional(),
});
export type FederationListItem = z.infer<typeof FederationListItem>;

export const ConfederationDto = z.object({
  id: Id,
  name: z.string(),
  region: z.string(),
  available: z.boolean(),
});
export type ConfederationDto = z.infer<typeof ConfederationDto>;

// A rival-owned team the player may currently negotiate for (tier-gated).
export const MarketTeam = z.object({
  teamId: Id,
  name: z.string(),
  strength: z.number().int(),
  arraigo: z.number().int(),
  tier: Tier,
  currentFederationId: Id,
  currentFederationName: z.string(),
});
export type MarketTeam = z.infer<typeof MarketTeam>;

export const MarketResponse = z.object({
  playerTier: Tier,
  teams: z.array(MarketTeam),
});
export type MarketResponse = z.infer<typeof MarketResponse>;

export const NegotiationRequirementType = z.enum(['prestigio', 'estadio', 'reparto']);
export type NegotiationRequirementType = z.infer<typeof NegotiationRequirementType>;

export const NegotiationRequirementDto = z.object({
  tipo: NegotiationRequirementType,
  objetivo: z.number(),
  revealed: z.boolean(),
  cumplido: z.boolean(),
});
export type NegotiationRequirementDto = z.infer<typeof NegotiationRequirementDto>;

export const NegotiationDto = z.object({
  id: Id,
  targetTeamId: Id,
  targetTeamName: z.string(),
  state: EngineNegotiationState,
  startedYear: z.number().int(),
  requirementsSeasonsLeft: z.number().int(),
  acceptedYear: z.number().int().nullable(),
  effectiveYear: z.number().int().nullable(),
  fromFederationName: z.string(),
  byFederationName: z.string(),
  requirements: z.array(NegotiationRequirementDto).default([]),
  offerValue: z.number().int().default(0),
  revealedCount: z.number().int().default(0),
});
export type NegotiationDto = z.infer<typeof NegotiationDto>;

export const StartNegotiationRequest = z.object({
  targetTeamId: Id,
});
export type StartNegotiationRequest = z.infer<typeof StartNegotiationRequest>;

export const SetOfferValueRequest = z.object({
  negId: Id,
  offerValue: z.number().int().min(0).max(30),
});
export type SetOfferValueRequest = z.infer<typeof SetOfferValueRequest>;

/* --------------------------------- commissioner: league structure (§4.4) */

export const StructureTeam = z.object({
  teamId: Id,
  name: z.string(),
  strength: z.number().int(),
  arraigo: z.number().int(),
});
export type StructureTeam = z.infer<typeof StructureTeam>;

export const StructureDivision = z.object({
  orden: z.number().int(),
  name: z.string(),
  teams: z.array(StructureTeam),
});
export type StructureDivision = z.infer<typeof StructureDivision>;

export const StructureResponse = z.object({
  divisions: z.array(StructureDivision),
  // Player-owned teams adhered via negotiation, awaiting a leveling league.
  pending: z.array(StructureTeam),
});
export type StructureResponse = z.infer<typeof StructureResponse>;

/* ----------------------------------------- commissioner: economy (§4.5) */

export const FinancialHealth = z.enum([
  'saneada',
  'ajustada',
  'en_riesgo',
  'quiebra',
]);
export type FinancialHealth = z.infer<typeof FinancialHealth>;

export const CommercialContractDto = z.object({
  id: Id,
  tipo: CommercialContractType,
  nombre: z.string(),
  valorAnual: z.number().int(),
  yearsLeft: z.number().int(),
});
export type CommercialContractDto = z.infer<typeof CommercialContractDto>;

export const ContractOfferDto = z.object({
  id: z.number().int(),
  tipo: CommercialContractType,
  nombre: z.string(),
  valorAnual: z.number().int(),
  years: z.number().int(),
});
export type ContractOfferDto = z.infer<typeof ContractOfferDto>;

// Fase 6.5: the global prize pool was replaced by per-competition prizes;
// the policy only owns the (still-global) talent-investment line now.
export const EconomyPolicyDto = z.object({
  talentInvestment: z.number().int().nonnegative(),
});
export type EconomyPolicyDto = z.infer<typeof EconomyPolicyDto>;

export const LastEconomyDto = z.object({
  year: z.number().int(),
  income: z.number().int(),
  operatingCost: z.number().int(),
  normCost: z.number().int(),
  prizes: z.number().int(),
  talent: z.number().int(),
  net: z.number().int(),
  transferFees: z.number().int(),
  transferIncome: z.number().int(),
  matchday: z.number().int(),
  merchandise: z.number().int(),
  treasuryAfter: z.number().int(),
});
export type LastEconomyDto = z.infer<typeof LastEconomyDto>;

export const EconomyResponse = z.object({
  treasury: z.number().int(),
  financialHealth: FinancialHealth,
  operatingCostNow: z.number().int(),
  policy: EconomyPolicyDto,
  last: LastEconomyDto.nullable(),
  contracts: z.array(CommercialContractDto),
  offers: z.array(ContractOfferDto),
});
export type EconomyResponse = z.infer<typeof EconomyResponse>;

export const SignContractRequest = z.object({ offerId: z.number().int() });
export type SignContractRequest = z.infer<typeof SignContractRequest>;

export const SetEconomyPolicyRequest = EconomyPolicyDto;
export type SetEconomyPolicyRequest = z.infer<typeof SetEconomyPolicyRequest>;

/* ----------------------------------- commissioner: prizes (Fase 6.5) */

export const PrizeKind = z.enum(['liga', 'copa']);
export type PrizeKind = z.infer<typeof PrizeKind>;

export const CompetitionPrizeDto = z.object({
  id: Id,
  kind: PrizeKind,
  cupId: Id.nullable(),
  cupName: z.string().nullable(), // hydrated by backend for the UI
  pool: z.number().int(),
  shares: z.array(z.number()),
});
export type CompetitionPrizeDto = z.infer<typeof CompetitionPrizeDto>;

export const PrizePaymentDto = z.object({
  year: z.number().int(),
  competitionLabel: z.string(),
  teamId: Id,
  teamName: z.string(),
  position: z.number().int(),
  amount: z.number().int(),
});
export type PrizePaymentDto = z.infer<typeof PrizePaymentDto>;

export const PrizesResponse = z.object({
  prizes: z.array(CompetitionPrizeDto),
  // Latest paid year (or 0 if nothing paid yet).
  latestPaidYear: z.number().int(),
  payments: z.array(PrizePaymentDto),
});
export type PrizesResponse = z.infer<typeof PrizesResponse>;

export const SetLeaguePrizeRequest = z.object({
  pool: z.number().int().nonnegative(),
  shares: z.array(z.number().nonnegative()).min(1),
});
export type SetLeaguePrizeRequest = z.infer<typeof SetLeaguePrizeRequest>;

export const SetCupPrizeRequest = z.object({
  cupId: Id,
  pool: z.number().int().nonnegative(),
  shares: z.array(z.number().nonnegative()).min(1),
});
export type SetCupPrizeRequest = z.infer<typeof SetCupPrizeRequest>;

/* ----------------------------------- commissioner: transfers (Fase 6.4) */

export const TransferEntryDto = z.object({
  year: z.number().int(),
  playerId: z.number().int(),
  playerName: z.string(),
  fromTeamId: Id,
  fromTeamName: z.string(),
  toTeamId: Id,
  toTeamName: z.string(),
  calidad: z.number().int(),
  // Fase 11.3: inter-league arrivals from rival federations.
  isInternational: z.boolean().optional(),
  fromFederationName: z.string().optional(),
});
export type TransferEntryDto = z.infer<typeof TransferEntryDto>;

export const TransfersResponse = z.object({
  year: z.number().int(),
  entries: z.array(TransferEntryDto),
  // All transfer history (across years), oldest first. Lets the UI show the
  // last window and link back to earlier ones if useful.
  history: z.array(TransferEntryDto),
});
export type TransfersResponse = z.infer<typeof TransfersResponse>;

/* ------------------------- commissioner: salary-cap compliance (§4.7, 6.3) */

// Per-team wage bill vs the optional tope_salarial cap. `cap` is null when the
// commissioner has not defined a wage cap norm yet (no compliance to evaluate).
export const ComplianceRow = z.object({
  teamId: Id,
  teamName: z.string(),
  divisionName: z.string().nullable(),
  wageBill: z.number().int(),
  cap: z.number().int().nullable(),
  complies: z.boolean(),
});
export type ComplianceRow = z.infer<typeof ComplianceRow>;

export const ComplianceResponse = z.object({
  cap: z.number().int().nullable(),
  rows: z.array(ComplianceRow),
});
export type ComplianceResponse = z.infer<typeof ComplianceResponse>;


export const NormDto = z.object({
  id: Id,
  tipo: NormType,
  valor: z.number().int(),
});
export type NormDto = z.infer<typeof NormDto>;

export const NormBreachDto = z.object({
  teamId: Id,
  teamName: z.string(),
  normId: Id,
  tipo: NormType,
  valor: z.number().int(),
  valorActual: z.number().int(),
  sanctioned: z.boolean(),
});
export type NormBreachDto = z.infer<typeof NormBreachDto>;

export const SanctionDto = z.object({
  id: Id,
  teamId: Id,
  teamName: z.string(),
  normId: Id,
  year: z.number().int(),
  appliesToYear: z.number().int(),
  motivo: z.string(),
  castigo: z.string(),
});
export type SanctionDto = z.infer<typeof SanctionDto>;

export const NormsResponse = z.object({
  norms: z.array(NormDto),
  breaches: z.array(NormBreachDto),
  sanctions: z.array(SanctionDto),
});
export type NormsResponse = z.infer<typeof NormsResponse>;

// Strength-based norms live in 1-100 (team.strength); the salary cap is
// denominated in € and accepts the full range — the engine clamps each at
// its own ceiling.
export const AddNormRequest = z
  .object({
    tipo: NormType,
    valor: z.number().int().nonnegative(),
  })
  .refine(
    (v) => {
      if (v.tipo === 'tope_salarial') return v.valor >= 0 && v.valor <= 200_000_000;
      if (v.tipo === 'tope_edad_media') return v.valor >= 16 && v.valor <= 40;
      // strength-based (1-100) and count-based (1-25) norms
      return v.valor >= 1 && v.valor <= 100;
    },
    { message: 'valor fuera de rango para este tipo de norma', path: ['valor'] },
  );
export type AddNormRequest = z.infer<typeof AddNormRequest>;

export const SanctionRequest = z.object({
  teamId: Id,
  normId: Id,
});
export type SanctionRequest = z.infer<typeof SanctionRequest>;

/* ------------------------------------------- commissioner: impulses (§4.6) */

export const NextFixture = z.object({
  matchday: z.number().int(),
  divisionOrden: z.number().int(),
  divisionName: z.string(),
  homeTeamId: Id,
  homeTeamName: z.string(),
  awayTeamId: Id,
  awayTeamName: z.string(),
  // Set when an impulse already favours one of the two teams for this match.
  favoredTeamId: Id.nullable(),
});
export type NextFixture = z.infer<typeof NextFixture>;

// Cup rounds also scheduled for this matchday (Fase 6.2 unified calendar).
// Knockout rounds beyond R1 depend on the prior round's winners, so they may
// arrive with `matchesKnown=false` and `matches=[]` until they're played.
export const NextCupMatch = z.object({
  homeTeamId: Id.nullable(),
  homeTeamName: z.string().nullable(),
  awayTeamId: Id.nullable(),
  awayTeamName: z.string().nullable(),
});
export type NextCupMatch = z.infer<typeof NextCupMatch>;

export const NextCupRound = z.object({
  cupId: Id,
  cupName: z.string(),
  cupFormato: z.enum(['eliminatoria', 'liga']),
  roundNumero: z.number().int(),
  matchesKnown: z.boolean(),
  matches: z.array(NextCupMatch),
});
export type NextCupRound = z.infer<typeof NextCupRound>;

export const NextFixturesResponse = z.object({
  matchday: z.number().int(),
  seasonOver: z.boolean(),
  impulsesRemaining: z.number().int(),
  impulsesPerSeason: z.number().int(),
  fixtures: z.array(NextFixture),
  cupRounds: z.array(NextCupRound),
});
export type NextFixturesResponse = z.infer<typeof NextFixturesResponse>;

export const ApplyImpulseRequest = z.object({
  homeTeamId: Id,
  awayTeamId: Id,
  favoredTeamId: Id,
});
export type ApplyImpulseRequest = z.infer<typeof ApplyImpulseRequest>;

/* ----------------------------------- commissioner: create own team (§4.3) */

export const CreateOwnTeamRequest = z.object({
  name: z.string().min(1).max(60),
});
export type CreateOwnTeamRequest = z.infer<typeof CreateOwnTeamRequest>;

/* ----------------------------------- season events / polémicas (§1, §2) */

export const EventType = z.enum([
  'arbitraje_dudoso',
  'incidente_aficion',
  'declaraciones_polemicas',
  'doping_positivo',
  'conflicto_jugadores',
  'crisis_economica_club',
  'escandalo_directiva',
  'manipulacion_resultados',
]);
export type EventType = z.infer<typeof EventType>;

export const EventSeverity = z.enum(['baja', 'media', 'alta']);
export type EventSeverity = z.infer<typeof EventSeverity>;

export const EventStatus = z.enum([
  'pendiente',
  'resuelto_actuar',
  'resuelto_ignorar',
  'caducado',
]);
export type EventStatus = z.infer<typeof EventStatus>;

export const EventAction = z.enum(['actuar', 'ignorar']);
export type EventAction = z.infer<typeof EventAction>;

export const EventDto = z.object({
  id: z.number().int(),
  year: z.number().int(),
  matchday: z.number().int(),
  tipo: EventType,
  status: EventStatus,
  teamId: Id.nullable(),
  teamName: z.string().nullable(),
  message: z.string(),
  resolvedAction: EventAction.nullable(),
  severity: EventSeverity,
  chainedFromId: Id.nullable(),
  effectDescription: z.string(),
});
export type EventDto = z.infer<typeof EventDto>;

export const EventsResponse = z.object({
  pending: z.array(EventDto),
  recent: z.array(EventDto),
});
export type EventsResponse = z.infer<typeof EventsResponse>;

export const ResolveEventRequest = z.object({ action: EventAction });
export type ResolveEventRequest = z.infer<typeof ResolveEventRequest>;

/* -------------------------------------- cups / tournaments (§4.4) */

export const CupType = z.enum(['copa', 'liga_juvenil', 'torneo_verano']);
export type CupType = z.infer<typeof CupType>;

export const CupStatus = z.enum(['en_curso', 'finalizada']);
export type CupStatus = z.infer<typeof CupStatus>;

export const CupFormat = z.enum(['eliminatoria', 'eliminatoria_ida_vuelta', 'liga']);
export type CupFormat = z.infer<typeof CupFormat>;

export const CupCategory = z.enum(['primer_equipo', 'juvenil']);
export type CupCategory = z.infer<typeof CupCategory>;

export const CupMatchDto = z.object({
  homeTeamId: z.number().int(),
  homeTeamName: z.string(),
  awayTeamId: z.number().int(),
  awayTeamName: z.string(),
  homeGoals: z.number().int().nullable(),
  awayGoals: z.number().int().nullable(),
  played: z.boolean(),
  winnerTeamId: z.number().int().nullable(),
  leg: z.enum(['ida', 'vuelta']).optional(),
});
export type CupMatchDto = z.infer<typeof CupMatchDto>;

export const CupRoundDto = z.object({
  numero: z.number().int(),
  matches: z.array(CupMatchDto),
  leg: z.enum(['ida', 'vuelta']).optional(),
});
export type CupRoundDto = z.infer<typeof CupRoundDto>;

export const CupDto = z.object({
  id: Id,
  name: z.string(),
  tipo: CupType,
  formato: CupFormat,
  categoria: CupCategory,
  year: z.number().int(),
  status: CupStatus,
  championTeamId: Id.nullable(),
  championTeamName: z.string().nullable(),
  rounds: z.array(CupRoundDto),
  recurring: z.boolean(),
});
export type CupDto = z.infer<typeof CupDto>;

export const CupsResponse = z.object({
  cups: z.array(CupDto),
});
export type CupsResponse = z.infer<typeof CupsResponse>;

export const CreateCupRequest = z.object({
  name: z.string().min(1).max(80),
  tipo: CupType,
  formato: CupFormat,
  categoria: CupCategory,
  participantTeamIds: z.array(Id).min(2).max(32),
  recurring: z.boolean().optional().default(false),
});
export type CreateCupRequest = z.infer<typeof CreateCupRequest>;

/* ----------------------------------------- league format (§4.4) */

export const LeagueFormat = z.enum(['ida', 'ida_vuelta']);
export type LeagueFormat = z.infer<typeof LeagueFormat>;

export const SetLeagueFormatRequest = z.object({ format: LeagueFormat });
export type SetLeagueFormatRequest = z.infer<typeof SetLeagueFormatRequest>;

// ── Beta.1: Auth ──────────────────────────────────────────────────────────────

export const AuthUserDto = z.object({
  id: Id,
  email: z.string().email(),
  role: z.enum(['admin', 'beta']),
  forcePasswordChange: z.boolean(),
});
export type AuthUserDto = z.infer<typeof AuthUserDto>;

export const LoginRequest = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(72), // bcrypt silently truncates above 72 bytes
});
export type LoginRequest = z.infer<typeof LoginRequest>;

export const LoginResponse = z.object({
  accessToken: z.string(),
  user: AuthUserDto,
});
export type LoginResponse = z.infer<typeof LoginResponse>;

export const ChangePasswordRequest = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: z.string().min(8).max(72),
});
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequest>;

export const RequestResetBody = z.object({
  email: z.string().email(),
});
export type RequestResetBody = z.infer<typeof RequestResetBody>;

export const ResetPasswordRequest = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(72),
});
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequest>;

export const RequestAccessRequest = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  reason: z.string().min(20).max(300),
});
export type RequestAccessRequest = z.infer<typeof RequestAccessRequest>;

export const AccessRequestDto = z.object({
  id: Id,
  name: z.string(),
  email: z.string(),
  reason: z.string(),
  status: z.enum(['pending', 'approved', 'rejected']),
  requestedAt: z.string(),
  reviewedAt: z.string().nullable(),
  reviewedByUserId: Id.nullable(),
});
export type AccessRequestDto = z.infer<typeof AccessRequestDto>;

export const AdminUserDto = z.object({
  id: Id,
  email: z.string(),
  role: z.enum(['admin', 'beta']),
  approved: z.boolean(),
  createdAt: z.string(),
  lastActiveAt: z.string().nullable(),
  gameCount: z.number().int(),
});
export type AdminUserDto = z.infer<typeof AdminUserDto>;

export const ApproveRequestBody = z.object({
  temporaryPassword: z.string().min(8).optional(),
});
export type ApproveRequestBody = z.infer<typeof ApproveRequestBody>;

export const RejectRequestBody = z.object({
  reason: z.string().optional(),
});
export type RejectRequestBody = z.infer<typeof RejectRequestBody>;

// Shallow validation of an imported GameState — prevents crashes from malformed or
// hostile uploads. Validates the presence and types of critical root fields only;
// uses .passthrough() so forward-compat fields survive.
export const GameStateImportSchema = z
  .object({
    year: z.number().int().min(1),
    seed: z.number(),
    phase: z.enum(['pretemporada', 'temporada']),
    playerFederationId: z.number().int().positive(),
    rng: z.object({ s: z.number() }).passthrough(),
    federations: z.array(z.unknown()).min(1),
    teams: z.array(z.unknown()),
    players: z.array(z.unknown()),
    divisions: z.array(z.unknown()),
    negotiations: z.array(z.unknown()).default([]),
  })
  .passthrough();
