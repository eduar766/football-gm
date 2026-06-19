// Pretemporada transfer window (Fase 6.4). Players actually change teams —
// stronger clubs scout from weaker ones. Pure, deterministic, uses its own
// `transfersRng` so the match engine stream stays golden-stable. A default
// game with no players is a no-op (the rng is never consumed), so the golden
// master is preserved.

import { rngNext, type RngState } from './rng';
import type { GameState, Player, Team, TransferEntry } from './types';

// Probability that an offer succeeds. Tuned so each club lands roughly one
// new face per season when there's a meaningful gap; settles into a steady
// rotation rather than wholesale roster turnover.
const OFFER_SUCCESS_P = 0.5;
const ATTEMPTS_PER_CLUB = 2;
// Squad-quality basis for team.strength after a transfer window: average the
// top N quality values. Clubs with deeper benches are not over-rewarded.
const SQUAD_TOP_N = 11;

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

  for (let i = 0; i < totalAttempts; i++) {
    // Pick a buyer weighted by current strength (stronger clubs offer more).
    const buyer = weightedPick(buyers, buyers.map((b) => b.strength), s.transfersRng);
    if (!buyer) break;

    // Candidates: players on OTHER subject clubs, not yet transferred this
    // window, and at or below the buyer's level (a club doesn't chase players
    // it can't realistically lure).
    const candidates: Player[] = [];
    const weights: number[] = [];
    for (const p of s.players) {
      if (transferredPlayerIds.has(p.id)) continue;
      if (p.teamId === buyer.id) continue;
      if (!subjectIds.has(p.teamId)) continue;
      if (p.calidad > buyer.strength + 5) continue; // out of league
      candidates.push(p);
      // Prefer higher-quality targets so transfers actually shift balance.
      weights.push(Math.max(1, p.calidad));
    }
    if (candidates.length === 0) {
      // Burn one rng value so the loop is still deterministic and uniform.
      rngNext(s.transfersRng);
      continue;
    }

    const target = weightedPick(candidates, weights, s.transfersRng);
    if (!target) continue;

    // Acceptance roll. Failed attempts still consume an rng value above.
    if (rngNext(s.transfersRng) >= OFFER_SUCCESS_P) continue;

    const fromTeamId = target.teamId;
    target.teamId = buyer.id;
    transferredPlayerIds.add(target.id);
    s.transfers.push({
      year: s.year,
      playerId: target.id,
      playerName: target.name,
      fromTeamId,
      fromTeamName: teamName.get(fromTeamId) ?? '—',
      toTeamId: buyer.id,
      toTeamName: buyer.name,
      calidad: target.calidad,
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
