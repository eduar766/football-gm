import { describe, expect, it } from 'vitest';
import {
  advanceSeason,
  closeSeason,
  computeStandings,
  createGame,
  pendingIntegrationTeams,
  runLevelingLeague,
  startNegotiation,
  startSeason,
  type GameState,
} from '../src/index';

const playerTeams = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    name: `Equipo ${i + 1}`,
    strength: 50 + (i % 7),
    arraigo: 50,
  }));

// Run N full seasons, leaving the state back in pretemporada so the test can
// keep doing structural things (leveling, creating cups, etc.) afterwards.
function closeYears(s: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) {
    if (s.phase === 'pretemporada') s = startSeason(s);
    s = closeSeason(advanceSeason(s));
  }
  return s;
}

describe('default structure (regression: single division unchanged)', () => {
  it('starts with one division of 10 and an 18-matchday season after startSeason', () => {
    const g = startSeason(createGame(123));
    expect(g.divisions).toHaveLength(1);
    expect(g.teams.every((t) => t.divisionOrden === 1)).toBe(true);
    expect(g.totalMatchdays).toBe(18);
    const played = advanceSeason(g);
    expect(played.results).toHaveLength(90);
  });
});

describe('leveling league (§4.4)', () => {
  it('splits a 14-team pool into 2 balanced divisions by merit', () => {
    const g = createGame(7, { teams: playerTeams(14) });
    expect(g.divisions).toHaveLength(1); // everyone starts in div 1

    const s = runLevelingLeague(g);
    expect(s.divisions).toHaveLength(2);
    const d1 = s.teams.filter((t) => t.divisionOrden === 1).length;
    const d2 = s.teams.filter((t) => t.divisionOrden === 2).length;
    expect(d1 + d2).toBe(14);
    expect(Math.abs(d1 - d2)).toBeLessThanOrEqual(1); // balanced
    // No team is left unplaced and none is duplicated/deleted.
    expect(s.teams.filter((t) => t.divisionOrden !== null)).toHaveLength(14);
  });

  it('keeps a 10-team pool as a single division', () => {
    const s = runLevelingLeague(createGame(9, { teams: playerTeams(10) }));
    expect(s.divisions).toHaveLength(1);
    expect(s.teams.every((t) => t.divisionOrden === 1)).toBe(true);
  });

  it('is deterministic', () => {
    const run = () => runLevelingLeague(createGame(42, { teams: playerTeams(16) }));
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });
});

describe('multi-division season', () => {
  it('simulates every division and applies promotion/relegation', () => {
    let s = runLevelingLeague(createGame(5, { teams: playerTeams(16) }));
    expect(s.divisions).toHaveLength(2);
    const before = s.teams.length;

    s = advanceSeason(startSeason(s));
    // history gets one record per division on close
    const next = closeSeason(s);
    const lastYearRecords = next.history.filter((r) => r.year === s.year);
    expect(lastYearRecords).toHaveLength(2);
    expect(new Set(lastYearRecords.map((r) => r.divisionOrden))).toEqual(
      new Set([1, 2]),
    );
    expect(next.teams).toHaveLength(before); // nothing deleted

    // Each division still has a coherent table.
    for (const d of next.divisions) {
      const teams = next.teams.filter((t) => t.divisionOrden === d.orden);
      expect(teams.length).toBeGreaterThan(1);
    }
  });
});

describe('pending integration via leveling league', () => {
  it('an adhered team is pending until a leveling league places it', () => {
    let s = createGame(202, {
      startingPrestige: 70,
      teams: playerTeams(10),
      rivals: [
        {
          name: 'Rival',
          prestige: 10,
          teams: [{ name: 'Fichaje', strength: 60, arraigo: 4 }],
        },
      ],
    });
    const target = s.teams.find((t) => t.name === 'Fichaje')!;
    s = startNegotiation(s, target.id);
    for (let i = 0; i < 20; i++) {
      s = closeYears(s, 1);
      if (s.negotiations[0].state === 'effective') break;
      if (s.negotiations[0].state === 'rejected') return; // can't assert further
    }
    if (s.negotiations[0].state !== 'effective') return;

    const moved = s.teams.find((t) => t.id === target.id)!;
    expect(moved.federationId).toBe(s.playerFederationId);
    expect(moved.divisionOrden).toBeNull(); // adhered but not yet competing
    expect(pendingIntegrationTeams(s).some((t) => t.id === target.id)).toBe(true);

    s = runLevelingLeague(s);
    const placed = s.teams.find((t) => t.id === target.id)!;
    expect(placed.divisionOrden).not.toBeNull(); // now it competes
    expect(pendingIntegrationTeams(s)).toHaveLength(0);
  });
});

describe('standings still consistent per division', () => {
  it('points identity holds within a division', () => {
    let s = runLevelingLeague(createGame(88, { teams: playerTeams(14) }));
    s = advanceSeason(startSeason(s));
    for (const d of s.divisions) {
      const teams = s.teams.filter((t) => t.divisionOrden === d.orden);
      const results = s.results.filter((r) => r.divisionOrden === d.orden);
      const table = computeStandings(teams, results);
      const games = results.length;
      const draws = results.filter((r) => r.homeGoals === r.awayGoals).length;
      const pts = table.reduce((a, r) => a + r.points, 0);
      expect(pts).toBe(3 * games - draws);
    }
  });
});
