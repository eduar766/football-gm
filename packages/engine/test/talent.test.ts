import { describe, expect, it } from 'vitest';
import {
  addNorm,
  createGame,
  developPlayers,
  generatePotencial,
  intakeYouthPlayers,
  makeRng,
  retirePlayers,
  type GameState,
  type Player,
} from '../src/index';

// ─── generatePotencial ──────────────────────────────────────────────────────

describe('generatePotencial', () => {
  it('never drops below calidad and never exceeds 95', () => {
    const rng = makeRng(1);
    for (let i = 0; i < 500; i++) {
      const calidad = 20 + (i % 70);
      const age = 16 + (i % 25);
      const potencial = generatePotencial(rng, calidad, age);
      expect(potencial).toBeGreaterThanOrEqual(calidad);
      expect(potencial).toBeLessThanOrEqual(95);
    }
  });

  it('caps the margin at 0-3 for players aged 27+', () => {
    const rng = makeRng(2);
    for (let i = 0; i < 200; i++) {
      const potencial = generatePotencial(rng, 60, 27 + (i % 15));
      expect(potencial - 60).toBeGreaterThanOrEqual(0);
      expect(potencial - 60).toBeLessThanOrEqual(3);
    }
  });

  it('favorable (strong academy) rolls twice and keeps the best, on average', () => {
    const plain = makeRng(3);
    const favorable = makeRng(3);
    let plainTotal = 0;
    let favorableTotal = 0;
    const trials = 300;
    for (let i = 0; i < trials; i++) {
      plainTotal += generatePotencial(plain, 50, 20) - 50;
      favorableTotal += generatePotencial(favorable, 50, 20, true) - 50;
    }
    expect(favorableTotal / trials).toBeGreaterThan(plainTotal / trials);
  });
});

// ─── developPlayers ─────────────────────────────────────────────────────────

function makePlayer(overrides: Partial<Player> & { id: number; teamId: number }): Player {
  return {
    name: `P${overrides.id}`,
    posicion: 'MED',
    calidad: 50,
    potencial: 95,
    age: 24,
    season: { goals: 0, assists: 0, cleanSheets: 0, yellowCards: 0, redCards: 0 },
    matchesSuspendedLeft: 0,
    injuredMatchesLeft: 0,
    nationality: 'local',
    cantera: false,
    ...overrides,
  };
}

// Minimal single-team game: no squad from createGame (keeps players fully
// under test control), players attached directly to teams[0].
function baseGame(seed: number): GameState {
  return createGame(seed, {
    teams: [
      { name: 'Alpha FC', strength: 55 },
      { name: 'Beta FC', strength: 55 },
    ],
  });
}

describe('developPlayers', () => {
  it('never lets calidad exceed potencial, across several closeSeason-style calls', () => {
    const g = baseGame(10);
    const teamId = g.teams[0].id;
    let nextId = 1;
    for (let i = 0; i < 24; i++) {
      g.players.push(
        makePlayer({
          id: nextId++,
          teamId,
          calidad: 30 + (i % 40),
          potencial: 60 + (i % 30),
          age: 18 + (i % 20),
        }),
      );
    }
    for (let cycle = 0; cycle < 6; cycle++) {
      developPlayers(g);
      for (const p of g.players) {
        expect(p.calidad).toBeLessThanOrEqual(p.potencial);
      }
    }
  });

  it('titular role factor produces higher expected growth than suplente, all else equal', () => {
    // 20 players, distinct-but-close calidad so ranking is deterministic;
    // huge potencial headroom so the cap never binds and the role factor is
    // the only thing driving the difference.
    let titularGrowthSum = 0;
    let suplenteGrowthSum = 0;
    const trials = 60;

    for (let seed = 1; seed <= trials; seed++) {
      const g = baseGame(seed * 97 + 1);
      const teamId = g.teams[0].id;
      const players: Player[] = [];
      for (let i = 0; i < 20; i++) {
        players.push(
          makePlayer({ id: i + 1, teamId, calidad: 60 - i, potencial: 95, age: 20 }),
        );
      }
      g.players = players;
      const before = new Map(players.map((p) => [p.id, p.calidad]));
      developPlayers(g);
      const titular = g.players.filter((p) => p.id <= 11); // idx 0-10 => rank 1-11
      const suplente = g.players.filter((p) => p.id >= 17); // idx 16-19 => rank 17-20
      titularGrowthSum += titular.reduce((a, p) => a + (p.calidad - before.get(p.id)!), 0) / titular.length;
      suplenteGrowthSum += suplente.reduce((a, p) => a + (p.calidad - before.get(p.id)!), 0) / suplente.length;
    }

    expect(titularGrowthSum / trials).toBeGreaterThan(suplenteGrowthSum / trials);
  });

  it('a norm the team complies with (minimo_cantera) boosts U21 non-titular development', () => {
    let g = baseGame(20);
    const teamId = g.teams[0].id;
    const players: Player[] = [];
    // 11 titulares (rank 1-11, unaffected by the U21 boost — adults, age 28).
    for (let i = 0; i < 11; i++) {
      players.push(makePlayer({ id: i + 1, teamId, calidad: 70 - i, potencial: 95, age: 28 }));
    }
    // 5 rotación-tier U21 canteranos (rank 12-16) — enough to satisfy minimo_cantera >= 3.
    for (let i = 0; i < 5; i++) {
      players.push(
        makePlayer({ id: 100 + i, teamId, calidad: 40 - i, potencial: 95, age: 20, cantera: true }),
      );
    }
    g.players = players;
    // Compliant BEFORE cloning further state so both branches share talentRng.
    g = addNorm(g, 'minimo_cantera', 3);

    const withNorm = structuredClone(g);
    const withoutNorm = structuredClone(g);
    withoutNorm.norms = [];

    const before = new Map(players.map((p) => [p.id, p.calidad]));
    developPlayers(withNorm);
    developPlayers(withoutNorm);

    const rotacionIds = [100, 101, 102, 103, 104];
    let anyStrictlyGreater = false;
    for (const id of rotacionIds) {
      const a = withNorm.players.find((p) => p.id === id)!.calidad;
      const b = withoutNorm.players.find((p) => p.id === id)!.calidad;
      expect(a).toBeGreaterThanOrEqual(b);
      if (a > b) anyStrictlyGreater = true;
    }
    expect(anyStrictlyGreater).toBe(true);
    void before;
  });

  it('never grants an explosion jump when potencial - calidad < 15', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const g = baseGame(seed * 13 + 3);
      const teamId = g.teams[0].id;
      // gap = 10, age <= 21, academia 0 (default DEFAULT_ACADEMIA constant on
      // the team may be nonzero — zero it out so the bound below is exact).
      const team = g.teams.find((t) => t.id === teamId)!;
      team.academia = 0;
      g.players = [makePlayer({ id: 1, teamId, calidad: 40, potencial: 50, age: 20 })];
      const before = g.players[0].calidad;
      developPlayers(g);
      const gain = g.players[0].calidad - before;
      // Max non-explosion gain at growth phase, titular factor 1.0, no academia: round(3*1)=3.
      expect(gain).toBeGreaterThanOrEqual(0);
      expect(gain).toBeLessThanOrEqual(3);
    }
  });

  it('pushes a mejor_joven award matching the largest U21 growth this season, if any', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const g = baseGame(seed * 31 + 5);
      const teamId = g.teams[0].id;
      const players: Player[] = [
        makePlayer({ id: 1, teamId, calidad: 20, potencial: 95, age: 18 }), // huge headroom
        makePlayer({ id: 2, teamId, calidad: 94, potencial: 95, age: 19 }), // almost none
        makePlayer({ id: 3, teamId, calidad: 60, potencial: 95, age: 25 }), // not U21 (post-increment 26)
      ];
      g.players = players;
      const before = new Map(players.map((p) => [p.id, p.calidad]));
      developPlayers(g);

      let bestId: number | null = null;
      let bestDelta = 0;
      for (const p of g.players) {
        if (p.age > 21) continue;
        const delta = p.calidad - before.get(p.id)!;
        if (delta > bestDelta) {
          bestDelta = delta;
          bestId = p.id;
        }
      }

      const award = g.awards.find((a) => a.tipo === 'mejor_joven');
      if (bestDelta > 0) {
        expect(award).toBeDefined();
        expect(award!.playerId).toBe(bestId);
        expect(award!.valor).toBe(bestDelta);
      } else {
        expect(award).toBeUndefined();
      }
    }
  });
});

// ─── retirePlayers ──────────────────────────────────────────────────────────

describe('retirePlayers', () => {
  it('always removes players over 37 or below calidad 25, regardless of rng', () => {
    const g = baseGame(30);
    const teamId = g.teams[0].id;
    g.players = [
      makePlayer({ id: 1, teamId, age: 38, calidad: 80 }),
      makePlayer({ id: 2, teamId, age: 30, calidad: 24 }),
      makePlayer({ id: 3, teamId, age: 30, calidad: 26 }),
    ];
    retirePlayers(g);
    const ids = g.players.map((p) => p.id);
    expect(ids).not.toContain(1);
    expect(ids).not.toContain(2);
    expect(ids).toContain(3);
  });

  it('never removes players outside the 35-37 early-retirement window (and under the hard cutoffs)', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const g = baseGame(seed * 7 + 1);
      const teamId = g.teams[0].id;
      g.players = [makePlayer({ id: 1, teamId, age: 34, calidad: 60 })];
      retirePlayers(g);
      expect(g.players).toHaveLength(1);
    }
  });

  it('sometimes (not always, not never) retires players aged 35-37 early, over many trials', () => {
    let survived = 0;
    const trials = 200;
    for (let seed = 1; seed <= trials; seed++) {
      const g = baseGame(seed * 11 + 2);
      const teamId = g.teams[0].id;
      g.players = [makePlayer({ id: 1, teamId, age: 36, calidad: 60 })];
      retirePlayers(g);
      if (g.players.length === 1) survived++;
    }
    expect(survived).toBeGreaterThan(0);
    expect(survived).toBeLessThan(trials);
  });
});

// ─── intakeYouthPlayers ─────────────────────────────────────────────────────

describe('intakeYouthPlayers', () => {
  it('adds 1-2 canteranos aged 16-18 to teams with a tracked squad', () => {
    const g = baseGame(40);
    const teamId = g.teams[0].id;
    g.players = [makePlayer({ id: 1, teamId, age: 24, calidad: 55 })];
    g.nextPlayerId = 1000; // avoid id collisions with the intake-created players below
    const before = g.players.length;
    intakeYouthPlayers(g);
    const added = g.players.filter((p) => p.id !== 1);
    expect(g.players.length).toBeGreaterThan(before);
    expect(added.length).toBeGreaterThanOrEqual(1);
    expect(added.length).toBeLessThanOrEqual(2);
    for (const p of added) {
      expect(p.cantera).toBe(true);
      expect(p.age).toBeGreaterThanOrEqual(16);
      expect(p.age).toBeLessThanOrEqual(18);
      expect(p.potencial).toBeGreaterThanOrEqual(p.calidad);
    }
  });

  it('does not touch teams without a tracked squad (golden-safety guard)', () => {
    const g = baseGame(41);
    const teamId = g.teams[0].id; // Alpha FC has players
    const otherTeamId = g.teams[1].id; // Beta FC has none
    g.players = [makePlayer({ id: 1, teamId, age: 24, calidad: 55 })];
    g.nextPlayerId = 1000; // avoid id collisions with the intake-created players below
    intakeYouthPlayers(g);
    expect(g.players.some((p) => p.teamId === otherTeamId)).toBe(false);
  });

  it('is a no-op on a fully player-less game (never consumes talentRng)', () => {
    const a = baseGame(42);
    const b = baseGame(42);
    intakeYouthPlayers(a);
    expect(a.players).toHaveLength(0);
    expect(JSON.stringify(a.talentRng)).toBe(JSON.stringify(b.talentRng));
  });

  it('caps squads at 26 by trimming the weakest 30+ bench players', () => {
    const g = baseGame(43);
    const teamId = g.teams[0].id;
    const players: Player[] = [];
    for (let i = 0; i < 26; i++) {
      players.push(makePlayer({ id: i + 1, teamId, age: 32, calidad: 30 + i }));
    }
    g.players = players;
    g.nextPlayerId = 27; // avoid id collisions with the intake-created players below
    intakeYouthPlayers(g);
    const squad = g.players.filter((p) => p.teamId === teamId);
    expect(squad.length).toBeLessThanOrEqual(26);
    // The new canteranos (age 16-18) must never be the ones trimmed.
    expect(squad.some((p) => p.age <= 18)).toBe(true);
  });
});
