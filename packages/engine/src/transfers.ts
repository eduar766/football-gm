// Pretemporada transfer window (Fase 6.4). Players actually change teams —
// stronger clubs scout from weaker ones. Pure, deterministic, uses its own
// `transfersRng` so the match engine stream stays golden-stable. A default
// game with no players is a no-op (the rng is never consumed), so the golden
// master is preserved.

import { rngNext, type RngState } from './rng';
import { teamFinancialHealth } from './economy';
import { wageBill } from './salaries';
import type { GameState, Player, Team, TransferEntry } from './types';

// Probability that an offer succeeds. Tuned so each club lands roughly one
// new face per season when there's a meaningful gap; settles into a steady
// rotation rather than wholesale roster turnover.
const OFFER_SUCCESS_P = 0.5;
const ATTEMPTS_PER_CLUB = 2;
// Squad-quality basis for team.strength after a transfer window: average the
// top N quality values. Clubs with deeper benches are not over-rewarded.
const SQUAD_TOP_N = 11;

// Fase 15B: treasury shapes the market. A club at/above this treasury buys at
// full appetite (weight multiplier caps at 1.5x strength); a broke club's
// weight bottoms out at 0.5x strength — present in the market but marginal.
const TREASURY_WEIGHT_REFERENCE = 20_000_000;
const TREASURY_WEIGHT_MIN = 0.5;
const TREASURY_WEIGHT_MAX = 1.5;
// A club in financial distress (en_riesgo/quiebra) dumps its best player at a
// discount to survive — enters the pool even if out of the buyer's league,
// weighted up so it's likely to actually move.
const DISTRESS_FEE_DISCOUNT = 0.7;
const DISTRESS_WEIGHT_MULTIPLIER = 3;

function isSubject(state: GameState, t: Team): boolean {
  return t.divisionOrden !== null && t.federationId === state.playerFederationId;
}

function weightedPick<T>(items: T[], weights: number[], rng: RngState): T | null {
  let total = 0;
  for (const w of weights) total += Math.max(0, w);
  if (total <= 0) return null;
  let r = rngNext(rng) * total;
  for (let i = 0; i < items.length; i++) {
    const w = Math.max(0, weights[i]);
    r -= w;
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// Average of the top N quality values; null when the team has no players, so
// the caller knows to leave team.strength untouched (the strength field is
// still the source of truth for teams without a tracked squad).
export function teamStrengthFromSquad(
  players: Player[],
  teamId: number,
): number | null {
  const squad = players.filter((p) => p.teamId === teamId);
  if (squad.length === 0) return null;
  const sorted = [...squad].sort((a, b) => b.calidad - a.calidad);
  const top = sorted.slice(0, Math.min(SQUAD_TOP_N, sorted.length));
  const avg = top.reduce((s, p) => s + p.calidad, 0) / top.length;
  return Math.round(Math.max(20, Math.min(95, avg)));
}

// Mutates `s` in place — same convention as expireStaleEvents/processEconomy
// inside engine.ts; closeSeason has already cloned the state, so a second
// clone here would be wasted work.
export function runTransferWindow(s: GameState): void {
  // Fast path: no players => no possible transfers, do NOT touch transfersRng
  // so the golden master stays byte-identical for player-less games.
  if (s.players.length === 0) return;

  const subjectIds = new Set(
    s.teams.filter((t) => isSubject(s, t)).map((t) => t.id),
  );
  if (subjectIds.size < 2) return;

  const buyers = s.teams.filter((t) => subjectIds.has(t.id));
  const totalAttempts = buyers.length * ATTEMPTS_PER_CLUB;
  const teamName = new Map(s.teams.map((t) => [t.id, t.name]));
  const transferredPlayerIds = new Set<number>();

  // Fase 15B: snapshot financial distress once at window-open (not
  // recomputed per attempt) — a club dumping its star is a decision made
  // going into the window, not re-evaluated mid-window.
  const distressedStarId = new Map<number, number>(); // teamId -> playerId
  for (const t of buyers) {
    const health = teamFinancialHealth(t.treasury, wageBill(t.id, s.players));
    if (health !== 'en_riesgo' && health !== 'quiebra') continue;
    const squad = s.players.filter((p) => p.teamId === t.id);
    if (squad.length === 0) continue;
    const best = squad.reduce((a, b) => (b.calidad > a.calidad ? b : a));
    distressedStarId.set(t.id, best.id);
  }

  const buyerWeight = (b: Team) =>
    b.strength *
    (TREASURY_WEIGHT_MIN +
      Math.min(
        TREASURY_WEIGHT_MAX - TREASURY_WEIGHT_MIN,
        Math.max(0, b.treasury) / TREASURY_WEIGHT_REFERENCE,
      ));

  for (let i = 0; i < totalAttempts; i++) {
    // Pick a buyer weighted by strength AND treasury — a rich club shops
    // more; a broke one barely shows up (Fase 15B).
    const buyer = weightedPick(buyers, buyers.map(buyerWeight), s.transfersRng);
    if (!buyer) break;

    // Candidates: players on OTHER subject clubs, not yet transferred this
    // window, and at or below the buyer's level (a club doesn't chase players
    // it can't realistically lure) — UNLESS a desperate seller is dumping
    // their best player regardless of the buyer's level.
    const candidates: Player[] = [];
    const weights: number[] = [];
    for (const p of s.players) {
      if (transferredPlayerIds.has(p.id)) continue;
      if (p.teamId === buyer.id) continue;
      if (!subjectIds.has(p.teamId)) continue;
      const isDistressStar = distressedStarId.get(p.teamId) === p.id;
      if (p.calidad > buyer.strength + 5 && !isDistressStar) continue; // out of league
      candidates.push(p);
      // Prefer higher-quality targets so transfers actually shift balance.
      const base = Math.max(1, p.calidad);
      weights.push(isDistressStar ? base * DISTRESS_WEIGHT_MULTIPLIER : base);
    }
    if (candidates.length === 0) {
      // Burn one rng value so the loop is still deterministic and uniform.
      rngNext(s.transfersRng);
      continue;
    }

    const target = weightedPick(candidates, weights, s.transfersRng);
    if (!target) continue;

    const isDistressStar = distressedStarId.get(target.teamId) === target.id;
    let fee = Math.round(buyer.strength * 50_000 + target.calidad * 100_000);
    if (isDistressStar) fee = Math.round(fee * DISTRESS_FEE_DISCOUNT);

    // Solvency gate: a buyer who can't afford the fee doesn't make the offer.
    // Still burns the acceptance-roll rng value so the stream stays
    // deterministic regardless of which branch is taken.
    if (buyer.treasury < fee) {
      rngNext(s.transfersRng);
      continue;
    }

    // Acceptance roll. Failed attempts still consume an rng value above.
    if (rngNext(s.transfersRng) >= OFFER_SUCCESS_P) continue;

    const fromTeamId = target.teamId;
    target.teamId = buyer.id;
    transferredPlayerIds.add(target.id);

    // Update club treasuries immediately (team-level economy).
    buyer.treasury -= fee;
    const sellerTeam = s.teams.find((t) => t.id === fromTeamId);
    if (sellerTeam) sellerTeam.treasury += fee;

    s.transfers.push({
      year: s.year,
      playerId: target.id,
      playerName: target.name,
      fromTeamId,
      fromTeamName: teamName.get(fromTeamId) ?? '—',
      toTeamId: buyer.id,
      toTeamName: buyer.name,
      calidad: target.calidad,
      transferFee: fee,
    } satisfies TransferEntry);
  }

  // After moves, recompute strength from squad so the engine reflects the
  // new rosters next season. Teams without a tracked squad keep their value.
  for (const t of s.teams) {
    if (!subjectIds.has(t.id)) continue;
    const fromSquad = teamStrengthFromSquad(s.players, t.id);
    if (fromSquad !== null) t.strength = fromSquad;
  }
}

// Convenience selector: transfers for a specific year (empty if none).
export function transfersForYear(state: GameState, year: number): TransferEntry[] {
  return state.transfers.filter((t) => t.year === year);
}
