import type { RngState } from './rng';

// Board mandate: a seasonal objective issued by the federation's governing board.
export type MandateType = 'prestige_min' | 'team_count' | 'positive_balance';

export interface BoardMandate {
  id: number;
  type: MandateType;
  description: string;
  target: number;
  year: number;
  met: boolean | null; // null while the season is in progress
}

// Confederation (UEFA, CONMEBOL, etc.) — groups federations by region.
export interface Confederation {
  id: number;
  name: string;
  region: string;
  available: boolean;
}

// Federation is one entity type (design §3): the player's and the rivals' are
// the same model, distinguished by `isPlayer`. This gives symmetry so rivals
// can act with the same rules as the player.
export interface Federation {
  id: number;
  name: string;
  prestige: number;
  isPlayer: boolean;
  confederationId: number;
}

// A tier of the player's league (§4.4). orden 1 = top flight.
// For rival leagues, each federation has its own divisions (federationId set).
export interface Division {
  orden: number;
  name: string;
  federationId: number; // which federation owns this division (player or rival)
  // Fase 14.7: per-division schedule format. Falls back to the global
  // leagueFormat when absent (older saves before the leveling-plan feature).
  format?: LeagueFormat;
}

// Fase 14.7: a player-defined structure applied when running the leveling
// league — chooses how many divisions, their sizes, and their format.
export interface LevelingPlanDivision {
  orden: number;
  name?: string;
  size: number; // how many teams land in this division
  format: LeagueFormat;
}
export interface LevelingPlan {
  divisions: LevelingPlanDivision[];
}

// Club sponsorship contract (autonomous — signed by the club, not the commissioner).
export interface TeamSponsor {
  id: number;
  name: string;
  valorAnual: number;
  yearsLeft: number;
}

// Per-team P&L for one season (snapshot written at closeSeason).
export interface TeamSeasonEconomy {
  year: number;
  gateReceipts: number;    // 90% of home match gate
  sponsorIncome: number;
  prizeIncome: number;
  transferIncome: number;  // fees received from player sales this window
  wageExpenses: number;
  transferExpenses: number; // fees paid for player purchases this window
  infrastructureExpenses: number;
  net: number;
  treasuryAfter: number;
}

// Log entry written when the commissioner rescues a team.
export interface RescueEntry {
  year: number;
  teamId: number;
  teamName: string;
  amount: number;
}

export interface Team {
  id: number;
  name: string;
  // Average squad quality (0-100). The engine has no Player entities yet —
  // strength is the proxy the design doc allows for the minimum loop.
  strength: number;
  // Which federation currently owns the team. Never deleted, only re-associated.
  federationId: number;
  // Loyalty to the current federation (0-100): the late-game snowball brake
  // (§5). A highly-rooted team resists being stolen even if your prestige is high.
  arraigo: number;
  // Which division of the player's league the team competes in. null = not
  // competing: a rival-owned target, or an adhered team awaiting integration
  // via a leveling league (§4.4).
  divisionOrden: number | null;
  // Strength of the club's academy/reserve side (§4.4 youth competitions). Set
  // from the academy rating; falls back to a value below the first team.
  youthStrength: number;
  stadiumCapacity: number;
  academia: number;
  // Club finances (team-level, independent of federation treasury).
  treasury: number;
  sponsors: TeamSponsor[];
  lastTeamEconomy: TeamSeasonEconomy | null;
  // Commissioner rescue flag: when true, this team's league/cup prizes are
  // withheld (stay in federation treasury) until the flag is cleared.
  prizesWithheld: boolean;
  // Match engine realism fields (Phase 2 — initialised here to avoid a separate migration).
  recentForm: ('W' | 'D' | 'L')[];   // last 5 results, oldest first
  matchesPlayedThisSeason: number;
}

// How the player's league is contested (§4.4 "define su liga como quiera").
export type LeagueFormat = 'ida' | 'ida_vuelta';

// Season lifecycle (§1, §4.8): pretemporada is the structural-decisions window
// (create cups, sign contracts, set prizes, review transfers); temporada is the
// playable phase (advance matchdays). Close → pretemporada of the next year.
export type SeasonPhase = 'pretemporada' | 'temporada';

export interface Fixture {
  matchday: number;
  divisionOrden: number;
  homeId: number;
  awayId: number;
}

export interface MatchResult extends Fixture {
  homeGoals: number;
  awayGoals: number;
}

export interface Goalscorer {
  playerId: number;
  minute: number;
}

export interface MatchReport {
  matchday: number;
  divisionOrden: number;
  homeId: number;
  awayId: number;
  homeGoals: number;
  awayGoals: number;
  goalscorers: Goalscorer[];
  homeYellowCards: number;
  awayYellowCards: number;
  homeRedCards: number;
  awayRedCards: number;
}

export interface PendingImpulse {
  matchday: number;
  homeId: number;
  awayId: number;
  favoredTeamId: number;
}

// Negotiation lifecycle (§4.2): tier check (enforced at start) -> requirements
// gathering (1-3 seasons, longer with high arraigo) -> offer -> accepted ->
// effective two years after acceptance. Removal follows the same 2-year delay.
export type NegotiationState =
  | 'gathering_requirements'
  | 'offer'
  | 'accepted'
  | 'effective'
  | 'rejected';

// A concrete condition a team demands before accepting. Requirements are
// generated at negotiation start but revealed one per season so the player
// discovers them progressively during the gathering phase.
export type NegotiationRequirementType = 'prestigio' | 'estadio' | 'reparto';

export interface NegotiationRequirement {
  tipo: NegotiationRequirementType;
  objetivo: number; // threshold: prestige pts, stadium capacity, or % revenue share
  revealed: boolean; // visible to the player yet?
  cumplido: boolean; // currently satisfied?
}

export interface Negotiation {
  id: number;
  targetTeamId: number;
  byFederationId: number; // pursuer
  fromFederationId: number; // owner when the negotiation started
  state: NegotiationState;
  startedYear: number;
  requirementsSeasonsLeft: number;
  acceptedYear: number | null;
  effectiveYear: number | null; // acceptedYear + 2
  // Batch 3: real requirements (§4.2)
  requirements: NegotiationRequirement[];
  offerValue: number; // 0-30: % of commercial income committed as annual revenue share
  revealedCount: number;
}

// Player roster + per-season stats for the awards layer (§6).
export type PlayerPosition = 'POR' | 'DEF' | 'MED' | 'DEL';

export interface PlayerSeasonStats {
  goals: number;
  assists: number;
  cleanSheets: number;
  yellowCards: number;
  redCards: number;
}

export interface Player {
  id: number;
  teamId: number;
  name: string;
  posicion: PlayerPosition;
  calidad: number;
  season: PlayerSeasonStats;
  // Availability state (§7 realism). Decremented by one per matchday the
  // team plays; while > 0 the player can't score, assist, or be re-affected.
  matchesSuspendedLeft: number;
  injuredMatchesLeft: number;
  age: number;
  nationality: string;  // 'local' | 'extranjero' — used by tope_extrangeros norm
  cantera: boolean;     // homegrown / youth academy — used by minimo_cantera norm
  // Hidden quality ceiling (Fase 15): calidad grows toward this and never
  // exceeds it. NEVER exposed in DTOs, logs, or UI — the commissioner only
  // sees its effects (headlines, awards, performance), never the number.
  potencial: number;
}

// Cups / tournaments (§4.4): elimination brackets that run alongside the
// league and are concluded at season close. Independent rng (cupsRng) so they
// don't perturb the match engine — golden-safe when no cups exist.
export type CupType = 'copa' | 'liga_juvenil' | 'torneo_verano' | 'inter_ligas';

export type CupStatus = 'en_curso' | 'finalizada';

// Knockout vs round-robin; first team vs youth (cantera) sides.
// 'eliminatoria' = single-leg knockout; 'eliminatoria_ida_vuelta' = two-leg.
export type CupFormat = 'eliminatoria' | 'eliminatoria_ida_vuelta' | 'liga';
export type CupCategory = 'primer_equipo' | 'juvenil';

export interface CupMatch {
  homeTeamId: number;
  awayTeamId: number;
  homeGoals: number | null;
  awayGoals: number | null;
  played: boolean;
  winnerTeamId: number | null;
  leg?: 'ida' | 'vuelta';
}

export interface CupRound {
  numero: number;
  matches: CupMatch[];
  leg?: 'ida' | 'vuelta';
}

export interface Cup {
  id: number;
  name: string;
  tipo: CupType;
  formato: CupFormat;
  categoria: CupCategory;
  year: number;
  status: CupStatus;
  participantTeamIds: number[];
  rounds: CupRound[];
  championTeamId: number | null;
  recurring: boolean;
}

// Template for a recurring cup — saved at season close and recreated each pretemporada.
export interface CupTemplate {
  cupId: number; // source cup ID, for matching when editing
  name: string;
  tipo: CupType;
  formato: CupFormat;
  categoria: CupCategory;
  participantTeamIds: number[];
}

// Calendar slot for a cup round (§4.4 + Fase 6.2 calendario unificado): one
// entry per scheduled round, placed inside the league matchday range so the
// season plays liga and copas interleaved. Built at startSeason from the cups
// that already exist in pretemporada.
export interface CupScheduleEntry {
  matchday: number;
  cupId: number;
  roundNumero: number;
}

// Events / polémicas during the season (§1, §2). Few interruptions by design.
export type EventType =
  | 'arbitraje_dudoso'
  | 'incidente_aficion'
  | 'declaraciones_polemicas'
  | 'doping_positivo'
  | 'conflicto_jugadores'
  | 'crisis_economica_club'
  | 'escandalo_directiva'
  | 'manipulacion_resultados';

export type EventSeverity = 'baja' | 'media' | 'alta';

export type EventStatus =
  | 'pendiente'
  | 'resuelto_actuar'
  | 'resuelto_ignorar'
  | 'caducado';

export type EventAction = 'actuar' | 'ignorar';

export interface GameEvent {
  id: number;
  year: number;
  matchday: number;
  tipo: EventType;
  status: EventStatus;
  teamId: number | null;
  message: string;
  resolvedAction: EventAction | null;
  severity: EventSeverity;
  chainedFromId: number | null;
}

export type AwardType = 'max_goleador' | 'max_asistente' | 'mejor_portero' | 'mejor_joven';

export interface Award {
  year: number;
  tipo: AwardType;
  playerId: number;
  playerName: string;
  teamId: number;
  teamName: string;
  valor: number;
}

// ── Batch 5: Narrativa emergente ────────────────────────────────────────────

export type HeadlineType =
  | 'goleada'
  | 'sorpresa'
  | 'racha_victorias'
  | 'racha_derrotas';

export interface Headline {
  type: HeadlineType;
  text: string;
  teamId: number | null;
  importance: number; // 1-3 (3 = most prominent)
  isRival?: boolean;          // true when the headline originates from a rival federation
  rivalFederationId?: number; // set when isRival === true
}

export interface SeasonChronicle {
  year: number;
  divisionOrden: number;
  champion: { teamId: number; name: string; points: number };
  revelation: { teamId: number; name: string; reason: string } | null;
  disappointment: { teamId: number; name: string; reason: string } | null;
  bestPlayer: {
    playerId: number;
    name: string;
    teamId: number;
    teamName: string;
    goals: number;
  } | null;
  headline: string;
}

// Per-team position log appended at closeSeason — drives rivalry detection.
export interface TeamSeasonSnapshot {
  teamId: number;
  year: number;
  divisionOrden: number;
  position: number;
  points: number;
  won: number;
  lost: number;
}

export interface Rivalry {
  teamAId: number;
  teamAName: string;
  teamBId: number;
  teamBName: string;
  seasons: number; // consecutive seasons in adjacent positions
  headToHead: { wins: number; draws: number; losses: number }; // A's perspective
}

export interface PlayerSeed {
  name: string;
  posicion: PlayerPosition;
  calidad: number;
  nationality?: string; // defaults to 'local'
  cantera?: boolean;    // defaults to false
}

// Norms & sanctions (§4.7). The commissioner defines rules; autonomous teams
// may breach them; the commissioner sanctions the offenders.
export type NormType = 'tope_plantilla' | 'minimo_competitivo' | 'tope_salarial' | 'tope_extrangeros' | 'minimo_cantera' | 'tope_edad_media' | 'tope_deficit';

export interface Norm {
  id: number;
  tipo: NormType;
  valor: number;
}

export interface Sanction {
  id: number;
  teamId: number;
  normId: number;
  year: number; // season the sanction was issued in
  appliesToYear: number; // season the point penalty applies to
  motivo: string;
  castigo: string;
  pointsPenalty: number;
}

export interface NormBreach {
  teamId: number;
  teamName: string;
  normId: number;
  tipo: NormType;
  valor: number;
  valorActual: number;
  sanctioned: boolean;
}

// Federation commercial income (§4.5).
export type CommercialContractType =
  | 'patrocinio'
  | 'publicidad'
  | 'derechos_tv'
  | 'derechos_imagen';

export interface CommercialContract {
  id: number;
  tipo: CommercialContractType;
  nombre: string;
  valorAnual: number;
  yearsLeft: number;
}

export interface ContractOffer {
  id: number;
  tipo: CommercialContractType;
  nombre: string;
  valorAnual: number;
  years: number;
}

export interface EconomyPolicy {
  // Annual investment in talent formation (slowly raises league quality).
  talentInvestment: number;
}

// Prize-by-competition (Fase 6.5). The commissioner defines a pool + a share
// table for each competition; the engine pays out at the close of that
// competition (league in closeSeason, cup in playCupRound when crowned).
export interface CompetitionPrize {
  id: number;
  kind: 'liga' | 'copa';
  cupId: number | null; // set when kind === 'copa'
  pool: number; // total € distributed across positions
  // Percent shares summing to ~100 (e.g. [50, 25, 15, 10]). Length determines
  // how many top positions get paid; extra positions get nothing.
  shares: number[];
}

// Append-only ledger of prizes that were actually paid out.
export interface PrizePayment {
  year: number;
  competitionLabel: string; // 'Liga' or the cup name
  teamId: number;
  teamName: string;
  position: number; // 1-based
  amount: number;
}

// Snapshot of the last closed season's federation finances (for the UI).
export interface LastEconomy {
  year: number;
  income: number;
  operatingCost: number;
  normCost: number;
  prizes: number;
  talent: number;
  net: number;
  transferFees: number;
  transferIncome: number;
  matchday: number;
  merchandise: number;
  treasuryAfter: number;
}

// Pretemporada transfer window (Fase 6.4). Append-only: every entry is a
// player that actually moved teams in that year. Drives the "Fichajes"
// report shown between seasons.
export interface TransferEntry {
  year: number;
  playerId: number;
  playerName: string;
  fromTeamId: number;
  fromTeamName: string;
  toTeamId: number;
  toTeamName: string;
  calidad: number;
  transferFee: number;
  // Fase 11.3: set when the transfer crosses federation boundaries.
  isInternational?: boolean;
  fromFederationName?: string; // set when player arrives from a rival federation
  toFederationName?: string;   // set when player leaves to a rival federation
}

// Mid-season commissioner actions (Proposal 1: Mid-Season Agency).
export type CommissionerAction = 'call_review' | 'emergency_meeting' | 'postpone_matchday' | 'cultivate_arraigo';

export interface ActionRecord {
  id: number;
  year: number;
  matchday: number;
  type: CommissionerAction;
  cost: number;
  targetTeamId: number | null;
  result: string;
}

export interface RivalAction {
  federationId: number;
  type: 'poach' | 'invest' | 'retaliate';
  targetTeamId?: number;
  amount?: number;
  description: string;
}

export interface GlobalRanking {
  federationId: number;
  federationName: string;
  rank: number;
  avgStrength: number;
  prestige: number;
  teamCount: number;
  score: number;
}

export interface SeasonRecord {
  year: number;
  divisionOrden: number;
  championId: number;
  championName: string;
  points: number;
  prestigeBefore: number;
  prestigeAfter: number;
  delta: number;
  // Fase 15B: competitive balance index (0-100) for this division's closed
  // season. Optional so old saves (migrated, never backfilled) stay valid.
  balanceIndex?: number;
}

// Fase 11.2: thin virtual player for rival leagues (no salary/position tracking).
export interface RivalPlayer {
  id: number;
  name: string;
  teamId: number;
  goals: number; // current season; reset at generateRivalPlayers each startSeason
}

// Fase 11.2/11.4: season summary for one rival federation — champion, cup, top scorer, relegated.
export interface RivalSeasonRecord {
  year: number;
  federationId: number;
  federationName: string;
  championId: number;
  championName: string;
  runnerUpName: string | null;
  topScorer: { playerId: number; name: string; teamName: string; goals: number } | null;
  relegated: string[];
  promoted: string[]; // teams that came up from div2 this season
  points: number; // champion's final league points
  // Fase 11.4: winner of the top-4 mini-cup simulated at closeSeason.
  cupWinner?: { name: string; teamId: number };
}

// Fase 11: individual rival fixture (pre-generated at startSeason).
export interface RivalFixture {
  homeId: number;
  awayId: number;
  matchday: number;
  federationId: number;
  divisionOrden: number;
}

// Fase 11: result of one rival match (stored for Dashboard display).
export interface RivalMatchResult {
  matchday: number;
  federationId: number;
  divisionOrden: number;
  homeId: number;
  homeName: string;
  awayId: number;
  awayName: string;
  homeGoals: number;
  awayGoals: number;
  isShock: boolean; // weaker team won — used for headlines
}

// Standings row for rival leagues (simulated off-screen).
export interface RivalStandingRow {
  teamId: number;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
}

export interface GameState {
  seed: number;
  rng: RngState;
  year: number;
  phase: SeasonPhase;
  // Player federation prestige. Mirrors the player Federation entry in
  // `federations` (kept in sync); the season-close delta drives it.
  prestige: number;
  playerFederationId: number;
  // Player-chosen commissioner name (§ identity). Purely cosmetic/narrative.
  commissionerName: string;
  leagueFormat: LeagueFormat;
  federations: Federation[];
  divisions: Division[];
  teams: Team[];
  negotiations: Negotiation[];
  nextNegotiationId: number;
  // Economy (§4.5): federation finances managed by the commissioner.
  treasury: number;
  economy: EconomyPolicy;
  commercialContracts: CommercialContract[];
  contractOffers: ContractOffer[];
  lastEconomy: LastEconomy | null;
  nextContractId: number;
  // Norms & sanctions (§4.7).
  norms: Norm[];
  sanctions: Sanction[];
  nextNormId: number;
  nextSanctionId: number;
  violationHistory: Record<number, Record<number, number>>; // teamId -> normId -> count
  // Awards layer (§6): players with per-season stats. Attribution uses its own
  // rng so adding it does not perturb the match-engine stream (golden-safe).
  players: Player[];
  awards: Award[];
  attributionRng: RngState;
  nextPlayerId: number;
  // Events / polémicas (§1, §2): rare, decision-bearing incidents. Spawned
  // from an independent rng so the match engine stays golden-stable.
  events: GameEvent[];
  eventsRng: RngState;
  nextEventId: number;
  // Cups / tournaments (§4.4).
  cups: Cup[];
  cupsRng: RngState;
  nextCupId: number;
  cupSchedule: CupScheduleEntry[];
  cupTemplates: CupTemplate[];
  // Transfer window (Fase 6.4): independent rng + append-only log.
  transfersRng: RngState;
  transfers: TransferEntry[];
  // Prize-by-competition (Fase 6.5): definitions set in pretemporada and the
  // append-only ledger of payouts.
  competitionPrizes: CompetitionPrize[];
  nextPrizeId: number;
  prizePayments: PrizePayment[];
  fixtures: Fixture[];
  results: MatchResult[];
  matchReports: MatchReport[];
  currentMatchday: number;
  totalMatchdays: number;
  impulsesPerSeason: number;
  impulsesRemaining: number;
  pendingImpulses: PendingImpulse[];
  actionHistory: ActionRecord[];
  nextActionId: number;
  rivalActions: RivalAction[];
  globalRankings: GlobalRanking[];
  history: SeasonRecord[];
  seasonOver: boolean;
  // Event-driven temporary effects (reset each season close).
  eventStrengthPenalty: number;
  eventCapacityPenaltyPct: number;
  eventImpulseLoss: number;
  eventTreasuryInjection: number;
  // Poach cooldown: teamId → year until which poaching is blocked.
  poachCooldowns: Record<number, number>;
  // Rival simulation (Fase 9): confederations, independent rng, and computed standings.
  confederations: Confederation[];
  rivalRng: RngState;
  // Rival standings per division key "federationId:divisionOrden".
  rivalStandings: Record<string, RivalStandingRow[]>;
  // Rival champions per year (appended each closeSeason).
  rivalChampions: SeasonRecord[];
  // Fase 11: incremental rival simulation.
  rivalFixtures: RivalFixture[];           // generated at startSeason, cleared at closeSeason
  rivalCurrentMatchday: number;            // how far rivals have been simulated this season
  rivalLastMatchdayResults: RivalMatchResult[]; // last processed matchday (for Dashboard)
  // Fase 11.2: virtual rival players + season history.
  rivalPlayers: RivalPlayer[];
  nextRivalPlayerId: number;
  rivalSeasonRecords: RivalSeasonRecord[];
  // Board mandates (Batch 4): one per season, issued at startSeason.
  mandates: BoardMandate[];
  nextMandateId: number;
  consecutiveMandateFails: number; // resets on success; 2 consecutive → -1 impulse/season
  mandatesRng: RngState;
  // Narrative layer (Batch 5): season chronicles + team position history.
  seasonChronicles: SeasonChronicle[];
  teamSeasonHistory: TeamSeasonSnapshot[];
  // Batch 7: accumulated historical records and federation world ranking.
  recordBook: RecordBook | null;
  federationCoefficients: FederationCoefficient[];
  schemaVersion: number;
  // Club rescue log: every commissioner injection appears here.
  rescueLog: RescueEntry[];
  // Counter for team sponsor IDs (independent of federation contract IDs).
  nextTeamSponsorId: number;
  // Fase 13.3: player IDs protected from outgoing inter-league transfer this season.
  transferVetoes: number[];
  // Fase 13.4: solidarity revenue accumulated from outgoing inter-league transfers
  // during startSeason; consumed by processEconomy at closeSeason.
  outgoingTransferRevenue: number;
  // Fase 14.6: narrative timeline of the player's federation.
  federationLog: FederationLogEntry[];
  nextFederationLogId: number;
  // Fase 14.4: Commissioner inbox.
  mailbox: MailboxMessage[];
  nextMailboxId: number;
  // Fase 14.5: club requests + arraigo-driven exodus tracking.
  clubDemands: ClubDemand[];
  nextDemandId: number;
  lowArraigoSeasons: Record<number, number>; // teamId → consecutive low-arraigo closes
  demandsRng: RngState; // independent stream so demands never perturb events/match
  // Fase 14.8: board confidence + defeat.
  boardConfidence: BoardConfidence;
  gameOver: GameOver | null;
  negativeTreasurySeasons: number;
  // Fase 15: talent pipeline (potencial rolls, development, youth intake,
  // early retirement). Independent stream so it never perturbs the match
  // engine, awards attribution, or any other existing stream.
  talentRng: RngState;
}

export interface RecordBook {
  biggestWin: {
    margin: number;
    homeId: number;
    homeName: string;
    awayId: number;
    awayName: string;
    homeGoals: number;
    awayGoals: number;
    year: number;
  } | null;
  longestWinStreak: {
    teamId: number;
    teamName: string;
    count: number;
    year: number;
  } | null;
}

// Fase 14.8: board confidence + defeat (destitution).
export type GameOverReason =
  | 'destitucion_confianza'
  | 'quiebra'
  | 'exodo'
  | 'mandatos'
  | 'liga_vacia';

export interface BoardConfidenceEntry {
  year: number;
  value: number;
  reason: string;
}

export interface BoardConfidence {
  value: number; // 0-100
  history: BoardConfidenceEntry[];
}

export interface GameOver {
  reason: GameOverReason;
  year: number;
  message: string;
}

// Fase 14.5: club requests to the commissioner. Ignoring them erodes arraigo;
// chronic low arraigo makes a club leave the federation.
export type ClubDemandType = 'rescate' | 'inversion_estadio';

export interface ClubDemand {
  id: number;
  teamId: number;
  type: ClubDemandType;
  year: number;
  createdMatchday: number;
  deadlineMatchday: number;
  amount: number | null;     // € requested (rescue injection / stadium works)
  resolved: boolean;
  satisfied: boolean | null; // true if attended in time, false if ignored/rejected
}

// Fase 14.4: Commissioner inbox message.
export type MailboxCategory = 'peticion' | 'evento' | 'aviso' | 'hito' | 'financiero';
export type MailboxStatus = 'sin_leer' | 'leido' | 'resuelto' | 'caducado';
export type MailboxActionKind = 'rescue_request' | 'demand' | 'event';

export interface MailboxMessage {
  id: number;
  year: number;
  matchday: number; // 0 in pretemporada
  category: MailboxCategory;
  title: string;
  body: string;
  status: MailboxStatus;
  // If actionable, describes the linked domain object:
  actionKind: MailboxActionKind | null;
  refId: number | null; // GameEvent id / demand id / team id
  teamId: number | null;
  deadlineMatchday: number | null; // if it expires unresolved → consequence (14.5)
  createdAtMatchday: number;
}

// Fase 14.6: narrative timeline of the player's federation.
export type FederationLogType =
  | 'prestige_snapshot'    // season close: prestige before→after
  | 'sponsor_signed'       // commercial contract signed
  | 'negotiation_started'  // adhesion negotiation opened
  | 'negotiation_effective' // team joined the federation
  | 'team_created'         // club built from scratch
  | 'team_left'            // club left the federation (Fase 14.5)
  | 'rescue'               // commissioner injected cash into a club
  | 'norm_created'         // governance rule defined
  | 'sanction'             // a club was sanctioned
  | 'mandate_result'       // board mandate met / failed
  | 'title';               // player-league champion crowned

export interface FederationLogEntry {
  id: number;
  year: number;
  matchday: number;      // 0 = pretemporada / season close
  type: FederationLogType;
  title: string;
  detail: string;
  value: number | null;  // € or prestige points, depending on type
  teamId: number | null;
}

export interface FederationCoefficient {
  federationId: number;
  name: string;
  cumulativeScore: number;
  lastRank: number;
  lastScore: number;
  seasonsRanked: number;
}

export interface CreateGameOptions {
  teamNames?: string[];
  // Player league teams seeded from the domain (backend world generator).
  teams?: Array<{
    name: string;
    strength: number;
    arraigo?: number;
    youthStrength?: number;
    stadiumCapacity?: number;
    academia?: number;
    squad?: PlayerSeed[];
  }>;
  // Rival federations with their divisional structure (negotiation targets).
  rivals?: Array<{
    name: string;
    prestige: number;
    confederationId?: number;
    divisions: Array<{
      orden: number;
      name: string;
      teams: Array<{ name: string; strength: number; arraigo: number }>;
    }>;
  }>;
  // Fase 9: confederations + league structure for rival sim.
  confederations?: Array<Confederation & { leagues: Array<{ name: string; country: string; flag: string }> }>;
  playerFederationName?: string;
  commissionerName?: string;
  impulsesPerSeason?: number;
  startingPrestige?: number;
  startingTreasury?: number;
}
