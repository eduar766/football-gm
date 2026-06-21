import { describe, expect, it } from 'vitest';
import {
  advanceSeason,
  closeSeason,
  createCup,
  createGame,
  removePrize,
  setCupPrize,
  setLeaguePrize,
  startSeason,
  type GameState,
} from '../src/index';

const teams = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    name: `T ${i + 1}`,
    strength: 55,
    arraigo: 50,
  }));

const cycle = (g: GameState) => closeSeason(advanceSeason(startSeason(g)));

describe('setLeaguePrize / setCupPrize', () => {
  it('only in pretemporada', () => {
    let g = createGame(1, { teams: teams(6) });
    g = startSeason(g);
    const before = g;
    expect(setLeaguePrize(g, 1_000_000, [50, 30, 20])).toBe(before);
  });

  it('replaces the existing league prize (one slot per kind)', () => {
    let g = createGame(2, { teams: teams(6) });
    g = setLeaguePrize(g, 1_000_000, [100]);
    g = setLeaguePrize(g, 2_000_000, [50, 50]);
    expect(g.competitionPrizes.filter((p) => p.kind === 'liga')).toHaveLength(1);
    expect(g.competitionPrizes[0].pool).toBe(2_000_000);
  });

  it('rejects a cup prize when the cup does not exist', () => {
    const g = createGame(3, { teams: teams(6) });
    expect(setCupPrize(g, 999, 1_000_000, [100])).toBe(g);
  });

  it('removePrize drops the entry', () => {
    let g = createGame(4, { teams: teams(6) });
    g = setLeaguePrize(g, 1_000_000, [100]);
    const id = g.competitionPrizes[0].id;
    g = removePrize(g, id);
    expect(g.competitionPrizes).toHaveLength(0);
  });
});

describe('payLeaguePrize at closeSeason', () => {
  it('debits the treasury and records one payment per paid position', () => {
    let g = createGame(5, { teams: teams(8) });
    g = setLeaguePrize(g, 10_000_000, [50, 30, 20]);

    g = cycle(g);

    const ledger = g.prizePayments.filter(
      (p) => p.competitionLabel === 'Liga',
    );
    expect(ledger).toHaveLength(3);
    expect(ledger.reduce((a, p) => a + p.amount, 0)).toBe(10_000_000);
    // Prize payments are recorded and reduce lastEconomy.treasuryAfter relative
    // to what it would have been without prizes (prizes were debited in-season).
    expect(g.lastEconomy?.prizes).toBe(10_000_000);
  });

  it('no league prize defined => no payments and no treasury impact from prizes', () => {
    const g = cycle(createGame(6, { teams: teams(8) }));
    expect(g.prizePayments).toEqual([]);
    expect(g.lastEconomy?.prizes).toBe(0);
  });
});

describe('payCupPrize on crowning', () => {
  it('a knockout cup pays champion + runner-up + 2 semifinalists', () => {
    let g = createGame(7, { teams: teams(10) });
    const ids = g.teams.slice(0, 8).map((t) => t.id);
    g = createCup(g, 'Copa Premiada', 'copa', 'eliminatoria', 'primer_equipo', ids);
    const cupId = g.cups[0].id;
    g = setCupPrize(g, cupId, 4_000_000, [50, 25, 12.5, 12.5]);

    g = cycle(g);

    const ledger = g.prizePayments.filter(
      (p) => p.competitionLabel === 'Copa Premiada',
    );
    expect(ledger).toHaveLength(4);
    expect(ledger.reduce((a, p) => a + p.amount, 0)).toBe(4_000_000);
    // Position 1 is the cup champion.
    const champion = g.cups[0].championTeamId;
    expect(ledger[0].teamId).toBe(champion);
    expect(ledger[0].position).toBe(1);
    expect(ids).toContain(ledger[0].teamId);
  });

  it('a league-format cup pays by final standings', () => {
    let g = createGame(8, { teams: teams(10) });
    const ids = g.teams.slice(0, 6).map((t) => t.id);
    g = createCup(g, 'Liga Premiada', 'torneo_verano', 'liga', 'primer_equipo', ids);
    g = setCupPrize(g, g.cups[0].id, 6_000_000, [60, 40]);

    g = cycle(g);

    const ledger = g.prizePayments.filter(
      (p) => p.competitionLabel === 'Liga Premiada',
    );
    expect(ledger).toHaveLength(2);
    expect(ledger[0].amount + ledger[1].amount).toBe(6_000_000);
  });
});

describe('determinism with prizes', () => {
  it('same seed + same prize config => identical ledger', () => {
    const run = () => {
      let g = createGame(404, { teams: teams(8) });
      g = setLeaguePrize(g, 5_000_000, [40, 30, 20, 10]);
      return cycle(g);
    };
    const a = run();
    const b = run();
    expect(JSON.stringify(a.prizePayments)).toBe(JSON.stringify(b.prizePayments));
  });

  it('default game (no prizes defined) leaves payments empty', () => {
    const g = cycle(createGame(777));
    expect(g.prizePayments).toEqual([]);
  });
});
