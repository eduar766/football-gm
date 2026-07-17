import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  advanceSeason,
  closeSeason,
  createGame,
  createOwnTeam,
  startSeason,
  type GameState,
} from '../src/index';
import { presidentOf, presidentQuote, rivalCommissionerQuote } from '../src/characters';
import { generateHeadlines } from '../src/headlines';
import { progressNegotiations } from '../src/negotiation';
import { processExodus } from '../src/demands';

const SQUAD = [
  { name: 'A', posicion: 'DEL' as const, calidad: 60 },
  { name: 'B', posicion: 'MED' as const, calidad: 55 },
];

function gameWithRival(seed = 111): GameState {
  return createGame(seed, {
    startingTreasury: 100_000_000,
    teams: Array.from({ length: 6 }, (_, i) => ({ name: `E${i + 1}`, strength: 55, squad: SQUAD })),
    rivals: [
      {
        name: 'Rival FC',
        prestige: 60,
        divisions: [{ orden: 1, name: 'Primera', teams: [{ name: 'R1', strength: 60, arraigo: 50 }] }],
      },
    ],
  });
}

function closeOneSeason(g: GameState): GameState {
  return closeSeason(advanceSeason(startSeason(g)));
}

describe('characters (Fase 17A) — creation', () => {
  it('gives every player-federation team exactly one president, none for rivals', () => {
    const g = gameWithRival();
    const playerTeams = g.teams.filter((t) => t.federationId === g.playerFederationId);
    expect(g.presidents).toHaveLength(playerTeams.length);
    for (const t of playerTeams) expect(presidentOf(g, t.id)).toBeDefined();

    const rivalTeam = g.teams.find((t) => t.federationId !== g.playerFederationId)!;
    expect(presidentOf(g, rivalTeam.id)).toBeUndefined();
  });

  it('gives every rival federation exactly one commissioner, none for the player', () => {
    const g = gameWithRival();
    expect(g.rivalCommissioners).toHaveLength(1);
    expect(g.rivalCommissioners[0].federationId).not.toBe(g.playerFederationId);
  });

  it('same seed => identical presidents and commissioners', () => {
    const a = gameWithRival(777);
    const b = gameWithRival(777);
    expect(a.presidents).toEqual(b.presidents);
    expect(a.rivalCommissioners).toEqual(b.rivalCommissioners);
  });

  it('is a one-shot draw: never perturbs the match-engine rng stream', () => {
    // If character generation drew from `rng`, changing the team count would
    // shift every subsequent rng draw. It must not: rng's post-creation state
    // is a pure function of the seed alone.
    const a = createGame(555, { teams: Array.from({ length: 10 }, (_, i) => ({ name: `T${i}`, strength: 50 })) });
    const b = createGame(555, { teams: Array.from({ length: 4 }, (_, i) => ({ name: `T${i}`, strength: 50 })) });
    expect(a.rng).toEqual(b.rng);
  });
});

describe('characters (Fase 17A) — rotation at closeSeason', () => {
  it('rotates roughly 8% of presidents per season across many seeds (statistical)', () => {
    let rotations = 0;
    let total = 0;
    for (let seed = 1; seed <= 80; seed++) {
      const g = gameWithRival(seed);
      const before = new Map(g.presidents.map((p) => [p.teamId, p.name]));
      const closed = closeOneSeason(g);
      if (closed === g) continue; // guarded no-op (unfinished season); skip
      for (const p of closed.presidents) {
        total++;
        if (before.get(p.teamId) !== p.name) rotations++;
      }
    }
    const rate = rotations / total;
    expect(rate).toBeGreaterThan(0.02);
    expect(rate).toBeLessThan(0.16);
  });

  it('a rotated president has grudge and favorOwed reset', () => {
    let found = false;
    for (let seed = 1; seed <= 80; seed++) {
      const g = gameWithRival(seed);
      // Seed every incumbent with a debt so the reset is observable on whoever rotates.
      for (const p of g.presidents) p.favorOwed = true;
      const before = new Map(g.presidents.map((p) => [p.teamId, p.name]));
      const closed = closeOneSeason(g);
      const rotated = closed.presidents.find((p) => before.get(p.teamId) !== p.name);
      if (rotated) {
        expect(rotated.grudge).toBe(0);
        expect(rotated.favorOwed).toBe(false);
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('logs a president_change federationLog entry when a rotation happens', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const g = gameWithRival(seed);
      const before = new Map(g.presidents.map((p) => [p.teamId, p.name]));
      const closed = closeOneSeason(g);
      const rotatedTeamId = closed.presidents.find((p) => before.get(p.teamId) !== p.name)?.teamId;
      if (rotatedTeamId) {
        const entry = closed.federationLog.find(
          (e) => e.type === 'president_change' && e.teamId === rotatedTeamId,
        );
        expect(entry).toBeDefined();
        return;
      }
    }
    throw new Error('no rotation observed across 80 seeds — widen the seed range');
  });
});

describe('characters (Fase 17A) — lifecycle on team departure/arrival', () => {
  it('createOwnTeam gives the new club a president', () => {
    let g = gameWithRival(42);
    g.treasury = 100_000_000;
    const before = g.presidents.length;
    g = createOwnTeam(g, 'CD Nuevo');
    const newTeam = g.teams.find((t) => t.name === 'CD Nuevo')!;
    expect(g.presidents).toHaveLength(before + 1);
    expect(presidentOf(g, newTeam.id)).toBeDefined();
  });

  it('exodus removes the departing club president', () => {
    const g = gameWithRival(222);
    const victim = g.teams[0];
    expect(presidentOf(g, victim.id)).toBeDefined();

    victim.arraigo = 5;
    processExodus(g); // first low close: counter = 1, still ours
    g.teams[0].arraigo = 5;
    processExodus(g); // second low close: leaves

    expect(g.teams.find((t) => t.id === victim.id)!.federationId).not.toBe(g.playerFederationId);
    expect(presidentOf(g, victim.id)).toBeUndefined();
  });

  it('a rival winning a negotiation for a player team drops the president; a player-won negotiation adds one', () => {
    const g = gameWithRival(333);
    const rivalFed = g.federations.find((f) => !f.isPlayer)!;

    // Exit: a rival successfully negotiates one of the player's teams away.
    const victim = g.teams.find((t) => t.federationId === g.playerFederationId)!;
    expect(presidentOf(g, victim.id)).toBeDefined();
    g.negotiations.push({
      id: g.nextNegotiationId++,
      targetTeamId: victim.id,
      byFederationId: rivalFed.id,
      fromFederationId: g.playerFederationId,
      state: 'accepted',
      startedYear: g.year,
      requirementsSeasonsLeft: 0,
      acceptedYear: g.year - 2,
      effectiveYear: g.year,
      requirements: [],
      offerValue: 0,
      revealedCount: 0,
    });
    progressNegotiations(g);
    expect(g.teams.find((t) => t.id === victim.id)!.federationId).toBe(rivalFed.id);
    expect(presidentOf(g, victim.id)).toBeUndefined();

    // Entry: the player successfully negotiates a rival team.
    const target = g.teams.find((t) => t.federationId === rivalFed.id && t.divisionOrden !== null)!;
    g.negotiations.push({
      id: g.nextNegotiationId++,
      targetTeamId: target.id,
      byFederationId: g.playerFederationId,
      fromFederationId: rivalFed.id,
      state: 'accepted',
      startedYear: g.year,
      requirementsSeasonsLeft: 0,
      acceptedYear: g.year - 2,
      effectiveYear: g.year,
      requirements: [],
      offerValue: 0,
      revealedCount: 0,
    });
    progressNegotiations(g);
    expect(g.teams.find((t) => t.id === target.id)!.federationId).toBe(g.playerFederationId);
    expect(presidentOf(g, target.id)).toBeDefined();
  });
});

describe('characters (Fase 17A) — property invariant', () => {
  it('every current player-federation team has exactly one president, across seasons', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2 ** 31 - 1 }), (sd) => {
        const g = closeOneSeason(gameWithRival(sd));
        const playerTeamIds = new Set(
          g.teams.filter((t) => t.federationId === g.playerFederationId).map((t) => t.id),
        );
        const presidentTeamIds = g.presidents.map((p) => p.teamId);
        expect(new Set(presidentTeamIds)).toEqual(playerTeamIds);
        expect(presidentTeamIds.length).toBe(playerTeamIds.size);
      }),
      { numRuns: 25 },
    );
  });
});

describe('character quotes (Fase 17A, cierre F17)', () => {
  it('presidentQuote covers every (trait, context) pair with a non-empty deterministic string', () => {
    const traits = ['leal', 'ambicioso', 'tradicionalista', 'mercenario', 'institucional'] as const;
    const contexts = ['racha_victorias', 'racha_derrotas', 'adhesion', 'rescate', 'sancion'] as const;
    for (const t of traits) {
      for (const c of contexts) {
        const q = presidentQuote(t, c);
        expect(q.length).toBeGreaterThan(0);
        expect(presidentQuote(t, c)).toBe(q); // deterministic
      }
    }
  });

  it('rivalCommissionerQuote covers every (trait, context) pair', () => {
    const traits = ['agresivo', 'conservador', 'corrupto', 'visionario', 'diplomatico'] as const;
    for (const t of traits) {
      expect(rivalCommissionerQuote(t, 'goleada').length).toBeGreaterThan(0);
      expect(rivalCommissionerQuote(t, 'sorpresa').length).toBeGreaterThan(0);
    }
  });

  it('a 4-win streak produces a presidente_declara headline quoting the streak team\'s president', () => {
    const g = startSeason(gameWithRival(77));
    const team = g.teams[0];
    // Fabricate a clean 4-win streak for team 1.
    g.results = [2, 3, 4, 5].map((opponent, i) => ({
      matchday: i + 1, divisionOrden: 1, homeId: team.id, awayId: g.teams[opponent % g.teams.length].id,
      homeGoals: 2, awayGoals: 0,
    }));
    g.currentMatchday = 5;
    const headlines = generateHeadlines(g);
    const quote = headlines.find((h) => h.type === 'presidente_declara');
    expect(quote).toBeDefined();
    expect(quote!.teamId).toBe(team.id);
    expect(quote!.text).toContain(presidentOf(g, team.id)!.name);
  });
});
