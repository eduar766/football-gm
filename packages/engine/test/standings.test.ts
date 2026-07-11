import { describe, expect, it } from 'vitest';
import { competitiveBalanceIndex, type StandingRow } from '../src/index';

function row(teamId: number, points: number): StandingRow {
  return {
    teamId,
    name: `T${teamId}`,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDiff: 0,
    points,
  };
}

describe('competitiveBalanceIndex', () => {
  it('returns 100 when every team has identical points-per-matchday', () => {
    const rows = [row(1, 20), row(2, 20), row(3, 20), row(4, 20)];
    expect(competitiveBalanceIndex(rows, 10)).toBe(100);
  });

  it('returns 0 for a maximally unequal two-team split', () => {
    // ppm of 3 and 0 (one team wins everything, the other loses everything).
    const rows = [row(1, 30), row(2, 0)];
    expect(competitiveBalanceIndex(rows, 10)).toBe(0);
  });

  it('is always within [0, 100]', () => {
    const rows = [row(1, 45), row(2, 10), row(3, 30), row(4, 0), row(5, 22)];
    const idx = competitiveBalanceIndex(rows, 15);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThanOrEqual(100);
  });

  it('a tighter table scores higher than a lopsided one at the same matchday count', () => {
    const tight = [row(1, 22), row(2, 21), row(3, 20), row(4, 19)];
    const lopsided = [row(1, 30), row(2, 20), row(3, 12), row(4, 2)];
    expect(competitiveBalanceIndex(tight, 12)).toBeGreaterThan(competitiveBalanceIndex(lopsided, 12));
  });

  it('returns the neutral default when there is not enough signal', () => {
    expect(competitiveBalanceIndex([row(1, 10)], 5)).toBe(50); // single team
    expect(competitiveBalanceIndex([row(1, 0), row(2, 0)], 0)).toBe(50); // no matchdays played
  });
});
