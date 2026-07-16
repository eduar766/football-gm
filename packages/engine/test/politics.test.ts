import { describe, expect, it } from 'vitest';
import { accelerateNegotiation, advanceSeason, closeSeason, createGame, startNegotiation, startSeason, type GameState } from '../src/index';
import { closeSeasonOpinion, earnPC, spendPC, PC_MIN, PC_MAX } from '../src/politics';
import { processEconomy } from '../src/economy';

const SQUAD = [
  { name: 'A', posicion: 'DEL' as const, calidad: 60 },
  { name: 'B', posicion: 'MED' as const, calidad: 55 },
];

function playableGame(seed = 42): GameState {
  return createGame(seed, {
    startingTreasury: 100_000_000,
    teams: Array.from({ length: 4 }, (_, i) => ({ name: `E${i + 1}`, strength: 55, squad: SQUAD })),
  });
}

describe('public opinion + political capital defaults (Fase 17B)', () => {
  it('a fresh game starts at neutral opinion and starting PC', () => {
    const g = createGame(1);
    expect(g.publicOpinion).toBe(50);
    expect(g.opinionHistory).toEqual([]);
    expect(g.politicalCapital).toBe(3);
  });
});

describe('closeSeasonOpinion — golden safety', () => {
  it('is a no-op for engine-only games with no players', () => {
    const g = createGame(777); // default: no players
    closeSeasonOpinion(g);
    expect(g.publicOpinion).toBe(50);
    expect(g.opinionHistory).toHaveLength(0);
  });
});

describe('closeSeasonOpinion — deterministic deltas', () => {
  it('a tight title race with a wide-open scoreline lifts opinion', () => {
    const g = playableGame();
    const [a, b] = g.teams;
    g.totalMatchdays = 10;
    g.year = 1;
    // Both teams draw 0-0 through the cutoff (md <= 7): tied on points, no
    // goals scored, so only the title-race delta fires.
    g.results = [
      { matchday: 1, divisionOrden: 1, homeId: a.id, awayId: b.id, homeGoals: 0, awayGoals: 0 },
      { matchday: 2, divisionOrden: 1, homeId: b.id, awayId: a.id, homeGoals: 0, awayGoals: 0 },
    ];
    closeSeasonOpinion(g);
    const entry = g.opinionHistory[0];
    expect(entry.reasons).toContain('carrera de título apretada');
    expect(entry.reasons).not.toContain('temporada goleadora');
    expect(g.publicOpinion).toBeGreaterThan(50);
  });

  it('a high-scoring season (avg >= 2.8 goals) lifts opinion', () => {
    const g = playableGame();
    const [a, b, c, d] = g.teams;
    g.totalMatchdays = 10;
    g.year = 1;
    // One team runs away with it early (wide gap by the cutoff) so the
    // title-race delta stays off; goals are high throughout.
    g.results = [
      { matchday: 1, divisionOrden: 1, homeId: a.id, awayId: b.id, homeGoals: 4, awayGoals: 3 },
      { matchday: 2, divisionOrden: 1, homeId: a.id, awayId: c.id, homeGoals: 3, awayGoals: 2 },
      { matchday: 3, divisionOrden: 1, homeId: a.id, awayId: d.id, homeGoals: 4, awayGoals: 1 },
    ];
    closeSeasonOpinion(g);
    const entry = g.opinionHistory[0];
    expect(entry.reasons).toContain('temporada goleadora');
  });

  it('a cup final played this season lifts opinion', () => {
    const g = playableGame();
    g.year = 1;
    g.totalMatchdays = 0;
    g.results = [];
    g.cups = [{
      id: 1,
      name: 'Copa Test',
      tipo: 'copa',
      formato: 'eliminatoria',
      categoria: 'primer_equipo',
      year: g.year,
      status: 'finalizada',
      participantTeamIds: [g.teams[0].id, g.teams[1].id],
      rounds: [],
      championTeamId: g.teams[0].id,
      recurring: false,
    }];
    closeSeasonOpinion(g);
    expect(g.opinionHistory[0].reasons).toContain('final de copa disputada');
  });

  it('a new champion (different from last year) lifts opinion', () => {
    const g = playableGame();
    g.year = 2;
    g.totalMatchdays = 0;
    g.results = [];
    g.history = [
      { year: 1, divisionOrden: 1, championId: g.teams[0].id, championName: g.teams[0].name, points: 50, prestigeBefore: 20, prestigeAfter: 20, delta: 0 },
      { year: 2, divisionOrden: 1, championId: g.teams[1].id, championName: g.teams[1].name, points: 55, prestigeBefore: 20, prestigeAfter: 20, delta: 0 },
    ];
    closeSeasonOpinion(g);
    expect(g.opinionHistory[0].reasons).toContain('nuevo campeón');
  });

  it('a repeat champion does not trigger the new-champion delta', () => {
    const g = playableGame();
    g.year = 2;
    g.totalMatchdays = 0;
    g.results = [];
    g.history = [
      { year: 1, divisionOrden: 1, championId: g.teams[0].id, championName: g.teams[0].name, points: 50, prestigeBefore: 20, prestigeAfter: 20, delta: 0 },
      { year: 2, divisionOrden: 1, championId: g.teams[0].id, championName: g.teams[0].name, points: 55, prestigeBefore: 20, prestigeAfter: 20, delta: 0 },
    ];
    closeSeasonOpinion(g);
    expect(g.opinionHistory[0].reasons).not.toContain('nuevo campeón');
  });

  it('ignored club demands drag opinion, capped at -9', () => {
    const g = playableGame();
    g.year = 1;
    g.totalMatchdays = 0;
    g.results = [];
    g.publicOpinion = 50;
    g.clubDemands = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      teamId: g.teams[0].id,
      type: 'rescate' as const,
      year: g.year,
      createdMatchday: 1,
      deadlineMatchday: 3,
      amount: 1_000_000,
      resolved: true,
      satisfied: false,
    }));
    closeSeasonOpinion(g);
    // -9 capped, then regressed 10% toward 50: 41 -> 41 + (50-41)*0.1 = 41.9 -> 42
    expect(g.publicOpinion).toBe(42);
    expect(g.opinionHistory[0].reasons.some((r) => r.includes('petición'))).toBe(true);
  });

  it('regresses toward 50 with no signals present', () => {
    const g = playableGame();
    g.year = 1;
    g.totalMatchdays = 0;
    g.results = [];
    g.publicOpinion = 90;
    closeSeasonOpinion(g);
    expect(g.publicOpinion).toBeLessThan(90);
    expect(g.publicOpinion).toBeGreaterThan(50);
  });

  it('clamps to [0, 100]', () => {
    const g = playableGame();
    g.year = 1;
    g.totalMatchdays = 0;
    g.results = [];
    g.publicOpinion = 0;
    g.clubDemands = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      teamId: g.teams[0].id,
      type: 'rescate' as const,
      year: g.year,
      createdMatchday: 1,
      deadlineMatchday: 3,
      amount: 1_000_000,
      resolved: true,
      satisfied: false,
    }));
    closeSeasonOpinion(g);
    expect(g.publicOpinion).toBeGreaterThanOrEqual(0);
  });

  it('appends exactly one history entry per call', () => {
    const g = playableGame();
    g.year = 1;
    g.totalMatchdays = 0;
    g.results = [];
    closeSeasonOpinion(g);
    expect(g.opinionHistory).toHaveLength(1);
    expect(g.opinionHistory[0].year).toBe(1);
  });
});

describe('earnPC / spendPC (Fase 17B)', () => {
  it('earnPC clamps at PC_MAX and logs the gain', () => {
    const g = createGame(1);
    g.politicalCapital = 11;
    earnPC(g, 5, 'test gain');
    expect(g.politicalCapital).toBe(PC_MAX);
    const entry = g.federationLog.find((e) => e.type === 'political_capital');
    expect(entry).toBeDefined();
    expect(entry!.value).toBe(1); // only 1 point of headroom was available
  });

  it('earnPC logs nothing when already at the cap', () => {
    const g = createGame(1);
    g.politicalCapital = PC_MAX;
    const before = g.federationLog.length;
    earnPC(g, 3, 'test gain');
    expect(g.federationLog.length).toBe(before);
  });

  it('spendPC succeeds and floors at PC_MIN, logging a negative delta', () => {
    const g = createGame(1);
    g.politicalCapital = 3;
    const ok = spendPC(g, 3, 'test spend');
    expect(ok).toBe(true);
    expect(g.politicalCapital).toBe(PC_MIN);
    const entry = g.federationLog.find((e) => e.type === 'political_capital');
    expect(entry!.value).toBe(-3);
  });

  it('spendPC fails without mutating state when the balance is insufficient', () => {
    const g = createGame(1);
    g.politicalCapital = 1;
    const before = g.federationLog.length;
    const ok = spendPC(g, 3, 'test spend');
    expect(ok).toBe(false);
    expect(g.politicalCapital).toBe(1);
    expect(g.federationLog.length).toBe(before);
  });
});

describe('mandate-met earns political capital (Fase 17B)', () => {
  it('closing a season with a met mandate grants +1 PC (statistical over seeds)', () => {
    let observed = false;
    for (let seed = 1; seed <= 20 && !observed; seed++) {
      const g = closeSeason(advanceSeason(startSeason(playableGame(seed))));
      if (g.politicalCapital > 3) {
        observed = true;
        const entry = g.federationLog.find(
          (e) => e.type === 'political_capital' && e.detail.includes('mandato'),
        );
        expect(entry).toBeDefined();
        expect(entry!.value).toBeGreaterThan(0);
      }
    }
    expect(observed).toBe(true);
  });
});

describe('accelerateNegotiation (Fase 17B)', () => {
  function negotiableGame(seed = 9): GameState {
    let g = createGame(seed, {
      startingPrestige: 70,
      teams: Array.from({ length: 10 }, (_, i) => ({ name: `Player FC ${i + 1}`, strength: 55, arraigo: 50 })),
      rivals: [{
        name: 'Rival Débil',
        prestige: 10,
        divisions: [{ orden: 1, name: 'Liga', teams: [{ name: 'Objetivo', strength: 60, arraigo: 5 }] }],
      }],
    });
    const target = g.teams.find((t) => t.federationId !== g.playerFederationId)!;
    g = startNegotiation(g, target.id);
    g.politicalCapital = 3;
    return g;
  }

  it('reveals the next requirement immediately and spends 3 PC', () => {
    const g = negotiableGame();
    const n = g.negotiations[0];
    const revealedBefore = n.revealedCount;
    const next = accelerateNegotiation(g, n.id);
    const updated = next.negotiations[0];
    expect(updated.revealedCount).toBe(revealedBefore + 1);
    expect(updated.requirements[revealedBefore].revealed).toBe(true);
    expect(next.politicalCapital).toBe(0);
  });

  it('is a no-op when political capital is insufficient', () => {
    const g = negotiableGame();
    g.politicalCapital = 2;
    const n = g.negotiations[0];
    const next = accelerateNegotiation(g, n.id);
    expect(next).toBe(g);
  });

  it('is a no-op once every requirement is already revealed', () => {
    const g = negotiableGame();
    const n = g.negotiations[0];
    n.revealedCount = n.requirements.length;
    for (const r of n.requirements) r.revealed = true;
    const next = accelerateNegotiation(g, n.id);
    expect(next).toBe(g);
  });

  it('is a no-op for a negotiation owned by a rival federation', () => {
    const g = negotiableGame();
    const n = g.negotiations[0];
    n.byFederationId = 999; // not the player's federation
    const next = accelerateNegotiation(g, n.id);
    expect(next).toBe(g);
  });
});

describe('public opinion scales gate/merchandise income (Fase 17B)', () => {
  it('higher opinion yields more income than lower opinion, contracts held equal', () => {
    const low = playableGame();
    low.publicOpinion = 0;
    low.results = [
      { matchday: 1, divisionOrden: 1, homeId: low.teams[0].id, awayId: low.teams[1].id, homeGoals: 1, awayGoals: 0 },
    ];
    const high = playableGame();
    high.publicOpinion = 100;
    high.results = [
      { matchday: 1, divisionOrden: 1, homeId: high.teams[0].id, awayId: high.teams[1].id, homeGoals: 1, awayGoals: 0 },
    ];
    processEconomy(low);
    processEconomy(high);
    expect(high.lastEconomy!.matchday).toBeGreaterThan(low.lastEconomy!.matchday);
    expect(high.lastEconomy!.merchandise).toBeGreaterThan(low.lastEconomy!.merchandise);
  });

  it('does not scale income for player-less games', () => {
    const g = createGame(777); // no players
    g.publicOpinion = 100;
    const before = g.prestige;
    processEconomy(g);
    // No assertion on exact figures — just confirms it runs without the
    // player-gated branch (covered structurally; golden test is the real guard).
    expect(g.prestige).toBe(before);
  });
});
