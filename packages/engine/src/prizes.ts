// Prize-by-competition (Fase 6.5). The commissioner sets, in pretemporada,
// a pool + a share table per competition (league + each cup). When the
// competition closes the engine pays out from the federation treasury and
// records every payment. Pure; no rng (golden-stable by construction).

import { computeStandings } from './standings';
import { applyPointPenalties, pointPenaltiesForYear } from './norms';
import type {
  Cup,
  GameState,
  MatchResult,
  PrizePayment,
} from './types';

const MAX_POOL = 500_000_000;
const MAX_POSITIONS = 16;

function normaliseShares(shares: number[]): number[] {
  const trimmed = shares
    .slice(0, MAX_POSITIONS)
    .map((s) => Math.max(0, Number(s) || 0));
  // Allow shares not summing to exactly 100; we just split the pool by ratio.
  return trimmed;
}

function distribute(pool: number, shares: number[]): number[] {
  const total = shares.reduce((a, b) => a + b, 0);
  if (total <= 0) return shares.map(() => 0);
  let assigned = 0;
  const out = shares.map((s, i) => {
    if (i === shares.length - 1) return pool - assigned; // last absorbs rounding
    const v = Math.round((s / total) * pool);
    assigned += v;
    return v;
  });
  return out;
}

export function setLeaguePrize(
  prev: GameState,
  pool: number,
  shares: number[],
): GameState {
  if (prev.phase !== 'pretemporada') return prev;
  const p = Math.max(0, Math.min(MAX_POOL, Math.round(pool)));
  const sh = normaliseShares(shares);
  const s = structuredClone(prev);
  // One league prize at most (top flight). Replace the existing one.
  s.competitionPrizes = s.competitionPrizes.filter((cp) => cp.kind !== 'liga');
  s.competitionPrizes.push({
    id: s.nextPrizeId,
    kind: 'liga',
    cupId: null,
    pool: p,
    shares: sh,
  });
  s.nextPrizeId += 1;
  return s;
}

export function setCupPrize(
  prev: GameState,
  cupId: number,
  pool: number,
  shares: number[],
): GameState {
  if (prev.phase !== 'pretemporada') return prev;
  if (!prev.cups.some((c) => c.id === cupId)) return prev;
  const p = Math.max(0, Math.min(MAX_POOL, Math.round(pool)));
  const sh = normaliseShares(shares);
  const s = structuredClone(prev);
  s.competitionPrizes = s.competitionPrizes.filter(
    (cp) => !(cp.kind === 'copa' && cp.cupId === cupId),
  );
  s.competitionPrizes.push({
    id: s.nextPrizeId,
    kind: 'copa',
    cupId,
    pool: p,
    shares: sh,
  });
  s.nextPrizeId += 1;
  return s;
}

export function removePrize(prev: GameState, prizeId: number): GameState {
  if (prev.phase !== 'pretemporada') return prev;
  if (!prev.competitionPrizes.some((cp) => cp.id === prizeId)) return prev;
  const s = structuredClone(prev);
  s.competitionPrizes = s.competitionPrizes.filter((cp) => cp.id !== prizeId);
  return s;
}

function record(
  s: GameState,
  competitionLabel: string,
  ranking: Array<{ teamId: number; teamName: string }>,
  amounts: number[],
  withheldIds: Set<number> = new Set(),
): void {
  for (let i = 0; i < amounts.length; i++) {
    const team = ranking[i];
    const amount = amounts[i];
    if (!team || amount <= 0) continue;
    // Withheld teams: prize stays in federation treasury (commissioner retains it).
    if (withheldIds.has(team.teamId)) continue;
    s.treasury -= amount;
    s.prizePayments.push({
      year: s.year,
      competitionLabel,
      teamId: team.teamId,
      teamName: team.teamName,
      position: i + 1,
      amount,
    } satisfies PrizePayment);
  }
}

// Pay the league prize using the top-flight (division 1) standings. Called
// from closeSeason after standings have been computed.
export function payLeaguePrize(s: GameState): void {
  const prize = s.competitionPrizes.find((cp) => cp.kind === 'liga');
  if (!prize || prize.pool <= 0 || prize.shares.length === 0) return;

  const top = s.teams.filter((t) => t.divisionOrden === 1);
  const results = s.results.filter((r) => r.divisionOrden === 1);
  const penalties = pointPenaltiesForYear(s, s.year);
  const standings = applyPointPenalties(
    computeStandings(top, results),
    penalties,
  );
  const amounts = distribute(prize.pool, prize.shares);
  const named = standings.map((row) => ({ teamId: row.teamId, teamName: row.name }));
  const withheld = new Set(s.teams.filter((t) => t.prizesWithheld).map((t) => t.id));
  record(s, 'Liga', named, amounts, withheld);
}

// Pay a cup prize from the cup's final ranking. For knockout cups: 1=champion,
// 2=runner-up, 3-4=losing semifinalists. For round-robin cups: standings.
export function payCupPrize(s: GameState, cup: Cup): void {
  const prize = s.competitionPrizes.find(
    (cp) => cp.kind === 'copa' && cp.cupId === cup.id,
  );
  if (!prize || prize.pool <= 0 || prize.shares.length === 0) return;

  const teamName = new Map(s.teams.map((t) => [t.id, t.name]));
  const named = (teamId: number) => ({
    teamId,
    teamName: teamName.get(teamId) ?? '—',
  });

  let ranking: Array<{ teamId: number; teamName: string }> = [];
  if (cup.formato === 'liga') {
    const teams = s.teams.filter((t) => cup.participantTeamIds.includes(t.id));
    const round = cup.rounds[0];
    if (!round) return;
    const results: MatchResult[] = round.matches.map((m) => ({
      matchday: 1,
      divisionOrden: 0,
      homeId: m.homeTeamId,
      awayId: m.awayTeamId,
      homeGoals: m.homeGoals ?? 0,
      awayGoals: m.awayGoals ?? 0,
    }));
    ranking = computeStandings(teams, results).map((r) => ({
      teamId: r.teamId,
      teamName: r.name,
    }));
  } else {
    // Knockout: rebuild ranking by elimination depth. Champion + runner-up
    // come from the final; semifinalists are the losers of the semis, etc.
    if (cup.championTeamId !== null) ranking.push(named(cup.championTeamId));
    const lastRound = cup.rounds[cup.rounds.length - 1];
    if (lastRound) {
      for (const m of lastRound.matches) {
        const loser =
          m.winnerTeamId === m.homeTeamId ? m.awayTeamId : m.homeTeamId;
        if (loser > 0 && loser !== cup.championTeamId) ranking.push(named(loser));
      }
    }
    // Earlier rounds: walk back, listing losers in match order until we cover
    // as many positions as `shares.length` (avoids paying unneeded positions).
    for (let i = cup.rounds.length - 2; i >= 0 && ranking.length < prize.shares.length; i--) {
      const round = cup.rounds[i];
      for (const m of round.matches) {
        if (ranking.length >= prize.shares.length) break;
        const loser =
          m.winnerTeamId === m.homeTeamId ? m.awayTeamId : m.homeTeamId;
        if (loser > 0 && !ranking.some((r) => r.teamId === loser)) {
          ranking.push(named(loser));
        }
      }
    }
  }

  const amounts = distribute(prize.pool, prize.shares);
  const withheld = new Set(s.teams.filter((t) => t.prizesWithheld).map((t) => t.id));
  record(s, cup.name, ranking, amounts, withheld);
}
