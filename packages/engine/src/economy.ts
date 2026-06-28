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
const NORM_ENFORCEMENT_COST = 500_000;

const CONTRACT_TYPES: CommercialContractType[] = [
  'patrocinio',
  'publicidad',
  'derechos_tv',
  'derechos_imagen',
];

const SPONSOR_NAMES = [
  'Coca-Cola', 'Nike', 'Adidas', 'Emirates', 'Pepsi', 'Santander',
  'Movistar', 'BBVA', 'Repsol', 'Iberdrola', 'Telefónica', 'CaixaBank',
  'Banco Sabadell', 'El Corte Inglés', 'Mapfre', 'AXA', 'Vodafone',
  'Orange', 'Samsung', 'Sony', 'BMW', 'Mercedes-Benz', 'Ford', 'Toyota',
  'Visa', 'Mastercard', 'Budweiser', 'Heineken', 'Puma', 'Under Armour',
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
  // Recalibrated (Fase 10): base values were inflated because leagueSize
  // was incorrectly counting rival teams (~150) instead of player teams (~20).
  const base = 600_000 + prestige * 30_000 + leagueSize * 80_000;
  return Array.from({ length: count }, (_, i) => ({
    id: year * 100 + i,
    tipo: CONTRACT_TYPES[randInt(rng, 0, CONTRACT_TYPES.length - 1)],
    nombre: SPONSOR_NAMES[randInt(rng, 0, SPONSOR_NAMES.length - 1)],
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
    nombre: offer.nombre,
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
  // Fase 10 fix: filter to player-federation teams/divisions only.
  // Before this fix, Fase 9 rival teams (~132) were counted, inflating
  // competing to ~150 and blowing up all revenue figures by 7-8×.
  const playerTeams = s.teams.filter(
    (t) => t.divisionOrden !== null && t.federationId === s.playerFederationId,
  );
  const competing = playerTeams.length;
  const playerDivisions = s.divisions.filter(
    (d) => d.federationId === s.playerFederationId,
  );

  const contractIncome = s.commercialContracts.reduce((a, c) => a + c.valorAnual, 0);
  const cost = operatingCost(competing, playerDivisions.length);
  const normCost = s.norms.length * NORM_ENFORCEMENT_COST;
  const prizes = s.prizePayments
    .filter((p) => p.year === s.year)
    .reduce((a, p) => a + p.amount, 0);
  const talent = Math.max(0, s.economy.talentInvestment);

  // Matchday revenue: federation earns a 10% commission on gate receipts.
  // (The club keeps the rest — consistent with team autonomy §2.)
  // Previously 70% was taken, which modeled the federation as the ticket seller.
  const capacityMultiplier = 1 - s.eventCapacityPenaltyPct;
  let matchdayRevenue = 0;
  for (const t of playerTeams) {
    if (t.stadiumCapacity > 0) {
      const homeMatches = s.results.filter((r) => r.homeId === t.id).length;
      matchdayRevenue += homeMatches * t.stadiumCapacity * 15 * 0.1 * capacityMultiplier;
    }
  }

  // Merchandise/brand revenue: scales with prestige × player teams only.
  // Factor reduced from 50K to 15K to match calibrated budget expectations.
  const merchandiseRevenue = s.prestige * competing * 15_000;

  const income = contractIncome + matchdayRevenue + merchandiseRevenue;

  // Batch 3: committed revenue shares for teams that adhesed with an offerValue.
  const revenueShareCost = s.negotiations
    .filter((n) => n.state === 'effective' && (n.offerValue ?? 0) > 0)
    .reduce((sum, n) => sum + Math.round((n.offerValue / 100) * income), 0);

  const net = income - cost - talent - normCost - revenueShareCost;
  s.treasury += net;

  const transferFees = s.transfers
    .filter((t) => t.year === s.year)
    .reduce((a, t) => a + t.transferFee, 0);
  const transferIncome = 0; // sell-on clause is future work

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
    normCost,
    prizes,
    talent,
    // Reported net includes prizes (already debited) so the UI reads the full
    // P&L for the season, not just the bit processEconomy itself moved.
    net: net - prizes,
    transferFees,
    transferIncome,
    matchday: Math.round(matchdayRevenue),
    merchandise: Math.round(merchandiseRevenue),
    treasuryAfter: s.treasury,
  };

  s.contractOffers = generateContractOffers(
    s.seed,
    s.year + 1,
    s.prestige,
    competing, // player teams only — rivals excluded
  );
  return { econDelta, talentBump };
}
