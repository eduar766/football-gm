import { describe, expect, it } from 'vitest';
import { createGame, setLeaguePrize, advanceSeason, startSeason, closeSeason } from '../src/index';
import { evaluateBoardConfidence, resolveCensureMotion, CONFIDENCE_START } from '../src/board';
import { evaluateEra } from '../src/eras';
import type { GameState } from '../src/index';

const SQUAD = [
  { name: 'A', posicion: 'DEL' as const, calidad: 60 },
  { name: 'B', posicion: 'MED' as const, calidad: 55 },
];

function playableGame(seed = 42): GameState {
  let g = createGame(seed, {
    startingTreasury: 100_000_000,
    teams: Array.from({ length: 6 }, (_, i) => ({ name: `E${i + 1}`, strength: 55, squad: SQUAD })),
  });
  g = setLeaguePrize(g, 5_000_000, [50, 30, 20]);
  return g;
}

describe('board confidence (Fase 14.8)', () => {
  it('starts at the default and records history at each close', () => {
    let g = playableGame();
    expect(g.boardConfidence.value).toBe(CONFIDENCE_START);
    g = closeSeason(advanceSeason(startSeason(g)));
    expect(g.boardConfidence.history.length).toBeGreaterThan(0);
  });

  it('is a no-op for engine-only games with no players (golden-safe)', () => {
    const g = createGame(777); // default: no players
    evaluateBoardConfidence(g, -50);
    expect(g.boardConfidence.value).toBe(CONFIDENCE_START);
    expect(g.gameOver).toBeNull();
    expect(g.boardConfidence.history).toHaveLength(0);
  });

  it('chained mandate failures drive confidence to 0, opening a moción de censura (not an immediate destitution)', () => {
    const g = playableGame(7);
    // Re-evaluate the same season's mandate repeatedly (no year bump, no
    // treasury override) so this isolates the confidence-only path from the
    // 'mandatos' (3 distinct-year fails) and 'quiebra' (treasury) conditions
    // — both are covered by their own dedicated tests below/elsewhere.
    g.mandates.push({ id: g.nextMandateId++, type: 'positive_balance', difficulty: 'facil', description: 'x', target: 0, year: g.year, met: false });
    for (let i = 0; i < 6 && !g.gameOver && !g.censureMotion; i++) {
      evaluateBoardConfidence(g, -1);
    }
    expect(g.boardConfidence.value).toBeLessThan(25);
    expect(g.gameOver).toBeNull(); // Fase 17G: <25 opens a censure motion instead of firing gameOver directly
    expect(g.censureMotion).toEqual({ year: g.year });
  });

  it('three consecutive mandate failures trigger the "mandatos" defeat, independent of magnitude', () => {
    const g = playableGame(8);
    for (let i = 0; i < 3 && !g.gameOver; i++) {
      g.mandates.push({ id: g.nextMandateId++, type: 'positive_balance', difficulty: 'dificil', description: 'x', target: 0, year: g.year, met: false });
      evaluateBoardConfidence(g, 0);
      g.year += 1;
    }
    expect(g.gameOver?.reason).toBe('mandatos');
  });

  it('two negative-treasury closes trigger quiebra', () => {
    const g = playableGame(9);
    g.boardConfidence.value = 80; // keep confidence high so quiebra is the trigger
    g.treasury = -5_000_000;
    evaluateBoardConfidence(g, 1);
    expect(g.gameOver).toBeNull(); // one season, not enough
    g.year += 1;
    g.boardConfidence.value = 80;
    g.treasury = -5_000_000;
    evaluateBoardConfidence(g, 1);
    expect(g.gameOver?.reason).toBe('quiebra');
  });
});

describe('moción de censura (Fase 17G)', () => {
  function motionedGame(seed: number): GameState {
    const g = playableGame(seed);
    g.boardConfidence.value = 24; // below 25
    evaluateBoardConfidence(g, 0);
    return g;
  }

  it('opening a motion logs it under federationLog type "censura" and pushes a mailbox message', () => {
    const g = motionedGame(20);
    expect(g.censureMotion).toEqual({ year: g.year });
    expect(g.federationLog.some((e) => e.type === 'censura')).toBe(true);
    expect(g.mailbox.some((m) => m.actionKind === 'censura')).toBe(true);
  });

  it('gastar_pc requires >=6 PC, sets confidence to 40, spends the PC, and marks censureUsedInEra', () => {
    const g = motionedGame(21);
    g.politicalCapital = 3;
    expect(resolveCensureMotion(g, 'gastar_pc')).toBe(g); // insufficient PC -> no-op
    g.politicalCapital = 8;
    const next = resolveCensureMotion(g, 'gastar_pc');
    expect(next).not.toBe(g);
    expect(next.boardConfidence.value).toBe(40);
    expect(next.politicalCapital).toBe(2);
    expect(next.censureUsedInEra).toBe(true);
    expect(next.censureMotion).toBeNull();
  });

  it('defensa_meritos requires a mandate met this year or an era completed this year, sets confidence to 35', () => {
    const g = motionedGame(22);
    expect(resolveCensureMotion(g, 'defensa_meritos')).toBe(g); // no merit -> no-op
    g.mandates.push({ id: g.nextMandateId++, type: 'positive_balance', difficulty: 'medio', description: 'x', target: 0, year: g.year, met: true });
    const next = resolveCensureMotion(g, 'defensa_meritos');
    expect(next).not.toBe(g);
    expect(next.boardConfidence.value).toBe(35);
    expect(next.censureUsedInEra).toBe(true);
  });

  it('defensa_meritos also accepts an era completed this year', () => {
    const g = motionedGame(23);
    g.eraHistory.push({ era: 1, completedYear: g.year });
    const next = resolveCensureMotion(g, 'defensa_meritos');
    expect(next.boardConfidence.value).toBe(35);
  });

  it('aceptar always works and fires destitucion_confianza', () => {
    const g = motionedGame(24);
    const next = resolveCensureMotion(g, 'aceptar');
    expect(next.gameOver?.reason).toBe('destitucion_confianza');
    expect(next.censureMotion).toBeNull();
  });

  it('is a no-op when there is no open motion', () => {
    const g = playableGame(25);
    expect(resolveCensureMotion(g, 'aceptar')).toBe(g);
  });

  it('a second motion within the same era is definitive: gastar_pc/defensa_meritos are refused, only aceptar works', () => {
    const g = motionedGame(26);
    g.politicalCapital = 8;
    let next = resolveCensureMotion(g, 'gastar_pc'); // survive the first motion
    expect(next.censureUsedInEra).toBe(true);

    // Force a second motion in the same era.
    next.boardConfidence.value = 20;
    next.year += 1;
    evaluateBoardConfidence(next, 0);
    expect(next.censureMotion).toBeNull(); // no motion opened — straight to destitution
    expect(next.gameOver?.reason).toBe('destitucion_confianza');
  });

  it('completing a new era resets censureUsedInEra', () => {
    const g = motionedGame(27);
    g.politicalCapital = 8;
    const survived = resolveCensureMotion(g, 'gastar_pc');
    expect(survived.censureUsedInEra).toBe(true);

    survived.eraMilestonesAchieved = ['teams', 'divisions']; // era 1's 3rd milestone (contract) still missing
    evaluateEra(survived);
    expect(survived.era).toBe(1);
    expect(survived.censureUsedInEra).toBe(true); // unchanged — era hasn't advanced yet

    survived.commercialContracts.push({ id: 1, tipo: 'patrocinio', nombre: 'Big Corp', valorAnual: 4_000_000, yearsLeft: 3 });
    evaluateEra(survived);
    expect(survived.era).toBe(2);
    expect(survived.censureUsedInEra).toBe(false);
  });
});

describe('golden-safety (Fase 14.8)', () => {
  it('the golden scenario never sets gameOver (no players)', () => {
    let g = createGame(777);
    for (let i = 0; i < 6; i++) g = closeSeason(advanceSeason(startSeason(g)));
    expect(g.gameOver).toBeNull();
    expect(g.history.length).toBeGreaterThan(0); // the season loop completed
  });
});
