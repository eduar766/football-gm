import { describe, expect, it } from 'vitest';
import { createGame, setLeaguePrize, advanceSeason, startSeason, closeSeason } from '../src/index';
import { evaluateBoardConfidence, CONFIDENCE_START } from '../src/board';
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

  it('chained failures drive confidence to 0 → destitution', () => {
    const g = playableGame(7);
    // Simulate several disastrous closes directly (no year bump needed for the meter).
    for (let i = 0; i < 6 && !g.gameOver; i++) {
      g.treasury = -10_000_000;
      // mark this year's mandate failed
      const m = g.mandates.find((mm) => mm.year === g.year);
      if (m) m.met = false;
      else g.mandates.push({ id: g.nextMandateId++, type: 'positive_balance', description: 'x', target: 0, year: g.year, met: false });
      evaluateBoardConfidence(g, -1);
      g.year += 1;
    }
    expect(g.boardConfidence.value).toBe(0);
    expect(g.gameOver).not.toBeNull();
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

describe('golden-safety (Fase 14.8)', () => {
  it('the golden scenario never sets gameOver (no players)', () => {
    let g = createGame(777);
    for (let i = 0; i < 6; i++) g = closeSeason(advanceSeason(startSeason(g)));
    expect(g.gameOver).toBeNull();
    expect(g.history.length).toBeGreaterThan(0); // the season loop completed
  });
});
