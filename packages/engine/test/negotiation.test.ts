import { describe, expect, it } from 'vitest';
import {
  advanceSeason,
  canNegotiate,
  closeSeason,
  createGame,
  negotiableTeams,
  startNegotiation,
  startSeason,
  tierOf,
  type GameState,
} from '../src/index';

function world(seed: number) {
  return createGame(seed, {
    startingPrestige: 70, // player tier 4
    teams: Array.from({ length: 10 }, (_, i) => ({
      name: `Player FC ${i + 1}`,
      strength: 55,
      arraigo: 50,
    })),
    rivals: [
      {
        name: 'Rival Débil', // tier 1 -> reachable
        prestige: 10,
        divisions: [{ orden: 1, name: 'Liga', teams: [{ name: 'Objetivo Asequible', strength: 60, arraigo: 5 }] }],
      },
      {
        name: 'Rival Élite', // tier 5 -> blocked by the tier gate
        prestige: 90,
        divisions: [{ orden: 1, name: 'Liga', teams: [{ name: 'Intocable', strength: 80, arraigo: 70 }] }],
      },
    ],
  });
}

function closeYears(s: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) {
    if (s.phase === 'pretemporada') s = startSeason(s);
    s = closeSeason(advanceSeason(s));
  }
  return s;
}

describe('tier gate (§4.1)', () => {
  it('blocks teams whose owner is above the player tier', () => {
    const s = world(1);
    const reachable = s.teams.find((t) => t.name === 'Objetivo Asequible')!;
    const blocked = s.teams.find((t) => t.name === 'Intocable')!;

    expect(tierOf(70)).toBe(4);
    expect(canNegotiate(s, reachable.id)).toBe(true);
    expect(canNegotiate(s, blocked.id)).toBe(false);

    const ids = negotiableTeams(s).map((t) => t.id);
    expect(ids).toContain(reachable.id);
    expect(ids).not.toContain(blocked.id);
  });

  it('never lets you negotiate your own team', () => {
    const s = world(2);
    const own = s.teams.find((t) => t.divisionOrden !== null)!;
    expect(canNegotiate(s, own.id)).toBe(false);
  });
});

describe('negotiation lifecycle (§4.2)', () => {
  it('progresses gathering -> offer -> accepted(+2y) -> effective and is terminal', () => {
    let s = world(7);
    const target = s.teams.find((t) => t.name === 'Objetivo Asequible')!;
    s = startNegotiation(s, target.id);
    expect(s.negotiations).toHaveLength(1);
    expect(s.negotiations[0].state).toBe('gathering_requirements');

    const seenStates = new Set<string>([s.negotiations[0].state]);
    for (let i = 0; i < 15; i++) {
      s = closeYears(s, 1);
      const n = s.negotiations[0];
      seenStates.add(n.state);
      if (n.acceptedYear !== null && n.effectiveYear !== null) {
        expect(n.effectiveYear).toBe(n.acceptedYear + 2); // two-year delay
      }
      if (n.state === 'effective' || n.state === 'rejected') break;
    }

    const n = s.negotiations[0];
    expect(['effective', 'rejected']).toContain(n.state);
    expect(seenStates.has('gathering_requirements')).toBe(true);

    if (n.state === 'effective') {
      const moved = s.teams.find((t) => t.id === target.id)!;
      expect(moved.federationId).toBe(s.playerFederationId);
    }
    // Nothing is ever deleted (design §3): the team still exists either way.
    expect(s.teams.some((t) => t.id === target.id)).toBe(true);
  });

  it('starting the same negotiation twice does not duplicate it', () => {
    let s = world(3);
    const target = s.teams.find((t) => t.name === 'Objetivo Asequible')!;
    s = startNegotiation(s, target.id);
    s = startNegotiation(s, target.id);
    expect(s.negotiations).toHaveLength(1);
  });

  it('adhesion moves prestige between federations', () => {
    let s = world(11);
    const target = s.teams.find((t) => t.name === 'Objetivo Asequible')!;
    const rivalId = target.federationId;
    const rivalBefore = s.federations.find((f) => f.id === rivalId)!.prestige;
    s = startNegotiation(s, target.id);

    for (let i = 0; i < 20; i++) {
      s = closeYears(s, 1);
      if (s.negotiations[0].state === 'effective') break;
      if (s.negotiations[0].state === 'rejected') return; // nothing to assert
    }
    if (s.negotiations[0].state !== 'effective') return;

    const rivalAfter = s.federations.find((f) => f.id === rivalId)!.prestige;
    expect(rivalAfter).toBeLessThan(rivalBefore); // rival lost prestige
    const moved = s.teams.find((t) => t.id === target.id)!;
    expect(moved.federationId).toBe(s.playerFederationId);
  });
});

describe('determinism with negotiations', () => {
  it('same seed + same actions => identical state', () => {
    const run = (seed: number) => {
      let s = world(seed);
      const target = s.teams.find((t) => t.name === 'Objetivo Asequible')!;
      s = startNegotiation(s, target.id);
      return closeYears(s, 8);
    };
    expect(JSON.stringify(run(99))).toBe(JSON.stringify(run(99)));
  });
});
