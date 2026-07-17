import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  advanceMatchday,
  advanceSeason,
  applyImpulse,
  closeSeason,
  computeStandings,
  createGame,
  startSeason,
  type GameState,
} from '../src/index';

const seed = () => fc.integer({ min: 1, max: 2 ** 31 - 1 });

// Equivalent of the old close-and-start-next: end one season AND open the next
// (in temporada, ready for another advanceSeason). Used by tests that want to
// step through several seasons in a row.
function playSeasons(s: GameState, n: number): GameState {
  if (s.phase === 'pretemporada') s = startSeason(s);
  for (let i = 0; i < n; i++) {
    s = closeSeason(advanceSeason(s));
    s = startSeason(s);
  }
  return s;
}

describe('league math invariants', () => {
  it('a full season is internally consistent for any seed', () => {
    fc.assert(
      fc.property(seed(), (sd) => {
        const g = advanceSeason(startSeason(createGame(sd)));
        const table = computeStandings(g.teams, g.results);
        const games = g.results.length;
        const draws = g.results.filter((r) => r.homeGoals === r.awayGoals).length;
        const sum = (k: (r: (typeof table)[number]) => number) =>
          table.reduce((a, r) => a + k(r), 0);

        // 10 teams, double round-robin => 90 matches, 18 matchdays.
        expect(games).toBe(90);
        expect(g.totalMatchdays).toBe(18);
        expect(g.seasonOver).toBe(true);
        expect(sum((r) => r.played)).toBe(2 * games);
        expect(sum((r) => r.won)).toBe(sum((r) => r.lost));
        expect(sum((r) => r.drawn) % 2).toBe(0);
        expect(sum((r) => r.points)).toBe(3 * games - draws);
        expect(g.teams).toHaveLength(10); // nothing is ever deleted
      }),
      { numRuns: 40 },
    );
  });
});

describe('determinism', () => {
  it('same seed => byte-identical state after several seasons', () => {
    fc.assert(
      fc.property(seed(), (sd) => {
        const a = playSeasons(createGame(sd), 4);
        const b = playSeasons(createGame(sd), 4);
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      }),
      { numRuns: 25 },
    );
  });

  it('different seeds diverge', () => {
    const a = playSeasons(createGame(101), 4);
    const b = playSeasons(createGame(102), 4);
    expect(JSON.stringify(a.history)).not.toBe(JSON.stringify(b.history));
  });
});

describe('purity (functional core)', () => {
  it('advanceMatchday does not mutate its input', () => {
    fc.assert(
      fc.property(seed(), (sd) => {
        const g = startSeason(createGame(sd));
        const before = JSON.stringify(g);
        advanceMatchday(g);
        expect(JSON.stringify(g)).toBe(before);
      }),
      { numRuns: 20 },
    );
  });
});

describe('history is append-only and structural', () => {
  it('closing a season appends exactly one record and lands in pretemporada', () => {
    fc.assert(
      fc.property(seed(), (sd) => {
        const finished = advanceSeason(startSeason(createGame(sd)));
        const closed = closeSeason(finished);
        expect(closed.history).toHaveLength(finished.history.length + 1);
        expect(closed.year).toBe(finished.year + 1);
        expect(closed.results).toHaveLength(0);
        expect(closed.phase).toBe('pretemporada');
        expect(closed.currentMatchday).toBe(0);
        expect(closed.seasonOver).toBe(false);
        expect(closed.prestige).toBeGreaterThanOrEqual(0);
        expect(closed.teams).toHaveLength(10);
        // previously written records are never rewritten
        expect(closed.history.slice(0, finished.history.length)).toEqual(
          finished.history,
        );
      }),
      { numRuns: 25 },
    );
  });

  it('closing in pretemporada is a no-op (guarded)', () => {
    const g = createGame(42);
    expect(closeSeason(g)).toBe(g);
  });

  it('closing an unfinished season is a no-op', () => {
    const g = startSeason(createGame(42));
    expect(closeSeason(g)).toBe(g);
  });
});

describe('presidents (Fase 17A)', () => {
  it('every player-federation team has exactly one president after creation', () => {
    fc.assert(
      fc.property(seed(), (sd) => {
        const g = createGame(sd);
        const playerTeamIds = g.teams
          .filter((t) => t.federationId === g.playerFederationId)
          .map((t) => t.id)
          .sort((a, b) => a - b);
        const presidentTeamIds = g.presidents.map((p) => p.teamId).sort((a, b) => a - b);
        expect(presidentTeamIds).toEqual(playerTeamIds);
      }),
      { numRuns: 25 },
    );
  });
});

describe('public opinion + political capital (Fase 17B)', () => {
  it('stay within their bounds and history stays append-only, across seasons', () => {
    fc.assert(
      fc.property(seed(), (sd) => {
        const g = playSeasons(createGame(sd), 4);
        expect(g.publicOpinion).toBeGreaterThanOrEqual(0);
        expect(g.publicOpinion).toBeLessThanOrEqual(100);
        expect(g.politicalCapital).toBeGreaterThanOrEqual(0);
        expect(g.politicalCapital).toBeLessThanOrEqual(12);
        // playSeasons runs with the default player-less game, so no signal
        // ever fires — opinion never leaves its starting neutral value.
        expect(g.opinionHistory).toEqual([]);
      }),
      { numRuns: 25 },
    );
  });
});

describe('assembly + pledges (Fase 17C)', () => {
  it('a player-less game never generates proposals/pledges across seasons', () => {
    fc.assert(
      fc.property(seed(), (sd) => {
        const g = playSeasons(createGame(sd), 4);
        expect(g.proposals).toEqual([]);
        expect(g.pledges).toEqual([]);
      }),
      { numRuns: 25 },
    );
  });
});

describe('integrity (Fase 17D)', () => {
  it('a player-less game never accumulates exposure or generates cases across seasons', () => {
    fc.assert(
      fc.property(seed(), (sd) => {
        const g = playSeasons(createGame(sd), 4);
        expect(g.exposureRisk).toBe(0);
        expect(g.integrityCases).toEqual([]);
        expect(g.impulseFavorCounts).toEqual({});
      }),
      { numRuns: 25 },
    );
  });

  it('exposureRisk always stays within [0, 95]', () => {
    fc.assert(
      fc.property(seed(), (sd) => {
        const g = playSeasons(createGame(sd), 4);
        expect(g.exposureRisk).toBeGreaterThanOrEqual(0);
        expect(g.exposureRisk).toBeLessThanOrEqual(95);
      }),
      { numRuns: 25 },
    );
  });
});

describe('desk (Fase 17E)', () => {
  it('a player-less game never touches desk state across seasons (referees, drought, bonus all inert)', () => {
    fc.assert(
      fc.property(seed(), (sd) => {
        const g = playSeasons(createGame(sd), 4);
        expect(g.deskPending).toBeNull();
        expect(g.primetimeDrought).toEqual({});
        expect(g.primetimeSeasonBonus).toBe(0);
        expect(g.consecutiveEvasions).toBe(0);
      }),
      { numRuns: 25 },
    );
  });
});

describe('conspiracy (Fase 17F)', () => {
  it('a player-less game never starts a conspiracy across seasons (golden guard)', () => {
    fc.assert(
      fc.property(seed(), (sd) => {
        const g = playSeasons(createGame(sd), 6);
        expect(g.conspiracy).toBeNull();
        expect(g.conspiracyHistory).toEqual([]);
      }),
      { numRuns: 25 },
    );
  });
});

describe('eras (Fase 17G)', () => {
  it('a player-less game never advances past era 1 across seasons (golden guard)', () => {
    fc.assert(
      fc.property(seed(), (sd) => {
        const g = playSeasons(createGame(sd), 6);
        expect(g.era).toBe(1);
        expect(g.eraHistory).toEqual([]);
        expect(g.eraMilestonesAchieved).toEqual([]);
      }),
      { numRuns: 25 },
    );
  });
});

describe('impulses', () => {
  it('cannot spend more impulses than allowed and never goes negative', () => {
    let g = startSeason(createGame(2024));
    const fixtures = g.fixtures.filter((f) => f.matchday === g.currentMatchday);
    for (const f of fixtures) g = applyImpulse(g, f, f.homeId);
    expect(g.impulsesRemaining).toBe(0);
    expect(g.pendingImpulses.length).toBe(g.impulsesPerSeason);
  });
});
