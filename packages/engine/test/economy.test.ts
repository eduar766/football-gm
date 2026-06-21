import { describe, expect, it } from 'vitest';
import {
  advanceSeason,
  cancelContract,
  closeSeason,
  createGame,
  setEconomyPolicy,
  setLeaguePrize,
  signContract,
  startSeason,
  type GameState,
} from '../src/index';

const players = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    name: `Eq ${i + 1}`,
    strength: 55,
    arraigo: 50,
  }));

function close(s: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) {
    if (s.phase === 'pretemporada') s = startSeason(s);
    s = closeSeason(advanceSeason(s));
  }
  return s;
}

describe('economy basics', () => {
  it('seeds a treasury and contract offers, no contracts yet', () => {
    const g = createGame(1, { teams: players(10) });
    expect(g.treasury).toBeGreaterThan(0);
    expect(g.commercialContracts).toHaveLength(0);
    expect(g.contractOffers.length).toBeGreaterThan(0);
    expect(g.economy).toEqual({ talentInvestment: 0 });
  });

  it('signing a contract adds annual income that lifts the treasury delta', () => {
    let withDeal = createGame(2, { teams: players(10), startingTreasury: 5_000_000 });
    const noDeal = close(
      createGame(2, { teams: players(10), startingTreasury: 5_000_000 }),
      1,
    );
    const offer = withDeal.contractOffers[0];
    withDeal = signContract(withDeal, offer.id);
    expect(withDeal.commercialContracts).toHaveLength(1);
    withDeal = close(withDeal, 1);
    expect(withDeal.treasury).toBeGreaterThan(noDeal.treasury);
    // Income includes contract + matchday + merchandise revenue
    expect(withDeal.lastEconomy?.income).toBeGreaterThanOrEqual(offer.valorAnual);
  });

  it('cancelling removes the contract', () => {
    let s = createGame(3, { teams: players(10) });
    s = signContract(s, s.contractOffers[0].id);
    const cid = s.commercialContracts[0].id;
    s = cancelContract(s, cid);
    expect(s.commercialContracts).toHaveLength(0);
  });
});

describe('financial tension (§5)', () => {
  it('a bigger league costs more to run', () => {
    const small = close(createGame(7, { teams: players(10) }), 1);
    const big = close(createGame(7, { teams: players(20) }), 1);
    expect(big.lastEconomy!.operatingCost).toBeGreaterThan(
      small.lastEconomy!.operatingCost,
    );
  });

  it('a negative treasury penalises prestige vs a solvent control', () => {
    // Same seed/teams/league prize: only the treasury differs, isolating the
    // brake. Fase 6.5: prizes are defined per competition now.
    // Prize is large enough to push the broke player's treasury negative even
    // with matchday + merchandise revenue.
    const withPrize = (s: GameState) =>
      setLeaguePrize(s, 40_000_000, [50, 30, 20]);
    const broke = close(
      withPrize(createGame(5, { teams: players(10), startingTreasury: 1_000_000 })),
      1,
    );
    const solvent = close(
      withPrize(createGame(5, { teams: players(10), startingTreasury: 300_000_000 })),
      1,
    );
    expect(broke.treasury).toBeLessThan(0);
    expect(solvent.treasury).toBeGreaterThanOrEqual(0);
    expect(broke.prestige).toBeLessThan(solvent.prestige);
  });

  it('talent investment raises competing teams’ strength', () => {
    const baseline = close(createGame(9, { teams: players(10) }), 1);
    let s = createGame(9, { teams: players(10) });
    s = setEconomyPolicy(s, { talentInvestment: 24_000_000 });
    s = close(s, 1);
    const avg = (g: GameState) =>
      g.teams.reduce((a, t) => a + t.strength, 0) / g.teams.length;
    expect(avg(s)).toBeGreaterThan(avg(baseline));
  });
});

describe('determinism with economy', () => {
  it('same seed + same economy actions => identical state', () => {
    const run = (seed: number) => {
      let s = createGame(seed, { teams: players(12) });
      s = signContract(s, s.contractOffers[0].id);
      s = setEconomyPolicy(s, { talentInvestment: 4_000_000 });
      s = setLeaguePrize(s, 3_000_000, [50, 30, 20]);
      return close(s, 5);
    };
    expect(JSON.stringify(run(404))).toBe(JSON.stringify(run(404)));
  });
});
