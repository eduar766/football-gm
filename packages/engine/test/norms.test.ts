import { describe, expect, it } from 'vitest';
import {
  addNorm,
  advanceSeason,
  applyPointPenalties,
  closeSeason,
  createGame,
  governancePenalty,
  normBreaches,
  removeNorm,
  sanctionTeam,
  startSeason,
  type GameState,
  type StandingRow,
} from '../src/index';

function withTeams(seed: number, strengths: number[]): GameState {
  return createGame(seed, {
    teams: strengths.map((s, i) => ({
      name: `T${i + 1}`,
      strength: s,
      arraigo: 50,
    })),
  });
}

describe('defining norms', () => {
  it('adds and replaces (one per type) and removes', () => {
    let s = withTeams(1, Array(10).fill(55));
    s = addNorm(s, 'tope_plantilla', 60);
    expect(s.norms).toHaveLength(1);
    s = addNorm(s, 'tope_plantilla', 50); // replaces
    expect(s.norms).toHaveLength(1);
    expect(s.norms[0].valor).toBe(50);
    s = addNorm(s, 'minimo_competitivo', 40);
    expect(s.norms).toHaveLength(2);
    s = removeNorm(s, s.norms[0].id);
    expect(s.norms).toHaveLength(1);
  });
});

describe('breach detection', () => {
  it('flags teams over a squad cap', () => {
    let s = withTeams(2, [70, 68, 50, 50, 50, 50, 50, 50, 50, 50]);
    s = addNorm(s, 'tope_plantilla', 60);
    const b = normBreaches(s);
    expect(b.map((x) => x.teamId).sort((a, b) => a - b)).toEqual([1, 2]);
    expect(b.every((x) => !x.sanctioned)).toBe(true);
  });

  it('flags teams under a competitive minimum', () => {
    let s = withTeams(3, [60, 60, 60, 60, 60, 60, 60, 60, 38, 36]);
    s = addNorm(s, 'minimo_competitivo', 45);
    expect(normBreaches(s).map((x) => x.teamId).sort((a, b) => a - b)).toEqual([9, 10]);
  });
});

describe('sanctioning', () => {
  it('only sanctions an actual breach, once', () => {
    let s = withTeams(4, [70, 50, 50, 50, 50, 50, 50, 50, 50, 50]);
    s = addNorm(s, 'tope_plantilla', 60);
    const before = s.sanctions.length;
    s = sanctionTeam(s, 2, s.norms[0].id); // T2 (55? actually 50) does not breach
    expect(s.sanctions.length).toBe(before);
    s = sanctionTeam(s, 1, s.norms[0].id); // T1 breaches
    expect(s.sanctions).toHaveLength(1);
    s = sanctionTeam(s, 1, s.norms[0].id); // duplicate
    expect(s.sanctions).toHaveLength(1);
    expect(normBreaches(s).find((b) => b.teamId === 1)!.sanctioned).toBe(true);
  });
});

describe('governance prestige pressure (§4.7)', () => {
  it('unchecked breaches cost prestige; sanctioning removes the cost', () => {
    let s = withTeams(5, [70, 65, 50, 50, 50, 50, 50, 50, 50, 50]);
    s = addNorm(s, 'tope_plantilla', 60);
    expect(governancePenalty(s)).toBeLessThan(0);
    s = sanctionTeam(s, 1, s.norms[0].id);
    s = sanctionTeam(s, 2, s.norms[0].id);
    expect(governancePenalty(s)).toBe(0);
  });

  it('letting breaches slide lowers prestige vs an enforced control', () => {
    const base = () => {
      let s = withTeams(6, [72, 70, 68, 50, 50, 50, 50, 50, 50, 50]);
      return addNorm(s, 'tope_plantilla', 60);
    };
    const ignored = closeSeason(advanceSeason(startSeason(base())));
    let enforced = base();
    for (const b of normBreaches(enforced))
      enforced = sanctionTeam(enforced, b.teamId, b.normId);
    enforced = closeSeason(advanceSeason(startSeason(enforced)));
    expect(ignored.prestige).toBeLessThan(enforced.prestige);
  });
});

describe('point penalties', () => {
  it('subtracts points and re-sorts', () => {
    const rows: StandingRow[] = [
      { teamId: 1, name: 'A', played: 2, won: 2, drawn: 0, lost: 0, goalsFor: 4, goalsAgainst: 0, goalDiff: 4, points: 6 },
      { teamId: 2, name: 'B', played: 2, won: 1, drawn: 1, lost: 0, goalsFor: 3, goalsAgainst: 1, goalDiff: 2, points: 4 },
    ];
    const out = applyPointPenalties(rows, new Map([[1, 3]]));
    expect(out[0].teamId).toBe(2); // A dropped below B
    expect(out.find((r) => r.teamId === 1)!.points).toBe(3);
  });
});

describe('determinism with norms', () => {
  it('same seed + same actions => identical state', () => {
    const run = () => {
      let s = withTeams(404, [70, 65, 60, 55, 55, 55, 55, 55, 55, 55]);
      s = addNorm(s, 'tope_plantilla', 58);
      s = sanctionTeam(s, 1, s.norms[0].id);
      for (let i = 0; i < 4; i++) {
        if (s.phase === 'pretemporada') s = startSeason(s);
        s = closeSeason(advanceSeason(s));
      }
      return s;
    };
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });
});
