import { describe, it, expect } from 'vitest';
import { QK } from '../query-keys';

describe('QK query key factory', () => {
  it('summary returns ["summary", id]', () => {
    expect(QK.summary(42)).toEqual(['summary', 42]);
  });

  it('standings returns ["standings", id, div] when div provided', () => {
    expect(QK.standings(1, 2)).toEqual(['standings', 1, 2]);
  });

  it('standings returns ["standings", id, undefined] when div omitted', () => {
    expect(QK.standings(1)).toEqual(['standings', 1, undefined]);
  });

  it('games returns ["games"] (no args)', () => {
    expect(QK.games()).toEqual(['games']);
  });

  it('team returns ["team", id, teamId]', () => {
    expect(QK.team(5, 10)).toEqual(['team', 5, 10]);
  });

  it('each factory produces a unique key shape', () => {
    const keys = [
      QK.summary(1),
      QK.standings(1),
      QK.teams(1),
      QK.team(1, 1),
      QK.federation(1),
      QK.federations(1),
      QK.market(1),
      QK.negotiations(1),
      QK.structure(1),
      QK.economy(1),
      QK.norms(1),
      QK.events(1),
      QK.cups(1),
      QK.prizes(1),
      QK.transfers(1),
      QK.history(1),
      QK.compliance(1),
      QK.worldRanking(1),
      QK.worldStandings(1),
      QK.nextFixtures(1),
      QK.games(),
    ];
    const serialized = keys.map((k) => JSON.stringify(k));
    expect(new Set(serialized).size).toBe(keys.length);
  });
});
