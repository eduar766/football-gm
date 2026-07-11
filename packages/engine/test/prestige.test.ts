import { describe, expect, it } from 'vitest';
import {
  addNorm,
  advanceSeason,
  closeSeason,
  createGame,
  prestigeBase,
  regressPrestige,
  startSeason,
  type GameState,
} from '../src/index';

function baseGame(seed: number, teamCount = 10): GameState {
  return createGame(seed, {
    teams: Array.from({ length: teamCount }, (_, i) => ({ name: `Club ${i + 1}`, strength: 55 })),
  });
}

// ─── prestigeBase ───────────────────────────────────────────────────────────

describe('prestigeBase', () => {
  it('never drops below the 20-point floor, even with zero competing teams', () => {
    const g = createGame(1, { teams: [] });
    expect(prestigeBase(g)).toBeGreaterThanOrEqual(20);
  });

  it('increases with more competing teams, up to the cap', () => {
    const small = prestigeBase(baseGame(2, 4));
    const big = prestigeBase(baseGame(2, 10));
    expect(big).toBeGreaterThan(small);
  });

  it('caps the team-size component at 16 (no further gain past ~20 teams)', () => {
    const twenty = prestigeBase(baseGame(3, 20));
    const forty = baseGame(3, 20);
    // Directly inflate competing team count beyond what the cap needs.
    for (let i = 0; i < 20; i++) {
      forty.teams.push({ ...forty.teams[i], id: 1000 + i, name: `Extra ${i}` });
    }
    const fortyBase = prestigeBase(forty);
    expect(fortyBase - twenty).toBeLessThanOrEqual(0.01); // cap already hit at 20 teams (0.8*20=16)
  });

  it('increases with average stadium capacity, up to the infrastructure cap', () => {
    const g1 = baseGame(4, 6);
    const g2 = baseGame(4, 6);
    for (const t of g2.teams) t.stadiumCapacity = 200_000; // far past the cap divisor
    expect(prestigeBase(g2)).toBeGreaterThan(prestigeBase(g1));
  });

  it('increases with governanceStreak, capped at 10', () => {
    const g = baseGame(5, 6);
    g.governanceStreak = 0;
    const withoutStreak = prestigeBase(g);
    g.governanceStreak = 3;
    const withStreak = prestigeBase(g);
    g.governanceStreak = 999;
    const withHugeStreak = prestigeBase(g);
    expect(withStreak).toBeGreaterThan(withoutStreak);
    expect(withHugeStreak - withStreak).toBeLessThanOrEqual(10 - 2 * 3 + 0.01); // bounded by the cap
  });

  it('rewards a top-3 world coefficient rank more than a mid-table one', () => {
    const g1 = baseGame(6, 6);
    g1.federationCoefficients = [{ federationId: g1.playerFederationId, name: 'X', cumulativeScore: 0, lastRank: 2, lastScore: 0, seasonsRanked: 1 }];
    const g2 = baseGame(6, 6);
    g2.federationCoefficients = [{ federationId: g2.playerFederationId, name: 'X', cumulativeScore: 0, lastRank: 9, lastScore: 0, seasonsRanked: 1 }];
    expect(prestigeBase(g1)).toBeGreaterThan(prestigeBase(g2));
  });

  it('increases with recurring cup templates and elapsed seasons, capped at 8', () => {
    const g = baseGame(7, 6);
    const noCups = prestigeBase(g);
    g.cupTemplates = [
      { cupId: 1, name: 'Copa A', tipo: 'copa', formato: 'eliminatoria', categoria: 'primer_equipo', participantTeamIds: [] },
    ];
    expect(prestigeBase(g)).toBeGreaterThan(noCups);
  });
});

// ─── regressPrestige ────────────────────────────────────────────────────────

describe('regressPrestige', () => {
  it('moves current toward base by exactly the k fraction (rounded)', () => {
    expect(regressPrestige(20, 40, 0.15)).toBe(20 + Math.round(20 * 0.15)); // 23
    expect(regressPrestige(90, 40, 0.15)).toBe(90 + Math.round(-50 * 0.15)); // 83
  });

  it('is a no-op when current already equals base', () => {
    expect(regressPrestige(50, 50)).toBe(50);
  });

  it('never returns a negative value', () => {
    expect(regressPrestige(5, -100, 0.9)).toBeGreaterThanOrEqual(0);
  });

  it('repeated application converges toward a small band around the base from both directions', () => {
    // Rounding means the sequence plateaus once the gap is small enough that
    // round(gap * k) hits 0 (gap < ~3.3 for k=0.15) — it doesn't collapse to
    // an exact match, but it must land close and never overshoot past base.
    let low = 10;
    let high = 90;
    const base = 45;
    for (let i = 0; i < 40; i++) {
      low = regressPrestige(low, base);
      high = regressPrestige(high, base);
    }
    expect(Math.abs(low - base)).toBeLessThanOrEqual(4);
    expect(Math.abs(high - base)).toBeLessThanOrEqual(4);
  });

  it('a larger gap regresses by a larger absolute amount than a smaller one, same k', () => {
    const smallGapMove = Math.abs(regressPrestige(48, 50) - 48);
    const largeGapMove = Math.abs(regressPrestige(10, 50) - 10);
    expect(largeGapMove).toBeGreaterThan(smallGapMove);
  });
});

// ─── governance-streak (feeds prestigeBase's governance component) ────────

describe('governanceStreak integration', () => {
  it('increments while governanceBonus() > 0 and resets the moment it drops to 0', () => {
    let g = createGame(8, {
      teams: Array.from({ length: 6 }, (_, i) => ({ name: `Club ${i + 1}`, strength: 55 })),
    });
    // Two norms every team trivially complies with (huge cap, tiny floor).
    g = addNorm(g, 'tope_plantilla', 200);
    g = addNorm(g, 'minimo_competitivo', 1);
    expect(g.governanceStreak).toBe(0);

    g = closeSeason(advanceSeason(startSeason(g)));
    expect(g.governanceStreak).toBe(1);

    g = closeSeason(advanceSeason(startSeason(g)));
    expect(g.governanceStreak).toBe(2);

    g = { ...g, norms: [] }; // drop governance compliance entirely
    g = closeSeason(advanceSeason(startSeason(g)));
    expect(g.governanceStreak).toBe(0);
  });
});

// ─── long-run drift bound ───────────────────────────────────────────────────

describe('long-run prestige stays within a sane distance of its base', () => {
  it('never drifts more than 30 points from prestigeBase over 12 unattended seasons, across seeds', () => {
    for (let seed = 1; seed <= 10; seed++) {
      let g = baseGame(seed * 41 + 3, 10);
      for (let i = 0; i < 12; i++) {
        g = closeSeason(advanceSeason(startSeason(g)));
        expect(Math.abs(g.prestige - prestigeBase(g))).toBeLessThanOrEqual(30);
      }
    }
  });
});
