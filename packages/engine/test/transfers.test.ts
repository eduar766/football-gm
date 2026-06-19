import { describe, expect, it } from 'vitest';
import {
  advanceSeason,
  closeSeason,
  createGame,
  startSeason,
  teamStrengthFromSquad,
  transfersForYear,
  type GameState,
} from '../src/index';

const squad = (n: number, calidad: number, prefix: string) =>
  Array.from({ length: n }, (_, i) => ({
    name: `${prefix} P${i + 1}`,
    posicion: (['POR', 'DEF', 'MED', 'DEL'] as const)[i % 4],
    calidad,
  }));

const game = (seed: number) =>
  createGame(seed, {
    teams: [
      { name: 'Strong FC', strength: 80, squad: squad(20, 78, 'S') },
      { name: 'Mid FC', strength: 60, squad: squad(20, 58, 'M') },
      { name: 'Weak FC', strength: 45, squad: squad(20, 42, 'W') },
    ],
  });

const cycle = (g: GameState) => closeSeason(advanceSeason(startSeason(g)));

describe('teamStrengthFromSquad', () => {
  it('returns null for a team without players', () => {
    const g = createGame(1);
    expect(teamStrengthFromSquad(g.players, g.teams[0].id)).toBeNull();
  });

  it('averages the top 11 quality values when the squad is bigger', () => {
    const g = game(2);
    const strongId = g.teams[0].id;
    expect(teamStrengthFromSquad(g.players, strongId)).toBe(78);
  });
});

describe('runTransferWindow', () => {
  it('default (no players) is a no-op and does NOT advance transfersRng', () => {
    const a = createGame(777);
    const b = createGame(777);
    const ca = cycle(a);
    const cb = cycle(b);
    expect(ca.transfers).toEqual([]);
    expect(JSON.stringify(ca.transfersRng)).toBe(JSON.stringify(cb.transfersRng));
    // Sanity: untouched rng is the same as the freshly created one.
    expect(JSON.stringify(ca.transfersRng)).toBe(JSON.stringify(a.transfersRng));
  });

  it('moves at least one player when there is a quality gap', () => {
    let g = game(5);
    const totalPlayersBefore = g.players.length;

    // Run a full season cycle so closeSeason triggers the transfer window.
    // closeSeason increments the year first, then runs the window — so the
    // entries belong to the pretemporada of year 2.
    g = cycle(g);

    expect(g.year).toBe(2);
    const moves = transfersForYear(g, 2);
    expect(moves.length).toBeGreaterThan(0);
    // No players were created or destroyed.
    expect(g.players.length).toBe(totalPlayersBefore);
    // Each move actually changed teamId.
    for (const m of moves) {
      const p = g.players.find((p) => p.id === m.playerId)!;
      expect(p.teamId).toBe(m.toTeamId);
      expect(m.fromTeamId).not.toBe(m.toTeamId);
    }
  });

  it('recomputes team.strength from the resulting squad', () => {
    const g = game(6);
    const strongIdBefore = g.teams[0].id;
    const before = g.teams[0].strength;
    const after = cycle(g);
    const strongAfter = after.teams.find((t) => t.id === strongIdBefore)!;
    // Strength derives from the top 11 of the new squad; should not stay at 80
    // exactly (drift + transfers move it).
    expect(strongAfter.strength).not.toBe(before);
    // Bounded by the helper.
    expect(strongAfter.strength).toBeGreaterThanOrEqual(20);
    expect(strongAfter.strength).toBeLessThanOrEqual(95);
  });

  it('is deterministic: same seed => identical transfer log', () => {
    const a = cycle(game(7));
    const b = cycle(game(7));
    expect(JSON.stringify(a.transfers)).toBe(JSON.stringify(b.transfers));
  });

  it('only moves players between the player federation clubs', () => {
    const g = cycle(game(8));
    const subjectIds = new Set(
      g.teams
        .filter((t) => t.divisionOrden !== null && t.federationId === g.playerFederationId)
        .map((t) => t.id),
    );
    for (const m of g.transfers) {
      expect(subjectIds.has(m.fromTeamId)).toBe(true);
      expect(subjectIds.has(m.toTeamId)).toBe(true);
    }
  });
});
