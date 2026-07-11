// Structural prestige base (Fase 15C). Derived, never stored — same
// precedent as tierOf(). closeSeason regresses `s.prestige` toward this
// value every season so a single brilliant season doesn't permanently
// inflate prestige and a single bad one doesn't collapse a solid project.
// Every component is capped so no single lever dominates the base.

import type { GameState } from './types';

const FLOOR = 20;
const TEAM_SIZE_PER_TEAM = 0.8;
const TEAM_SIZE_CAP = 16;
const INFRA_DIVISOR = 10_000;
const INFRA_CAP = 10;
const GOVERNANCE_PER_STREAK_YEAR = 2;
const GOVERNANCE_CAP = 10;
const COEFFICIENT_TOP3 = 8;
const COEFFICIENT_TOP6 = 5;
const COEFFICIENT_TOP10 = 2;
const TRADITION_PER_CUP = 1;
const TRADITION_PER_SEASON = 0.5;
const TRADITION_CAP = 8;

// Fase 15C: fraction of the gap to the structural base closed each season
// close. 0.15 = a 20-point gap closes by ~3 points/season.
export const PRESTIGE_REGRESSION_K = 0.15;

// Pure regression step: pulls `current` a fraction `k` of the way toward
// `base`. Never negative. Isolated from closeSeason's other prestige-moving
// systems (titleRaceGap, economy, governance...) so it can be unit-tested on
// its own — the full pipeline mixes this with a lot of other seasonal noise.
export function regressPrestige(current: number, base: number, k: number = PRESTIGE_REGRESSION_K): number {
  return Math.max(0, Math.round(current + (base - current) * k));
}

export function prestigeBase(s: GameState): number {
  const competing = s.teams.filter(
    (t) => t.federationId === s.playerFederationId && t.divisionOrden !== null,
  );

  // Consolidated size: more competing clubs is a slow, expensive thing to build.
  const teamSize = Math.min(TEAM_SIZE_CAP, TEAM_SIZE_PER_TEAM * competing.length);

  // Infrastructure: average stadium capacity across the player's league.
  const avgCapacity =
    competing.length > 0
      ? competing.reduce((a, t) => a + t.stadiumCapacity, 0) / competing.length
      : 0;
  const infra = Math.min(INFRA_CAP, avgCapacity / INFRA_DIVISOR);

  // Governance: consecutive seasons of well-enforced norms (see norms.ts
  // governanceBonus). A one-off streak doesn't move the base much; sustained
  // regulation does.
  const governance = Math.min(GOVERNANCE_CAP, GOVERNANCE_PER_STREAK_YEAR * s.governanceStreak);

  // World coefficient: last known global ranking (lagging by one season —
  // it's only recomputed after prestige settles, see accumulateFederationCoefficients).
  const coeff = s.federationCoefficients.find((c) => c.federationId === s.playerFederationId);
  const rank = coeff?.lastRank;
  const coefficient =
    rank === undefined
      ? 0
      : rank <= 3
        ? COEFFICIENT_TOP3
        : rank <= 6
          ? COEFFICIENT_TOP6
          : rank <= 10
            ? COEFFICIENT_TOP10
            : 0;

  // Tradition: recurring cups + how many seasons the league has actually run.
  const tradition = Math.min(
    TRADITION_CAP,
    TRADITION_PER_CUP * s.cupTemplates.length + TRADITION_PER_SEASON * s.year,
  );

  return FLOOR + teamSize + infra + governance + coefficient + tradition;
}
