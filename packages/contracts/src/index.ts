import { z } from 'zod';

// Single source of truth for the back/front contract. Backend validates with
// these at the boundary; frontend infers its types from the same schemas.
// Enums mirror the design doc (§3, §4) so they are real, not placeholders.

/* ----------------------------------------------------------------- enums */

export const CompetitionType = z.enum([
  'liga',
  'copa',
  'liga_juvenil',
  'torneo_verano',
  'liga_nivelacion',
]);
export type CompetitionType = z.infer<typeof CompetitionType>;

export const NegotiationState = z.enum([
  'tier_check',
  'gathering_requirements',
  'offer',
  'accepted',
  'effective',
  'rejected',
  'cancelled',
]);
export type NegotiationState = z.infer<typeof NegotiationState>;

export const CommercialContractType = z.enum([
  'patrocinio',
  'publicidad',
  'derechos_tv',
  'derechos_imagen',
]);
export type CommercialContractType = z.infer<typeof CommercialContractType>;

export const AwardType = z.enum(['max_goleador', 'max_asistente', 'mejor_portero']);
export type AwardType = z.infer<typeof AwardType>;

export const PlayerPosition = z.enum(['POR', 'DEF', 'MED', 'DEL']);
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

// Season lifecycle (§1, §4.8): pretemporada = setup window, temporada = playable.
export const SeasonPhase = z.enum(['pretemporada', 'temporada']);
export type SeasonPhase = z.infer<typeof SeasonPhase>;

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

export const NormType = z.enum(['tope_plantilla', 'minimo_competitivo', 'tope_salarial', 'tope_extrangeros', 'minimo_cantera', 'tope_edad_media']);
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

export const HistoryResponse = z.object({
  records: z.array(SeasonRecordDto),
  palmares: z.array(PalmaresRow),
  awards: z.array(AwardDto),
  topScorers: z.array(GoalScorerRankingRow),
  rivalChampions: z.array(RivalChampionRow),
});
export type HistoryResponse = z.infer<typeof HistoryResponse>;

/* -------------------------------- commissioner: federations & market */

export const EngineNegotiationState = z.enum([
  'gathering_requirements',
  'offer',
  'accepted',
  'effective',
  'rejected',
]);
export type EngineNegotiationState = z.infer<typeof EngineNegotiationState>;

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
