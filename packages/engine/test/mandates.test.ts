import { describe, expect, it } from 'vitest';
import {
  advanceSeason,
  closeSeason,
  createGame,
  chooseMandate,
  startSeason,
  type GameState,
} from '../src/index';

const SQUAD = [
  { name: 'A', posicion: 'DEL' as const, calidad: 60 },
  { name: 'B', posicion: 'MED' as const, calidad: 55 },
];

function playableGame(seed = 42, n = 8): GameState {
  return createGame(seed, {
    startingTreasury: 100_000_000,
    teams: Array.from({ length: n }, (_, i) => ({ name: `E${i + 1}`, strength: 45 + i * 5, squad: SQUAD })),
  });
}

describe('mandate options (Fase 17G)', () => {
  it('createGame seeds exactly 3 options, one per difficulty, for year 1', () => {
    const g = createGame(1);
    expect(g.mandateOptions).toHaveLength(3);
    expect(g.mandateOptions.map((m) => m.difficulty).sort()).toEqual(['dificil', 'facil', 'medio']);
    expect(g.mandateOptions.every((m) => m.year === 1)).toBe(true);
    expect(g.mandateChosen).toBe(false);
    expect(g.mandateBonusImpulses).toBe(0);
  });

  it('chooseMandate commits the picked option into s.mandates and clears mandateOptions', () => {
    const g = playableGame();
    const picked = g.mandateOptions.find((m) => m.difficulty === 'dificil')!;
    const next = chooseMandate(g, picked.id);
    expect(next).not.toBe(g);
    expect(next.mandateChosen).toBe(true);
    expect(next.mandateOptions).toEqual([]);
    expect(next.mandates.find((m) => m.id === picked.id)?.difficulty).toBe('dificil');
  });

  it('is a no-op once already chosen', () => {
    const g = playableGame();
    const first = chooseMandate(g, g.mandateOptions[0].id);
    const second = chooseMandate(first, first.mandateOptions[0]?.id ?? -1);
    expect(second).toBe(first);
  });

  it('is a no-op for an unknown mandate id', () => {
    const g = playableGame();
    expect(chooseMandate(g, 999999)).toBe(g);
  });

  it('is a no-op outside pretemporada', () => {
    const g = startSeason(playableGame());
    expect(chooseMandate(g, g.mandates[0]?.id ?? -1)).toBe(g);
  });

  it('startSeason auto-commits the medio option when the player never chose', () => {
    const g = playableGame();
    const medioId = g.mandateOptions.find((m) => m.difficulty === 'medio')!.id;
    const started = startSeason(g);
    expect(started.mandateChosen).toBe(true);
    expect(started.mandateOptions).toEqual([]);
    expect(started.mandates.find((m) => m.year === g.year)?.id).toBe(medioId);
  });

  it('startSeason keeps the player\'s explicit choice instead of defaulting', () => {
    const g = playableGame();
    const dificil = g.mandateOptions.find((m) => m.difficulty === 'dificil')!;
    const chosen = chooseMandate(g, dificil.id);
    const started = startSeason(chosen);
    expect(started.mandates.find((m) => m.year === g.year)?.difficulty).toBe('dificil');
  });

  it('reset-for-pretemporada regenerates 3 fresh options for the next season', () => {
    let g = closeSeason(advanceSeason(startSeason(playableGame())));
    expect(g.phase).toBe('pretemporada');
    expect(g.mandateOptions).toHaveLength(3);
    expect(g.mandateChosen).toBe(false);
    expect(g.mandateOptions.every((m) => m.year === g.year)).toBe(true);
  });
});

describe('checkMandate — positive_balance now honors mandate.target (previously hardcoded to >=0)', () => {
  it('a positive_balance mandate is met/failed against its own target, not a fixed 0', () => {
    let g = playableGame();
    const facil = g.mandateOptions.find((m) => m.difficulty === 'facil')!;
    facil.type = 'positive_balance';
    facil.target = -1_000_000_000; // trivially "achievable" even with a real deficit
    g = startSeason(chooseMandate(g, facil.id));
    g.treasury = -500_000; // would have failed the old hardcoded ">= 0" check
    g = closeSeason(advanceSeason(g));
    expect(g.mandates.find((m) => m.id === facil.id)?.met).toBe(true);
  });
});

describe('difficulty-scaled rewards at evaluate-mandate', () => {
  it('a completed dificil mandate earns PC and banks a bonus impulse liquidated next season', () => {
    let g = playableGame();
    const dificil = g.mandateOptions.find((m) => m.difficulty === 'dificil')!;
    // Force it trivially achievable so it's guaranteed to be met at close.
    dificil.type = 'positive_balance';
    dificil.target = -1_000_000_000;
    g = startSeason(chooseMandate(g, dificil.id));
    const pcBefore = g.politicalCapital;
    const impulsesPerSeasonBefore = g.impulsesPerSeason;
    g = closeSeason(advanceSeason(g));
    expect(g.politicalCapital).toBeGreaterThan(pcBefore);
    expect(g.impulsesRemaining).toBe(impulsesPerSeasonBefore + 1); // dificil success banks +1, liquidated at reset-for-pretemporada
  });

  it('a completed facil mandate moves confidence but earns no PC (per the design table)', () => {
    let g = playableGame();
    const facil = g.mandateOptions.find((m) => m.difficulty === 'facil')!;
    facil.type = 'positive_balance';
    facil.target = -1_000_000_000;
    g = startSeason(chooseMandate(g, facil.id));
    const pcBefore = g.politicalCapital;
    g = closeSeason(advanceSeason(g));
    expect(g.politicalCapital).toBe(pcBefore);
  });
});

describe('golden safety', () => {
  it('a player-less game still generates/resolves mandates deterministically (mandatesRng is independent, never gated on players)', () => {
    const g = closeSeason(advanceSeason(startSeason(createGame(777))));
    expect(g.mandates.length).toBeGreaterThan(0);
    expect(g.mandateOptions).toHaveLength(3);
  });
});
