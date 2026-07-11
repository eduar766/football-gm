// Public API of @football-gm/engine.
// Only exports listed here are accessible to external consumers (backend, contracts).

// ── Types (all public) ───────────────────────────────────────────────────────
export * from './types';

// ── Schema versioning & migrations ──────────────────────────────────────────
export { CURRENT_SCHEMA_VERSION, migrateState } from './migrations';

// ── RNG (needed by world-generator in backend) ───────────────────────────────
export { makeRng, randInt, rngNext } from './rng';
export type { RngState } from './rng';

// ── Name pools & deterministic name generators (world-gen + create-team) ──────
export {
  randomTeamName,
  randomFederationName,
  TEAM_PREFIXES,
  TEAM_PLACES,
  FEDERATION_ADJECTIVES,
  FEDERATION_REGIONS,
} from './names';

// ── Main season loop ─────────────────────────────────────────────────────────
export {
  CREATE_TEAM_COST,
  createGame,
  startSeason,
  advanceMatchday,
  advanceSeason,
  closeSeason,
  applyImpulse,
  createOwnTeam,
  setLeagueFormat,
  callReview,
  emergencyMeeting,
  postponeMatchday,
  cultivateArraigo,
  vetoTransfer,
  cancelTransferVeto,
} from './engine';

// ── Structural actions (pretemporada) ────────────────────────────────────────
export {
  pendingIntegrationTeams,
  runLevelingLeague,
  validateLevelingPlan,
  MAX_DIVISION_SIZE,
  MAX_LEVELING_DIVISIONS,
  PROMOTION_RELEGATION,
} from './structure';

// ── Negotiations & tier helpers ──────────────────────────────────────────────
export {
  tierOf,
  teamTier,
  playerTier,
  canNegotiate,
  negotiableTeams,
  startNegotiation,
  setNegotiationOfferValue,
} from './negotiation';

// ── Norms & sanctions ────────────────────────────────────────────────────────
export {
  normBreaches,
  addNorm,
  removeNorm,
  sanctionTeam,
  pointPenaltiesForYear,
  applyPointPenalties,
  governancePenalty,
  governanceBonus,
  teamMeetsNorm,
} from './norms';

// ── Economy ──────────────────────────────────────────────────────────────────
export {
  financialHealth,
  operatingCost,
  signContract,
  cancelContract,
  setEconomyPolicy,
  teamFinancialHealth,
  rescueTeam,
} from './economy';
export type { TeamFinancialHealth } from './economy';

// ── Salaries ─────────────────────────────────────────────────────────────────
export { playerSalary, wageBill } from './salaries';

// ── Prizes ───────────────────────────────────────────────────────────────────
export { setLeaguePrize, setCupPrize, removePrize } from './prizes';

// ── Cups ─────────────────────────────────────────────────────────────────────
export { createCup, createInterLeagueCup, deleteCup, editCupParticipants, roundsForCup, scheduleCups } from './cups';

// ── Standings ────────────────────────────────────────────────────────────────
export { computeStandings, competitiveBalanceIndex } from './standings';
export type { StandingRow } from './standings';

// ── Narrative / headlines ────────────────────────────────────────────────────
export { generateHeadlines, detectRivalries } from './headlines';

// ── Events ───────────────────────────────────────────────────────────────────
export { pendingEvents, resolveEvent } from './events';

// ── Mailbox (Fase 14.4) ──────────────────────────────────────────────────────
export { markMailRead, markAllMailRead, unreadMailCount } from './mailbox';

// ── Club demands (Fase 14.5) ─────────────────────────────────────────────────
export { resolveDemand } from './demands';

// ── Pre-season checklist (Fase 14.3) ─────────────────────────────────────────
export { preseasonChecklist, preseasonBlockers } from './preseason';
export type { ChecklistItem } from './preseason';

// ── Transfers ────────────────────────────────────────────────────────────────
export { teamStrengthFromSquad, transfersForYear, runTransferWindow } from './transfers';

// ── Talent pipeline (Fase 15) ─────────────────────────────────────────────────
export { generatePotencial, developPlayers, retirePlayers, intakeYouthPlayers } from './talent';

// ── Seed data (confederations for world-generator) ───────────────────────────
export { CONFEDERATIONS } from './seed-data';
export type { ConfederationData, LeagueData, TeamData, DivisionData } from './seed-data';
