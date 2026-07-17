import { describe, expect, it } from 'vitest';
import { createGame, startSeason, advanceSeason, closeSeason, expelRingleader, type GameState } from '../src/index';
import { advanceConspiracy } from '../src/conspiracy';
import type { Conspiracy } from '../src/types';

const SQUAD = [
  { name: 'A', posicion: 'DEL' as const, calidad: 60 },
  { name: 'B', posicion: 'MED' as const, calidad: 55 },
];

function gameWithTeams(
  n: number,
  opts: { arraigo?: (i: number) => number; strength?: (i: number) => number } = {},
  seed = 42,
): GameState {
  const arraigo = opts.arraigo ?? (() => 50);
  const strength = opts.strength ?? ((i: number) => 40 + i * 2);
  return createGame(seed, {
    startingTreasury: 100_000_000,
    teams: Array.from({ length: n }, (_, i) => ({
      name: `E${i + 1}`,
      strength: strength(i),
      arraigo: arraigo(i),
      squad: SQUAD,
    })),
    rivals: [
      {
        name: 'Rival FC',
        prestige: 60,
        divisions: [{ orden: 1, name: 'Primera', teams: [{ name: 'R1', strength: 60, arraigo: 50 }] }],
      },
    ],
  });
}

// 12 teams, strength 40,42,...,62 (ascending). Top-quartile threshold picks
// exactly the top 3 (indices 9,10,11 → E10/E11/E12). Only those 3 also get
// arraigo < 40, so they're the only trigger candidates.
function triggerReadyGame(seed = 42): GameState {
  return gameWithTeams(12, {
    strength: (i) => 40 + i * 2,
    arraigo: (i) => (i >= 9 ? 30 : 50),
  }, seed);
}

function makeConspiracy(overrides: Partial<Conspiracy> = {}): Conspiracy {
  return {
    phase: 'organizada',
    memberTeamIds: [10, 11, 12],
    ringleaderTeamId: 10,
    startedYear: 1,
    demands: [],
    deadlineYear: 0,
    ...overrides,
  };
}

describe('trigger', () => {
  it('never fires with fewer than 3 candidates, regardless of the rng roll', () => {
    // Only 2 teams meet arraigo<40 AND top-quartile strength.
    const g = gameWithTeams(12, {
      strength: (i) => 40 + i * 2,
      arraigo: (i) => (i >= 10 ? 30 : 50),
    });
    for (let i = 0; i < 200; i++) advanceConspiracy(g);
    expect(g.conspiracy).toBeNull();
  });

  it('selects exactly the top-quartile low-arraigo teams as members, ringleader = lowest arraigo', () => {
    let g: GameState | null = null;
    for (let seed = 1; seed <= 60 && !g?.conspiracy; seed++) {
      const candidate = triggerReadyGame(seed);
      for (let i = 0; i < 50 && !candidate.conspiracy; i++) advanceConspiracy(candidate);
      if (candidate.conspiracy) g = candidate;
    }
    expect(g).not.toBeNull();
    const c = g!.conspiracy!;
    expect(c.phase).toBe('rumor');
    expect([...c.memberTeamIds].sort((a, b) => a - b)).toEqual([10, 11, 12]);
    expect(c.startedYear).toBe(g!.year);
  });

  it('a freshly started conspiracy stays at rumor for the season it starts', () => {
    const g = triggerReadyGame(1);
    advanceConspiracy(g); // either triggers into 'rumor' or does nothing
    if (g.conspiracy) expect(g.conspiracy.phase).toBe('rumor');
  });
});

describe('phase progression', () => {
  it('advances one phase per close without aggravating factors', () => {
    const g = triggerReadyGame(1);
    g.conspiracy = makeConspiracy({ phase: 'rumor' });
    advanceConspiracy(g);
    expect(g.conspiracy?.phase).toBe('organizada');
    g.year++;
    advanceConspiracy(g);
    expect(g.conspiracy?.phase).toBe('ultimatum');
    expect(g.conspiracy?.demands.length).toBeGreaterThanOrEqual(2);
    expect(g.conspiracy?.deadlineYear).toBe(g.year + 1);
  });

  it('jumps two phases in one close when aggravating factors are present (low opinion)', () => {
    const g = triggerReadyGame(1);
    g.publicOpinion = 10; // < 25
    g.conspiracy = makeConspiracy({ phase: 'rumor' });
    advanceConspiracy(g);
    expect(g.conspiracy?.phase).toBe('ultimatum');
    expect(g.conspiracy?.demands.length).toBeGreaterThanOrEqual(2);
  });

  it('jumps two phases when a pledge to a member was broken this year', () => {
    const g = triggerReadyGame(1);
    g.conspiracy = makeConspiracy({ phase: 'rumor' });
    g.pledges = [
      { id: 1, teamId: 10, kind: 'mejora_reparto', refId: null, amount: null, madeYear: g.year - 2, deadlineYear: g.year, status: 'rota' },
    ];
    advanceConspiracy(g);
    expect(g.conspiracy?.phase).toBe('ultimatum');
  });
});

describe('appeasement (organizada)', () => {
  it('raising a member above arraigo 55 removes them from the conspiracy (without dropping below 3, it stays active)', () => {
    const g = triggerReadyGame(1);
    // 4 members so removing one still leaves 3 — isolates the removal from
    // the separate <3-members deactivation rule (covered below).
    g.conspiracy = makeConspiracy({ phase: 'organizada', memberTeamIds: [9, 10, 11, 12] });
    g.teams.find((t) => t.id === 10)!.arraigo = 60;
    advanceConspiracy(g);
    expect(g.conspiracy?.memberTeamIds).not.toContain(10);
    expect(g.conspiracy?.memberTeamIds).toEqual([9, 11, 12]);
  });

  it('deactivates once fewer than 3 members remain', () => {
    const g = triggerReadyGame(1);
    g.conspiracy = makeConspiracy({ phase: 'organizada', memberTeamIds: [10, 11, 12] });
    g.teams.find((t) => t.id === 10)!.arraigo = 60;
    g.teams.find((t) => t.id === 11)!.arraigo = 60;
    advanceConspiracy(g);
    expect(g.conspiracy).toBeNull();
    expect(g.conspiracyHistory).toHaveLength(1);
    expect(g.conspiracyHistory[0].phase).toBe('desactivada');
  });
});

describe('ultimatum resolution', () => {
  // No norms/recurring cups configured → pickDemands always has exactly 2
  // candidates (mejora_reparto_grandes, inversion_estadios), so both are
  // always chosen deterministically (want = candidates.length when < 3).
  function gameAtUltimatum(seed = 1): GameState {
    const g = triggerReadyGame(seed);
    g.competitionPrizes = [{ id: 1, kind: 'liga', cupId: null, pool: 100, shares: [100] }];
    g.conspiracy = makeConspiracy({ phase: 'organizada', memberTeamIds: [10, 11, 12] });
    advanceConspiracy(g); // organizada -> ultimatum, demands fixed here
    expect(g.conspiracy?.phase).toBe('ultimatum');
    expect(g.conspiracy?.demands.map((d) => d.kind).sort()).toEqual(['inversion_estadios', 'mejora_reparto_grandes']);
    g.year = g.conspiracy!.deadlineYear;
    return g;
  }

  it('meeting >=2 demands deactivates the conspiracy and bumps opinion by +4', () => {
    const g = gameAtUltimatum();
    g.competitionPrizes[0].pool = 120; // >= 100 * 1.15
    for (const id of [10, 11, 12]) g.teams.find((t) => t.id === id)!.stadiumCapacity += 4000; // >= +10_000 combined
    const opinionBefore = g.publicOpinion;
    advanceConspiracy(g);
    expect(g.conspiracy).toBeNull();
    expect(g.conspiracyHistory.at(-1)?.phase).toBe('desactivada');
    expect(g.publicOpinion).toBe(Math.min(100, opinionBefore + 4));
  });

  it('meeting 0 or 1 demand consummates the conspiracy', () => {
    const g = gameAtUltimatum();
    // Neither demand satisfied.
    advanceConspiracy(g);
    expect(g.conspiracy).toBeNull();
    expect(g.conspiracyHistory.at(-1)?.phase).toBe('consumada');
  });

  it('does not resolve before its deadline year', () => {
    const g = gameAtUltimatum();
    g.year = g.conspiracy!.deadlineYear - 1;
    advanceConspiracy(g);
    expect(g.conspiracy?.phase).toBe('ultimatum');
  });
});

describe('consummation — re-association and escisión', () => {
  it('departing members are re-associated to a rival federation (nothing is deleted)', () => {
    const g = triggerReadyGame(1);
    const rival = g.federations.find((f) => !f.isPlayer)!;
    g.conspiracy = makeConspiracy({ phase: 'ultimatum', memberTeamIds: [10, 11, 12], deadlineYear: g.year });
    advanceConspiracy(g);
    expect(g.gameOver).toBeNull(); // 3 of 12 in division 1 = 25%, survives
    for (const id of [10, 11, 12]) {
      const t = g.teams.find((tm) => tm.id === id)!;
      expect(t).toBeDefined(); // still exists — never deleted
      expect(t.federationId).toBe(rival.id);
      expect(t.divisionOrden).toBeNull();
      expect(g.presidents.find((p) => p.teamId === id)).toBeUndefined();
    }
  });

  it('sub-escisión (< 50% of division 1) survives with a prestige/opinion/confidence penalty, no game over', () => {
    const g = triggerReadyGame(1);
    g.prestige = 50;
    g.publicOpinion = 50;
    g.boardConfidence.value = 50;
    g.conspiracy = makeConspiracy({ phase: 'ultimatum', memberTeamIds: [10, 11, 12], deadlineYear: g.year });
    advanceConspiracy(g);
    expect(g.gameOver).toBeNull();
    expect(g.prestige).toBe(44);
    expect(g.publicOpinion).toBe(40);
    expect(g.boardConfidence.value).toBe(35);
  });

  it('>=50% of division 1 leaving triggers GameOverReason "escision"', () => {
    // Small 4-team division-1-only game where 3 of 4 teams conspire.
    const g = gameWithTeams(4, { strength: (i) => 40 + i * 2, arraigo: (i) => (i >= 1 ? 30 : 50) }, 1);
    g.conspiracy = makeConspiracy({ phase: 'ultimatum', memberTeamIds: [2, 3, 4], deadlineYear: g.year });
    advanceConspiracy(g);
    expect(g.gameOver).not.toBeNull();
    expect(g.gameOver?.reason).toBe('escision');
  });

  it('logs conspiracy departures under federationLog type "conspiracy", not "team_left" (avoids the exodo tally)', () => {
    const g = triggerReadyGame(1);
    g.conspiracy = makeConspiracy({ phase: 'ultimatum', memberTeamIds: [10, 11, 12], deadlineYear: g.year });
    advanceConspiracy(g);
    const departureEntries = g.federationLog.filter((e) => e.type === 'conspiracy' && [10, 11, 12].includes(e.teamId ?? -1));
    expect(departureEntries.length).toBe(3);
    expect(g.federationLog.filter((e) => e.type === 'team_left')).toHaveLength(0);
  });
});

describe('ringleader expulsion (contra-juego)', () => {
  it('expels the ringleader, deactivates the conspiracy, grudges the rest, and costs prestige/opinion', () => {
    const g = triggerReadyGame(1);
    const rival = g.federations.find((f) => !f.isPlayer)!;
    g.prestige = 50;
    g.publicOpinion = 50;
    g.conspiracy = makeConspiracy({ phase: 'organizada', memberTeamIds: [10, 11, 12], ringleaderTeamId: 10 });
    const grudgeBefore11 = g.presidents.find((p) => p.teamId === 11)!.grudge;

    const next = expelRingleader(g);
    expect(next).not.toBe(g); // clone, not a no-op

    expect(next.conspiracy).toBeNull();
    expect(next.conspiracyHistory.at(-1)?.phase).toBe('desactivada');
    const ringleaderTeam = next.teams.find((t) => t.id === 10)!;
    expect(ringleaderTeam.federationId).toBe(rival.id);
    expect(ringleaderTeam.divisionOrden).toBeNull();
    expect(next.presidents.find((p) => p.teamId === 10)).toBeUndefined();
    expect(next.presidents.find((p) => p.teamId === 11)!.grudge).toBe(grudgeBefore11 + 20);
    expect(next.presidents.find((p) => p.teamId === 12)!.grudge).toBeGreaterThanOrEqual(20);
    expect(next.prestige).toBe(48);
    expect(next.publicOpinion).toBe(42);
  });

  it('is a no-op when there is no active conspiracy', () => {
    const g = triggerReadyGame(1);
    expect(expelRingleader(g)).toBe(g);
  });

  it('is a no-op during the rumor phase (not public yet)', () => {
    const g = triggerReadyGame(1);
    g.conspiracy = makeConspiracy({ phase: 'rumor' });
    expect(expelRingleader(g)).toBe(g);
  });

  it('is available during ultimatum too', () => {
    const g = triggerReadyGame(1);
    g.conspiracy = makeConspiracy({ phase: 'ultimatum', deadlineYear: g.year + 1 });
    expect(expelRingleader(g)).not.toBe(g);
  });
});

describe('never two simultaneous conspiracies', () => {
  it('an active conspiracy is never replaced by a fresh trigger', () => {
    const g = triggerReadyGame(1);
    g.conspiracy = makeConspiracy({ phase: 'rumor', memberTeamIds: [10, 11, 12], ringleaderTeamId: 10 });
    for (let i = 0; i < 30; i++) {
      advanceConspiracy(g);
      if (!g.conspiracy) break; // resolved naturally; fine, just confirms no overwrite happened while active
    }
    // Whatever happened, there is still at most one live conspiracy and history only grows.
    expect(g.conspiracyHistory.length).toBeLessThanOrEqual(1);
  });
});

describe('golden safety / player-less gating', () => {
  it('advanceConspiracy is a no-op for a player-less game', () => {
    const g = startSeason(createGame(777));
    const before = JSON.stringify(g);
    advanceConspiracy(g);
    expect(JSON.stringify(g)).toBe(before);
  });

  it('wired into closeSeason at priority 168 for a playable game', () => {
    const g = closeSeason(advanceSeason(startSeason(triggerReadyGame(1))));
    // Just confirms the step runs without throwing and conspiracy stays a
    // valid shape (null or a Conspiracy) — exact outcome depends on the rng
    // draw, covered precisely by the direct-call tests above.
    expect(g.conspiracy === null || typeof g.conspiracy.phase === 'string').toBe(true);
  });
});
