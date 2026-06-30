// Federation economy (§4.5) + the financial-tension snowball brake (§5).
// Pure. The contract market uses an INDEPENDENT rng derived from (seed, year)
// so economy never perturbs the simulation rng stream — the golden master and
// determinism of the match engine stay intact.

import { makeRng, randInt } from './rng';
import { wageBill } from './salaries';
import type {
  CommercialContractType,
  ContractOffer,
  GameState,
  Team,
  TeamSeasonEconomy,
  TeamSponsor,
} from './types';

export const STARTING_TREASURY = 80_000_000;
export const TEAM_STARTING_TREASURY_BASE = 5_000_000;
export const TEAM_STARTING_TREASURY_PER_STRENGTH = 200_000;
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

// ── Team-level economy ────────────────────────────────────────────────────────

export type TeamFinancialHealth = 'saneada' | 'ajustada' | 'en_riesgo' | 'quiebra';

export function teamFinancialHealth(treasury: number, annualWages: number): TeamFinancialHealth {
  const buffer = Math.max(annualWages, 1_000_000);
  if (treasury < 0) return 'quiebra';
  if (treasury < buffer) return 'en_riesgo';
  if (treasury < buffer * 2) return 'ajustada';
  return 'saneada';
}

const TEAM_SPONSOR_NAMES = [
  'Banca Regional', 'Seguros del Norte', 'Cerveza Dorada', 'AutoCenter',
  'TechSport', 'Energía Plus', 'Café Montaña', 'Telecomunicaciones Sur',
  'Constructora Álvarez', 'Supermercados Frescos', 'Farmacia Vida', 'Hotel Plaza',
  'Transportes Rápidos', 'Clínica Salud', 'Editorial Deportes', 'Radio Estadio',
  'Bodega Rioja', 'Óptica Central', 'Concesionario Premier', 'Medios Digitales',
];

function teamSponsorValue(team: Team, federationPrestige: number): number {
  // Base value scales with team strength + stadium size + federation prestige halo.
  return Math.round(
    (team.strength * 12_000 + team.stadiumCapacity * 6 + 150_000) *
    (0.8 + (federationPrestige / 100) * 0.4),
  );
}

// Called at startSeason for player-federation teams: auto-renew or sign new sponsors.
export function autoNegotiateTeamSponsors(s: GameState): void {
  const rng = makeRng((s.seed ^ (s.year * 0x45d9f3b) ^ 0x2c4a1d7e) >>> 0);
  const playerTeams = s.teams.filter(
    (t) => t.divisionOrden !== null && t.federationId === s.playerFederationId,
  );

  for (const team of playerTeams) {
    // Decrement existing sponsor years and remove expired ones.
    for (const sp of team.sponsors) sp.yearsLeft -= 1;
    team.sponsors = team.sponsors.filter((sp) => sp.yearsLeft > 0);

    // Teams aim to maintain 1-2 active sponsors.
    const target = 1 + (randInt(rng, 0, 1));
    const needed = Math.max(0, target - team.sponsors.length);
    for (let i = 0; i < needed; i++) {
      const name = TEAM_SPONSOR_NAMES[randInt(rng, 0, TEAM_SPONSOR_NAMES.length - 1)];
      const valor = Math.round(teamSponsorValue(team, s.prestige) * (0.8 + randInt(rng, 0, 4) * 0.1));
      const sponsor: TeamSponsor = {
        id: s.nextTeamSponsorId++,
        name,
        valorAnual: valor,
        yearsLeft: 1 + randInt(rng, 0, 2), // 1-3 years
      };
      team.sponsors.push(sponsor);
    }
  }
}

// Computes team P&L for the just-closed season and updates team treasuries.
// Called in closeSeason AFTER payLeaguePrize and processEconomy (federation),
// but BEFORE runTransferWindow (so transfer fees from this window don't overlap).
export function processTeamEconomies(s: GameState): void {
  const capacityMultiplier = 1 - s.eventCapacityPenaltyPct;
  const playerTeamIds = new Set(
    s.teams
      .filter((t) => t.divisionOrden !== null && t.federationId === s.playerFederationId)
      .map((t) => t.id),
  );

  // Transfer fees from the CURRENT year's window (ran at end of last closeSeason).
  // transfers are recorded with year === s.year because the window ran after s.year++ last season.
  const transfersByBuyer = new Map<number, number>();
  const transfersBySeller = new Map<number, number>();
  for (const tr of s.transfers.filter((t) => t.year === s.year)) {
    if (playerTeamIds.has(tr.toTeamId)) {
      transfersByBuyer.set(tr.toTeamId, (transfersByBuyer.get(tr.toTeamId) ?? 0) + tr.transferFee);
    }
    if (playerTeamIds.has(tr.fromTeamId)) {
      transfersBySeller.set(tr.fromTeamId, (transfersBySeller.get(tr.fromTeamId) ?? 0) + tr.transferFee);
    }
  }

  for (const team of s.teams) {
    if (!playerTeamIds.has(team.id)) continue;

    // Gate receipts: team keeps 90% (federation keeps 10% — already in processEconomy).
    let gateReceipts = 0;
    if (team.stadiumCapacity > 0) {
      const homeMatches = s.results.filter((r) => r.homeId === team.id).length;
      gateReceipts = Math.round(homeMatches * team.stadiumCapacity * 15 * 0.9 * capacityMultiplier);
    }

    // Sponsor income.
    const sponsorIncome = team.sponsors.reduce((a, sp) => a + sp.valorAnual, 0);

    // Prize income: from prizePayments for this season (prizesWithheld check done in payLeaguePrize/payCupPrize).
    const prizeIncome = s.prizePayments
      .filter((p) => p.year === s.year && p.teamId === team.id)
      .reduce((a, p) => a + p.amount, 0);

    // Transfer fees (from last window, recorded with this year number).
    const transferIncome = transfersBySeller.get(team.id) ?? 0;
    const transferExpenses = transfersByBuyer.get(team.id) ?? 0;

    // Wages.
    const wageExpenses = wageBill(team.id, s.players);

    // Autonomous infrastructure investment: teams with surplus spend on improvement.
    const reserve = Math.max(wageExpenses * 2, 2_000_000);
    const surplus = team.treasury - reserve;
    let infrastructureExpenses = 0;
    if (surplus > 2_000_000) {
      // Invest up to 35% of surplus, max 8M per season.
      infrastructureExpenses = Math.min(Math.round(surplus * 0.35), 8_000_000);
      // Stadium expansion: every 3M invested adds 1000 seats (max +5000/season).
      const seatBonus = Math.min(5_000, Math.floor(infrastructureExpenses / 3_000_000) * 1_000);
      team.stadiumCapacity += seatBonus;
      // Academy improvement: every 2M adds 1 rating point (max +3/season).
      const academiaBonus = Math.min(3, Math.floor(infrastructureExpenses / 2_000_000));
      team.academia = Math.min(100, team.academia + academiaBonus);
    }

    const net = gateReceipts + sponsorIncome + prizeIncome + transferIncome
              - wageExpenses - transferExpenses - infrastructureExpenses;
    team.treasury += net;

    team.lastTeamEconomy = {
      year: s.year,
      gateReceipts,
      sponsorIncome,
      prizeIncome,
      transferIncome,
      wageExpenses,
      transferExpenses,
      infrastructureExpenses,
      net,
      treasuryAfter: team.treasury,
    } satisfies TeamSeasonEconomy;
  }
}

// Rescue: commissioner injects capital from federation treasury into a struggling club.
export function rescueTeam(
  prev: GameState,
  teamId: number,
  amount: number,
  withholdPrizes: boolean,
): GameState {
  const team = prev.teams.find((t) => t.id === teamId);
  if (!team || team.federationId !== prev.playerFederationId) return prev;
  const safeAmount = Math.max(0, Math.round(amount));
  if (safeAmount === 0 || prev.treasury < safeAmount) return prev;

  const s = structuredClone(prev);
  const t = s.teams.find((t) => t.id === teamId)!;
  s.treasury -= safeAmount;
  t.treasury += safeAmount;
  if (withholdPrizes) t.prizesWithheld = true;
  s.rescueLog.push({ year: s.year, teamId, teamName: t.name, amount: safeAmount });
  return s;
}
