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
  setLeagueFormat,
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
  accelerateNegotiation,
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
export { createCup, createInterLeagueCup, deleteCup, editCupParticipants, roundsForCup, scheduleCups, deriveCupRunnerUp } from './cups';

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

// ── Structural prestige base (Fase 15C) ───────────────────────────────────────
export { prestigeBase, regressPrestige, PRESTIGE_REGRESSION_K } from './prestige';

// ── Featured matches (Fase 15D) ───────────────────────────────────────────────
export { buildFeaturedReport, isFeaturedMatch } from './featured';
export type { FeaturedReport, FeaturedTag, FeaturedMoment } from './featured';

// ── Seed data (confederations for world-generator) ───────────────────────────
export { CONFEDERATIONS } from './seed-data';
export type { ConfederationData, LeagueData, TeamData, DivisionData } from './seed-data';

// ── Characters (Fase 17A) ─────────────────────────────────────────────────────
export { presidentOf } from './characters';

// ── Politics (Fase 17B) ───────────────────────────────────────────────────────
export { earnPC, spendPC, PC_MIN, PC_MAX } from './politics';

// ── Assembly (Fase 17C) ───────────────────────────────────────────────────────
export {
  proposeMeasure,
  withdrawProposal,
  revealIntention,
  buyVote,
  pledgeForVote,
  resolveAllPendingProposals,
} from './assembly';

// ── Integrity (Fase 17D) ──────────────────────────────────────────────────────
export {
  INVESTIGATION_COST,
  EXPOSURE_MAX,
  startInvestigation,
  archiveCase,
  buryCase,
  sanctionFixing,
  pardonFixing,
} from './integrity';
