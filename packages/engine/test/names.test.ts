import { describe, expect, it } from 'vitest';
import { createGame, makeRng, randomTeamName, randomFederationName } from '../src/index';

describe('name generators (Fase 14.1/14.2)', () => {
  it('randomTeamName is deterministic for the same seed', () => {
    const a = randomTeamName(makeRng(123));
    const b = randomTeamName(makeRng(123));
    expect(a).toBe(b);
    expect(a).toMatch(/\S+ \S+/);
  });

  it('randomTeamName avoids names already in the used set', () => {
    const rng = makeRng(42);
    const used = new Set<string>();
    const names = Array.from({ length: 10 }, () => randomTeamName(rng, used));
    expect(new Set(names).size).toBe(names.length); // all unique
  });

  it('randomFederationName follows the "Liga … de …" shape', () => {
    expect(randomFederationName(makeRng(7))).toMatch(/^Liga .+ de .+$/);
  });
});

describe('createGame identity (Fase 14.1)', () => {
  it('reflects a chosen commissioner and federation name', () => {
    const g = createGame(1, {
      commissionerName: 'Ada Lovelace',
      playerFederationName: 'Liga Federal de Valmonte',
    });
    expect(g.commissionerName).toBe('Ada Lovelace');
    const playerFed = g.federations.find((f) => f.id === g.playerFederationId);
    expect(playerFed?.name).toBe('Liga Federal de Valmonte');
  });

  it('falls back to a default commissioner name when none is given', () => {
    const g = createGame(1);
    expect(g.commissionerName).toBe('Comisionado/a');
  });
});
