import { describe, expect, it } from 'vitest';
import {
  advanceSeason,
  closeSeason,
  createGame,
  setLeaguePrize,
  startSeason,
  type GameState,
  type PlayerPosition,
} from '../src/index';

function makeSquad(n: number, calidad: number, prefix: string) {
  const positions: PlayerPosition[] = ['POR', 'DEF', 'MED', 'DEL'];
  return Array.from({ length: n }, (_, i) => ({
    name: `${prefix}${i + 1}`,
    posicion: positions[i % 4],
    calidad,
  }));
}

// ─── Fase 15B: meritocratic-arraigo-bonus ──────────────────────────────────

describe('meritocratic-arraigo-bonus (Fase 15B)', () => {
  it('nets to zero arraigo change for the top 3 when the league split is strongly meritocratic (bonus cancels the seasonal decay)', () => {
    let g = createGame(700, {
      teams: Array.from({ length: 4 }, (_, i) => ({ name: `Club ${i + 1}`, strength: 55, arraigo: 50 })),
    });
    g = setLeaguePrize(g, 10_000_000, [70, 15, 10, 5]); // champion 70 >= 3x last (5)
    const before = new Map(g.teams.map((t) => [t.id, t.arraigo]));

    g = closeSeason(advanceSeason(startSeason(g)));

    const positions = g.teamSeasonHistory.filter((h) => h.year === 1).sort((a, b) => a.position - b.position);
    const top3Ids = new Set(positions.slice(0, 3).map((h) => h.teamId));
    for (const t of g.teams) {
      const expected = top3Ids.has(t.id) ? before.get(t.id)! : before.get(t.id)! - 2;
      expect(t.arraigo).toBe(expected);
    }
  });

  it('only applies the seasonal decay (no bonus) when the split is not meritocratic enough', () => {
    let g = createGame(701, {
      teams: Array.from({ length: 4 }, (_, i) => ({ name: `Club ${i + 1}`, strength: 55, arraigo: 50 })),
    });
    g = setLeaguePrize(g, 10_000_000, [25, 25, 25, 25]); // flat split
    const before = new Map(g.teams.map((t) => [t.id, t.arraigo]));

    g = closeSeason(advanceSeason(startSeason(g)));

    for (const t of g.teams) {
      expect(t.arraigo).toBe(before.get(t.id)! - 2);
    }
  });

  it('is a no-op when no league prize has been configured', () => {
    let g = createGame(702, {
      teams: Array.from({ length: 4 }, (_, i) => ({ name: `Club ${i + 1}`, strength: 55, arraigo: 50 })),
    });
    const before = new Map(g.teams.map((t) => [t.id, t.arraigo]));
    g = closeSeason(advanceSeason(startSeason(g)));
    for (const t of g.teams) {
      expect(t.arraigo).toBe(before.get(t.id)! - 2);
    }
  });
});

// ─── Fase 15B: balanceIndex reaches the season history ─────────────────────

describe('season history carries a balanceIndex (Fase 15B)', () => {
  it('every division history entry has a balanceIndex in [0, 100]', () => {
    const g = closeSeason(advanceSeason(startSeason(createGame(703))));
    expect(g.history.length).toBeGreaterThan(0);
    for (const h of g.history) {
      expect(h.balanceIndex).toBeDefined();
      expect(h.balanceIndex!).toBeGreaterThanOrEqual(0);
      expect(h.balanceIndex!).toBeLessThanOrEqual(100);
    }
  });
});

// ─── Fase 15B: closes the reparto <-> equilibrio loop ──────────────────────

function buildLeague(seed: number, shares: number[]): GameState {
  let g = createGame(seed, {
    teams: Array.from({ length: 6 }, (_, i) => ({
      name: `Club ${i + 1}`,
      strength: 55,
      squad: makeSquad(14, 55, `C${i + 1}-`),
    })),
  });
  g = setLeaguePrize(g, 60_000_000, shares);
  return g;
}

function playSeasons(g: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) g = closeSeason(advanceSeason(startSeason(g)));
  return g;
}

function strengthStdDev(g: GameState): number {
  const values = g.teams.filter((t) => t.divisionOrden !== null).map((t) => t.strength);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

describe('reparto -> equilibrio competitivo closed loop (Fase 15B)', () => {
  it('flat league shares produce, on average, a more balanced league than meritocratic shares over several seasons', () => {
    const trials = 60;
    let flatTotal = 0;
    let meritocraticTotal = 0;
    for (let seed = 1; seed <= trials; seed++) {
      flatTotal += strengthStdDev(playSeasons(buildLeague(seed * 53 + 1, [18, 18, 17, 17, 15, 15]), 8));
      meritocraticTotal += strengthStdDev(playSeasons(buildLeague(seed * 53 + 1, [70, 15, 8, 4, 2, 1]), 8));
    }
    expect(flatTotal / trials).toBeLessThan(meritocraticTotal / trials);
  });
});
