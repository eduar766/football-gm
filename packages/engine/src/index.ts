// Public API of @football-gm/engine.
// Only exports listed here are accessible to external consumers (backend, contracts).

// ── Types (all public) ───────────────────────────────────────────────────────
export * from './types';

// ── Schema versioning & migrations ──────────────────────────────────────────
export { CURRENT_SCHEMA_VERSION, migrateState } from './migrations';

// ── RNG (needed by world-generator in backend) ───────────────────────────────
export { makeRng, randInt, rngNext } from './rng';
export type { RngState } from './rng';

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
} from './engine';

// ── Structural actions (pretemporada) ────────────────────────────────────────
export {
  pendingIntegrationTeams,
  runLevelingLeague,
  MAX_DIVISION_SIZE,
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
} from './norms';

// ── Economy ──────────────────────────────────────────────────────────────────
export {
  financialHealth,
  operatingCost,
  signContract,
  cancelContract,
  setEconomyPolicy,
} from './economy';

// ── Salaries ─────────────────────────────────────────────────────────────────
export { playerSalary, wageBill } from './salaries';

// ── Prizes ───────────────────────────────────────────────────────────────────
export { setLeaguePrize, setCupPrize, removePrize } from './prizes';

// ── Cups ─────────────────────────────────────────────────────────────────────
export { createCup, roundsForCup, scheduleCups } from './cups';

// ── Standings ────────────────────────────────────────────────────────────────
export { computeStandings } from './standings';
export type { StandingRow } from './standings';

// ── Narrative / headlines ────────────────────────────────────────────────────
export { generateHeadlines, detectRivalries } from './headlines';

// ── Events ───────────────────────────────────────────────────────────────────
export { pendingEvents, resolveEvent } from './events';

// ── Transfers ────────────────────────────────────────────────────────────────
export { teamStrengthFromSquad, transfersForYear } from './transfers';

// ── Seed data (confederations for world-generator) ───────────────────────────
export { CONFEDERATIONS } from './seed-data';
export type { ConfederationData, LeagueData, TeamData, DivisionData } from './seed-data';
