import { describe, expect, it } from 'vitest';
import {
  advanceSeason,
  closeSeason,
  createGame,
  createOwnTeam,
  signContract,
  startSeason,
  addNorm,
} from '../src/index';
import type { GameState } from '../src/index';

function baseGame(): GameState {
  return createGame(4321, {
    startingTreasury: 100_000_000,
    teams: Array.from({ length: 6 }, (_, i) => ({
      name: `Equipo ${i + 1}`,
      strength: 50,
    })),
  });
}

describe('federation log (Fase 14.6)', () => {
  it('starts empty and is initialised', () => {
    const g = baseGame();
    expect(g.federationLog).toEqual([]);
    expect(g.nextFederationLogId).toBe(1);
  });

  it('logs a team_created entry when building a club', () => {
    const g = createOwnTeam(baseGame(), 'CD Cronología');
    const entry = g.federationLog.find((e) => e.type === 'team_created');
    expect(entry).toBeDefined();
    expect(entry!.detail).toContain('CD Cronología');
    expect(entry!.teamId).toBeGreaterThan(0);
  });

  it('logs a sponsor_signed entry when signing a commercial contract', () => {
    const g = baseGame();
    const offer = g.contractOffers[0];
    expect(offer).toBeDefined();
    const next = signContract(g, offer.id);
    const entry = next.federationLog.find((e) => e.type === 'sponsor_signed');
    expect(entry).toBeDefined();
    expect(entry!.value).toBe(offer.valorAnual);
  });

  it('logs a norm_created entry', () => {
    const g = addNorm(baseGame(), 'tope_salarial', 5_000_000);
    expect(g.federationLog.some((e) => e.type === 'norm_created')).toBe(true);
  });

  it('logs prestige_snapshot + mandate_result at season close', () => {
    let g = baseGame();
    g = closeSeason(advanceSeason(startSeason(g)));
    expect(g.federationLog.some((e) => e.type === 'prestige_snapshot')).toBe(true);
    expect(g.federationLog.some((e) => e.type === 'mandate_result')).toBe(true);
    // Ids are unique and monotonically increasing.
    const ids = g.federationLog.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
