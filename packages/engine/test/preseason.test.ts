import { describe, expect, it } from 'vitest';
import {
  createGame,
  setLeaguePrize,
  preseasonChecklist,
  preseasonBlockers,
} from '../src/index';
import type { GameState } from '../src/index';

function baseGame(): GameState {
  return createGame(2024, {
    startingTreasury: 100_000_000,
    teams: Array.from({ length: 6 }, (_, i) => ({ name: `E${i + 1}`, strength: 50 })),
  });
}

describe('pre-season checklist (Fase 14.3)', () => {
  it('a fresh game is blocked on league prizes but has a valid structure', () => {
    const g = baseGame();
    const ids = preseasonBlockers(g).map((b) => b.id);
    expect(ids).toContain('premios_liga');
    expect(ids).toContain('reparto_valido');
    expect(ids).not.toContain('estructura_definida'); // 6 teams in div 1
  });

  it('assigning a valid league prize clears the blockers', () => {
    let g = baseGame();
    g = setLeaguePrize(g, 10_000_000, [50, 30, 20]);
    expect(preseasonBlockers(g)).toHaveLength(0);
    const items = preseasonChecklist(g);
    expect(items.find((i) => i.id === 'premios_liga')!.done).toBe(true);
    expect(items.find((i) => i.id === 'reparto_valido')!.done).toBe(true);
  });

  it('a pending (unplaced) team blocks structure', () => {
    let g = setLeaguePrize(baseGame(), 10_000_000, [50, 30, 20]);
    g.teams[0].divisionOrden = null; // simulate an adhered team awaiting placement
    const ids = preseasonBlockers(g).map((b) => b.id);
    expect(ids).toContain('estructura_definida');
  });

  it('recommended items are never blocking', () => {
    const g = baseGame();
    const recommended = preseasonChecklist(g).filter((i) => !i.blocking).map((i) => i.id);
    expect(recommended).toEqual(expect.arrayContaining(['contratos', 'normas']));
    // none of the recommended ones appear as blockers even when not done
    const blockerIds = preseasonBlockers(g).map((b) => b.id);
    expect(blockerIds).not.toContain('contratos');
    expect(blockerIds).not.toContain('normas');
  });
});
