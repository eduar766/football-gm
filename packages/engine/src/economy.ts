// Federation economy (§4.5) + the financial-tension snowball brake (§5).
// Pure. The contract market uses an INDEPENDENT rng derived from (seed, year)
// so economy never perturbs the simulation rng stream — the golden master and
// determinism of the match engine stay intact.

import { makeRng, randInt } from './rng';
import type {
  CommercialContractType,
  ContractOffer,
  GameState,
} from './types';

export const STARTING_TREASURY = 80_000_000;
const OP_BASE = 1_000_000;
const OP_PER_TEAM = 400_000;
const OP_PER_DIVISION = 800_000;

const CONTRACT_TYPES: CommercialContractType[] = [
  'patrocinio',
  'publicidad',
  'derechos_tv',
  'derechos_imagen',
];

export type FinancialHealth = 'saneada' | 'ajustada' | 'en_riesgo' | 'quiebra';

export function financialHealth(treasury: number): FinancialHealth {
  if (treasury < 0) return 'quiebra';
  if (treasury < 10_000_000) return 'en_riesgo';
  if (treasury < 30_000_000) return 'ajustada';
  return 'saneada';
}

export function operatingCost(competingTeams: number, divisions: number): number {
  return OP_BASE + OP_PER_TEAM * competingTeams + OP_PER_DIVISION * divisions;
}

// Deterministic offers from an INDEPENDENT stream (not state.rng). Bigger
// federations (more prestige, larger league) attract bigger deals.
export function generateContractOffers(
  seed: number,
  year: number,
  prestige: number,
  leagueSize: number,
): ContractOffer[] {
  const rng = makeRng((seed ^ (year * 2654435761) ^ 0x9e3779b9) >>> 0);
  const count = 3 + (randInt(rng, 0, 1) === 1 ? 1 : 0);
  const base = 1_500_000 + prestige * 90_000 + leagueSize * 220_000;
  return Array.from({ length: count }, (_, i) => ({
    id: year * 100 + i,
    tipo: CONTRACT_TYPES[randInt(rng, 0, CONTRACT_TYPES.length - 1)],
    valorAnual: base + randInt(rng, 0, base),
    years: randInt(rng, 2, 4),
  }));
}

export function signContract(prev: GameState, offerId: number): GameState {
  const offer = prev.contractOffers.find((o) => o.id === offerId);
  if (!offer) return prev;
  const s = structuredClone(prev);
  s.commercialContracts.push({
    id: s.nextContractId,
    tipo: offer.tipo,
    valorAnual: offer.valorAnual,
    yearsLeft: offer.years,
  });
  s.nextContractId += 1;
  s.contractOffers = s.contractOffers.filter((o) => o.id !== offerId);
  return s;
}

export function cancelContract(prev: GameState, contractId: number): GameState {
  if (!prev.commercialContracts.some((c) => c.id === contractId)) return prev;
  const s = structuredClone(prev);
  s.commercialContracts = s.commercialContracts.filter((c) => c.id !== contractId);
  return s;
}

export function setEconomyPolicy(
  prev: GameState,
  policy: { talentInvestment: number },
): GameState {
  const s = structuredClone(prev);
  s.economy = {
    talentInvestment: Math.max(
      0,
      Math.min(500_000_000, Math.round(policy.talentInvestment)),
    ),
  };
  return s;
}

// Runs the federation's finances for the just-closed season. Mutates the
// already-cloned state (no state.rng use). Returns the prestige adjustment to
// fold into the season delta and the talent strength bump for the engine to
// apply after drift.
//
// Fase 6.5: prizes are NOT taken from a global pool any more — payLeaguePrize
// and payCupPrize already debited the treasury when each competition closed.
// processEconomy just sums them for `lastEconomy.prizes` and the prestige bonus.
export function processEconomy(s: GameState): {
  econDelta: number;
  talentBump: number;
} {
  const competing = s.teams.filter((t) => t.divisionOrden !== null).length;
  const income = s.commercialContracts.reduce((a, c) => a + c.valorAnual, 0);
  const cost = operatingCost(competing, s.divisions.length);
  const prizes = s.prizePayments
    .filter((p) => p.year === s.year)
    .reduce((a, p) => a + p.amount, 0);
  const talent = Math.max(0, s.economy.talentInvestment);
  // Income / cost / talent move the treasury here; prize payouts already did.
  const net = income - cost - talent;
  s.treasury += net;

  let econDelta = 0;
  if (prizes > 0) econDelta += Math.min(3, Math.floor(prizes / 6_000_000));
  if (s.treasury < 0) {
    econDelta -= Math.min(6, Math.ceil(-s.treasury / 12_000_000));
  }
  const talentBump = Math.max(0, Math.min(3, Math.round(talent / 8_000_000)));

  for (const c of s.commercialContracts) c.yearsLeft -= 1;
  s.commercialContracts = s.commercialContracts.filter((c) => c.yearsLeft > 0);

  s.lastEconomy = {
    year: s.year,
    income,
    operatingCost: cost,
    prizes,
    talent,
    // Reported net includes prizes (already debited) so the UI reads the full
    // P&L for the season, not just the bit processEconomy itself moved.
    net: net - prizes,
    treasuryAfter: s.treasury,
  };

  s.contractOffers = generateContractOffers(
    s.seed,
    s.year + 1,
    s.prestige,
    competing,
  );
  return { econDelta, talentBump };
}
