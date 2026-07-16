import { describe, expect, it } from 'vitest';
import { createGame, type GameState } from '../src/index';
import { verifyPledges } from '../src/pledges';

const SQUAD = [
  { name: 'A', posicion: 'DEL' as const, calidad: 60 },
  { name: 'B', posicion: 'MED' as const, calidad: 55 },
];

function playableGame(seed = 1): GameState {
  return createGame(seed, {
    startingTreasury: 100_000_000,
    teams: Array.from({ length: 6 }, (_, i) => ({ name: `E${i + 1}`, strength: 55, squad: SQUAD })),
  });
}

function pushPledge(g: GameState, overrides: Partial<GameState['pledges'][number]>): number {
  const pledge = {
    id: g.nextPledgeId++,
    teamId: g.teams[0].id,
    kind: 'plaza_copa' as const,
    refId: null,
    amount: null,
    madeYear: g.year,
    deadlineYear: g.year, // due immediately, for test convenience
    status: 'pendiente' as const,
    ...overrides,
  };
  g.pledges.push(pledge);
  return pledge.id;
}

describe('verifyPledges — plaza_copa (Fase 17C)', () => {
  it('is fulfilled when the team is a participant of the pledged cup', () => {
    const g = playableGame();
    g.cups.push({
      id: 1, name: 'Copa', tipo: 'copa', formato: 'eliminatoria', categoria: 'primer_equipo',
      year: g.year, status: 'en_curso', participantTeamIds: [g.teams[0].id], rounds: [],
      championTeamId: null, recurring: false,
    });
    const id = pushPledge(g, { refId: 1 });
    verifyPledges(g);
    expect(g.pledges.find((p) => p.id === id)!.status).toBe('cumplida');
  });

  it('is broken when the team is not a participant', () => {
    const g = playableGame();
    g.cups.push({
      id: 1, name: 'Copa', tipo: 'copa', formato: 'eliminatoria', categoria: 'primer_equipo',
      year: g.year, status: 'en_curso', participantTeamIds: [g.teams[1].id], rounds: [],
      championTeamId: null, recurring: false,
    });
    const id = pushPledge(g, { refId: 1 });
    verifyPledges(g);
    expect(g.pledges.find((p) => p.id === id)!.status).toBe('rota');
  });
});

describe('verifyPledges — mejora_reparto (Fase 17C)', () => {
  it('is fulfilled when the reparto spread did not widen', () => {
    const g = playableGame();
    g.competitionPrizes.push({ id: 1, kind: 'liga', cupId: null, pool: 10_000_000, shares: [40, 30, 30] }); // spread 10
    const id = pushPledge(g, { kind: 'mejora_reparto', amount: 10 });
    verifyPledges(g);
    expect(g.pledges.find((p) => p.id === id)!.status).toBe('cumplida');
  });

  it('is broken when the reparto spread widened beyond the pledged baseline', () => {
    const g = playableGame();
    g.competitionPrizes.push({ id: 1, kind: 'liga', cupId: null, pool: 10_000_000, shares: [70, 20, 10] }); // spread 60
    const id = pushPledge(g, { kind: 'mejora_reparto', amount: 10 });
    verifyPledges(g);
    expect(g.pledges.find((p) => p.id === id)!.status).toBe('rota');
  });
});

describe('verifyPledges — exencion_norma (Fase 17C)', () => {
  it('is fulfilled when the team was never sanctioned for that norm since the pledge', () => {
    const g = playableGame();
    const id = pushPledge(g, { kind: 'exencion_norma', refId: 42 });
    verifyPledges(g);
    expect(g.pledges.find((p) => p.id === id)!.status).toBe('cumplida');
  });

  it('is broken when the team was sanctioned for that exact norm after the pledge', () => {
    const g = playableGame();
    const id = pushPledge(g, { kind: 'exencion_norma', refId: 42 });
    g.sanctions.push({
      id: 1, teamId: g.teams[0].id, normId: 42, year: g.year, appliesToYear: g.year,
      motivo: 'x', castigo: 'y', pointsPenalty: 3,
    });
    verifyPledges(g);
    expect(g.pledges.find((p) => p.id === id)!.status).toBe('rota');
  });
});

describe('verifyPledges — rescate_futuro (Fase 17C)', () => {
  it('is fulfilled when the rescue was never needed', () => {
    const g = playableGame();
    const id = pushPledge(g, { kind: 'rescate_futuro', amount: 3_000_000 });
    verifyPledges(g);
    expect(g.pledges.find((p) => p.id === id)!.status).toBe('cumplida');
  });

  it('is fulfilled when a rescue demand was made and satisfied', () => {
    const g = playableGame();
    const id = pushPledge(g, { kind: 'rescate_futuro', amount: 3_000_000 });
    g.clubDemands.push({
      id: 1, teamId: g.teams[0].id, type: 'rescate', year: g.year, createdMatchday: 1,
      deadlineMatchday: 3, amount: 3_000_000, resolved: true, satisfied: true,
    });
    verifyPledges(g);
    expect(g.pledges.find((p) => p.id === id)!.status).toBe('cumplida');
  });

  it('is broken when a rescue demand was made and ignored', () => {
    const g = playableGame();
    const id = pushPledge(g, { kind: 'rescate_futuro', amount: 3_000_000 });
    g.clubDemands.push({
      id: 1, teamId: g.teams[0].id, type: 'rescate', year: g.year, createdMatchday: 1,
      deadlineMatchday: 3, amount: 3_000_000, resolved: true, satisfied: false,
    });
    verifyPledges(g);
    expect(g.pledges.find((p) => p.id === id)!.status).toBe('rota');
  });
});

describe('verifyPledges — effects + timing (Fase 17C)', () => {
  it('a fulfilled pledge raises arraigo and grants +2 PC', () => {
    const g = playableGame();
    const team = g.teams[0];
    const arraigoBefore = team.arraigo;
    const pcBefore = g.politicalCapital;
    g.cups.push({
      id: 1, name: 'Copa', tipo: 'copa', formato: 'eliminatoria', categoria: 'primer_equipo',
      year: g.year, status: 'en_curso', participantTeamIds: [team.id], rounds: [],
      championTeamId: null, recurring: false,
    });
    pushPledge(g, { refId: 1 });
    verifyPledges(g);
    expect(g.teams[0].arraigo).toBe(Math.min(100, arraigoBefore + 6));
    expect(g.politicalCapital).toBe(pcBefore + 2);
  });

  it('a broken pledge drops arraigo, raises grudge, and costs 1 PC', () => {
    const g = playableGame();
    const team = g.teams[0];
    const arraigoBefore = team.arraigo;
    const president = g.presidents.find((p) => p.teamId === team.id)!;
    const grudgeBefore = president.grudge;
    const pcBefore = g.politicalCapital;
    pushPledge(g, { refId: 999 }); // no such cup => broken
    verifyPledges(g);
    expect(g.teams[0].arraigo).toBe(Math.max(0, arraigoBefore - 10));
    expect(g.presidents.find((p) => p.teamId === team.id)!.grudge).toBe(grudgeBefore + 25);
    expect(g.politicalCapital).toBe(Math.max(0, pcBefore - 1));
  });

  it('does not settle a pledge before its deadline year', () => {
    const g = playableGame();
    const id = pushPledge(g, { refId: 999, deadlineYear: g.year + 2 });
    verifyPledges(g);
    expect(g.pledges.find((p) => p.id === id)!.status).toBe('pendiente');
  });

  it('logs a pledge_result federationLog entry', () => {
    const g = playableGame();
    pushPledge(g, { refId: 999 });
    verifyPledges(g);
    expect(g.federationLog.some((e) => e.type === 'pledge_result')).toBe(true);
  });

  it('never re-settles an already-resolved pledge', () => {
    const g = playableGame();
    const id = pushPledge(g, { refId: 999 });
    verifyPledges(g);
    const statusAfterFirst = g.pledges.find((p) => p.id === id)!.status;
    const arraigoAfterFirst = g.teams[0].arraigo;
    verifyPledges(g);
    expect(g.pledges.find((p) => p.id === id)!.status).toBe(statusAfterFirst);
    expect(g.teams[0].arraigo).toBe(arraigoAfterFirst);
  });
});
