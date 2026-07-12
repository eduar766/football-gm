import { describe, expect, it } from 'vitest';
import { buildFeaturedReport, createGame, isFeaturedMatch, type GameState, type MatchReport } from '../src/index';

function baseGame(seed: number, teamCount = 6): GameState {
  return createGame(seed, {
    teams: Array.from({ length: teamCount }, (_, i) => ({ name: `Club ${i + 1}`, strength: 55 })),
  });
}

function report(overrides: Partial<MatchReport>): MatchReport {
  return {
    matchday: 1,
    divisionOrden: 1,
    homeId: 1,
    awayId: 2,
    homeGoals: 1,
    awayGoals: 0,
    goalscorers: [],
    homeYellowCards: 0,
    awayYellowCards: 0,
    homeRedCards: 0,
    awayRedCards: 0,
    ...overrides,
  };
}

describe('buildFeaturedReport / isFeaturedMatch', () => {
  it('returns null for an ordinary, unremarkable match', () => {
    const g = baseGame(1);
    const r = report({ homeGoals: 1, awayGoals: 1 });
    expect(buildFeaturedReport(g, r)).toBeNull();
    expect(isFeaturedMatch(g, r)).toBe(false);
  });

  it('tags a blowout (margin >= 4) as goleada', () => {
    const g = baseGame(2);
    const r = report({ homeGoals: 5, awayGoals: 0 });
    const featured = buildFeaturedReport(g, r);
    expect(featured).not.toBeNull();
    expect(featured!.tags).toContain('goleada');
  });

  it('does not tag a margin of 3 as goleada', () => {
    const g = baseGame(3);
    const r = report({ homeGoals: 4, awayGoals: 1 });
    const featured = buildFeaturedReport(g, r);
    expect(featured?.tags.includes('goleada') ?? false).toBe(false);
  });

  it('tags a hat-trick and names the scorer', () => {
    const g = baseGame(4);
    g.players = [
      { id: 1, teamId: 1, name: 'Killer Striker', posicion: 'DEL', calidad: 70, potencial: 80, age: 25, season: { goals: 0, assists: 0, cleanSheets: 0, yellowCards: 0, redCards: 0 }, matchesSuspendedLeft: 0, injuredMatchesLeft: 0, nationality: 'local', cantera: false },
    ];
    const r = report({
      homeGoals: 3,
      awayGoals: 0,
      goalscorers: [
        { playerId: 1, minute: 10 },
        { playerId: 1, minute: 40 },
        { playerId: 1, minute: 70 },
      ],
    });
    const featured = buildFeaturedReport(g, r);
    expect(featured).not.toBeNull();
    expect(featured!.tags).toContain('hat_trick');
    expect(featured!.narrative).toContain('Killer Striker');
  });

  it('does not tag 2 goals by the same player as a hat-trick', () => {
    const g = baseGame(5);
    g.players = [
      { id: 1, teamId: 1, name: 'Scorer', posicion: 'DEL', calidad: 70, potencial: 80, age: 25, season: { goals: 0, assists: 0, cleanSheets: 0, yellowCards: 0, redCards: 0 }, matchesSuspendedLeft: 0, injuredMatchesLeft: 0, nationality: 'local', cantera: false },
    ];
    const r = report({
      homeGoals: 2,
      awayGoals: 0,
      goalscorers: [
        { playerId: 1, minute: 10 },
        { playerId: 1, minute: 40 },
      ],
    });
    expect(buildFeaturedReport(g, r)?.tags.includes('hat_trick') ?? false).toBe(false);
  });

  it('tags a genuine lead swap as remontada, but not a mere equalizer or an insurance goal', () => {
    const g = baseGame(6);
    g.players = [
      { id: 1, teamId: 1, name: 'Home Scorer', posicion: 'DEL', calidad: 60, potencial: 70, age: 25, season: { goals: 0, assists: 0, cleanSheets: 0, yellowCards: 0, redCards: 0 }, matchesSuspendedLeft: 0, injuredMatchesLeft: 0, nationality: 'local', cantera: false },
      { id: 2, teamId: 2, name: 'Away Scorer A', posicion: 'DEL', calidad: 60, potencial: 70, age: 25, season: { goals: 0, assists: 0, cleanSheets: 0, yellowCards: 0, redCards: 0 }, matchesSuspendedLeft: 0, injuredMatchesLeft: 0, nationality: 'local', cantera: false },
      { id: 3, teamId: 2, name: 'Away Scorer B', posicion: 'DEL', calidad: 60, potencial: 70, age: 25, season: { goals: 0, assists: 0, cleanSheets: 0, yellowCards: 0, redCards: 0 }, matchesSuspendedLeft: 0, injuredMatchesLeft: 0, nationality: 'local', cantera: false },
    ];
    // Home scores first (1-0), away equalizes then takes the lead (1-1, 1-2) — a real swap.
    const swap = report({
      homeGoals: 1,
      awayGoals: 2,
      goalscorers: [
        { playerId: 1, minute: 10 }, // 1-0 (home leads)
        { playerId: 2, minute: 50 }, // 1-1 (tied)
        { playerId: 3, minute: 80 }, // 1-2 (away leads — SWAP from home to away)
      ],
    });
    expect(buildFeaturedReport(g, swap)?.tags.includes('remontada') ?? false).toBe(true);

    // Home scores twice, no swap — away never leads.
    const noSwap = report({
      homeGoals: 2,
      awayGoals: 1,
      goalscorers: [
        { playerId: 1, minute: 10 }, // 1-0
        { playerId: 2, minute: 50 }, // 1-1 (tied, not a lead)
        { playerId: 1, minute: 80 }, // 2-1 (home extends, still never lost the lead)
      ],
    });
    expect(buildFeaturedReport(g, noSwap)?.tags.includes('remontada') ?? false).toBe(false);
  });

  it('tags a derby when the pair has a detected rivalry', () => {
    const g = baseGame(7);
    const [t1, t2] = g.teams;
    g.teamSeasonHistory = [
      { teamId: t1.id, year: 1, divisionOrden: 1, position: 1, points: 50, won: 15, lost: 2 },
      { teamId: t2.id, year: 1, divisionOrden: 1, position: 2, points: 48, won: 14, lost: 3 },
      { teamId: t1.id, year: 2, divisionOrden: 1, position: 2, points: 45, won: 13, lost: 4 },
      { teamId: t2.id, year: 2, divisionOrden: 1, position: 1, points: 47, won: 14, lost: 3 },
    ];
    const r = report({ homeId: t1.id, awayId: t2.id, homeGoals: 1, awayGoals: 1 });
    const featured = buildFeaturedReport(g, r);
    expect(featured).not.toBeNull();
    expect(featured!.tags).toContain('derbi');
  });

  it('does not tag a derby for a pair with no rivalry history', () => {
    const g = baseGame(8);
    const [t1, t2] = g.teams;
    const r = report({ homeId: t1.id, awayId: t2.id, homeGoals: 1, awayGoals: 1 });
    expect(buildFeaturedReport(g, r)?.tags.includes('derbi') ?? false).toBe(false);
  });

  it('tags a title-race duel: both teams top-3, tight gap, inside the last 3 matchdays', () => {
    const g = baseGame(9);
    g.totalMatchdays = 10;
    const [t1, t2, t3] = g.teams;
    // t1 and t3 beats t3 4 times each (matchdays 1-4 / 5-8) — t1 and t2 end up
    // level on points at the top, t3 rock bottom.
    g.results = [
      ...Array.from({ length: 4 }, (_, i) => ({
        matchday: i + 1,
        divisionOrden: 1,
        homeId: t1.id,
        awayId: t3.id,
        homeGoals: 2,
        awayGoals: 0,
      })),
      ...Array.from({ length: 4 }, (_, i) => ({
        matchday: i + 5,
        divisionOrden: 1,
        homeId: t2.id,
        awayId: t3.id,
        homeGoals: 2,
        awayGoals: 0,
      })),
    ];
    // Matchday 9 (inside the last 3 of 10): t1 vs t2, both top of the table, gap 0.
    const r = report({ matchday: 9, divisionOrden: 1, homeId: t1.id, awayId: t2.id, homeGoals: 1, awayGoals: 1 });
    const featured = buildFeaturedReport(g, r);
    expect(featured).not.toBeNull();
    expect(featured!.tags).toContain('titulo');
  });

  it('does not tag a title duel outside the last 3 matchdays', () => {
    const g = baseGame(10);
    g.totalMatchdays = 20;
    const [t1, t2] = g.teams;
    const r = report({ matchday: 1, divisionOrden: 1, homeId: t1.id, awayId: t2.id, homeGoals: 1, awayGoals: 1 });
    expect(buildFeaturedReport(g, r)?.tags.includes('titulo') ?? false).toBe(false);
  });

  it('a match with unknown team ids returns null', () => {
    const g = baseGame(11);
    const r = report({ homeId: 9999, awayId: 9998, homeGoals: 5, awayGoals: 0 });
    expect(buildFeaturedReport(g, r)).toBeNull();
  });
});
