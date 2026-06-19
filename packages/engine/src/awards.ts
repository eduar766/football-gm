// Goal attribution and season awards (§6) + match realism (§7: cards,
// suspensions, injuries). Everything uses the INDEPENDENT state.attributionRng
// stream so the match engine stays golden-stable. Default-path tests have no
// players => zero attributionRng usage => snapshot identical.

import { poisson, randInt, rngNext } from './rng';
import type { Award, GameState, Player, PlayerPosition } from './types';

const GOAL_WEIGHT: Record<PlayerPosition, number> = {
  POR: 0,
  DEF: 1,
  MED: 2,
  DEL: 4,
};
const ASSIST_WEIGHT: Record<PlayerPosition, number> = {
  POR: 0,
  DEF: 1,
  MED: 3,
  DEL: 2,
};
// Defenders foul the most; keepers very rarely get carded.
const CARD_WEIGHT: Record<PlayerPosition, number> = {
  POR: 0.5,
  DEF: 3,
  MED: 2,
  DEL: 1,
};

const YELLOW_LAMBDA = 2.5; // average yellow cards per team per match
const RED_PROB = 0.05;
const INJURY_PROB = 0.03;
const YELLOWS_FOR_SUSPENSION = 5;
const INJURY_MIN_MATCHES = 1;
const INJURY_MAX_MATCHES = 4;

function isAvailable(p: Player): boolean {
  return p.matchesSuspendedLeft <= 0 && p.injuredMatchesLeft <= 0;
}

function pickWeighted(
  state: GameState,
  squad: Player[],
  weightFn: (p: Player) => number,
  excludeId?: number,
): Player | undefined {
  let total = 0;
  for (const p of squad) {
    if (excludeId !== undefined && p.id === excludeId) continue;
    total += weightFn(p);
  }
  if (total <= 0) return undefined;
  let r = rngNext(state.attributionRng) * total;
  for (const p of squad) {
    if (excludeId !== undefined && p.id === excludeId) continue;
    const w = weightFn(p);
    if (w <= 0) continue;
    r -= w;
    if (r <= 0) return p;
  }
  return undefined;
}

function attributeForTeam(
  state: GameState,
  available: Player[],
  goals: number,
): void {
  for (let i = 0; i < goals; i++) {
    const scorer = pickWeighted(
      state,
      available,
      (p) => GOAL_WEIGHT[p.posicion] * p.calidad,
    );
    if (!scorer) continue;
    scorer.season.goals += 1;
    const assister = pickWeighted(
      state,
      available,
      (p) => ASSIST_WEIGHT[p.posicion] * p.calidad,
      scorer.id,
    );
    if (assister) assister.season.assists += 1;
  }
}

function startingKeeper(available: Player[]): Player | undefined {
  let best: Player | undefined;
  for (const p of available) {
    if (p.posicion !== 'POR') continue;
    if (!best || p.calidad > best.calidad) best = p;
  }
  return best;
}

function distributeCardsForTeam(state: GameState, available: Player[]): void {
  if (available.length === 0) return;
  const yellows = poisson(state.attributionRng, YELLOW_LAMBDA);
  for (let i = 0; i < yellows; i++) {
    const p = pickWeighted(state, available, (x) => CARD_WEIGHT[x.posicion]);
    if (!p) break;
    p.season.yellowCards += 1;
    if (p.season.yellowCards >= YELLOWS_FOR_SUSPENSION) {
      p.matchesSuspendedLeft += 1;
      p.season.yellowCards = 0;
    }
  }
  if (rngNext(state.attributionRng) < RED_PROB) {
    const p = pickWeighted(state, available, (x) => CARD_WEIGHT[x.posicion]);
    if (p) {
      p.season.redCards += 1;
      p.matchesSuspendedLeft += 1;
    }
  }
}

function maybeInjureTeam(state: GameState, available: Player[]): void {
  if (available.length === 0) return;
  if (rngNext(state.attributionRng) >= INJURY_PROB) return;
  const idx = Math.floor(rngNext(state.attributionRng) * available.length);
  const p = available[idx];
  p.injuredMatchesLeft = randInt(
    state.attributionRng,
    INJURY_MIN_MATCHES,
    INJURY_MAX_MATCHES,
  );
}

export function attributeMatchGoals(
  state: GameState,
  homeTeamId: number,
  awayTeamId: number,
  homeGoals: number,
  awayGoals: number,
): void {
  if (state.players.length === 0) return;
  const homeSquad = state.players.filter((p) => p.teamId === homeTeamId);
  const awaySquad = state.players.filter((p) => p.teamId === awayTeamId);
  const homeAvailable = homeSquad.filter(isAvailable);
  const awayAvailable = awaySquad.filter(isAvailable);

  attributeForTeam(state, homeAvailable, homeGoals);
  attributeForTeam(state, awayAvailable, awayGoals);

  if (homeGoals === 0) {
    const gk = startingKeeper(awayAvailable);
    if (gk) gk.season.cleanSheets += 1;
  }
  if (awayGoals === 0) {
    const gk = startingKeeper(homeAvailable);
    if (gk) gk.season.cleanSheets += 1;
  }

  // §7: cards + injuries from the same independent rng.
  distributeCardsForTeam(state, homeAvailable);
  distributeCardsForTeam(state, awayAvailable);
  maybeInjureTeam(state, homeAvailable);
  maybeInjureTeam(state, awayAvailable);
}

// Decrement availability counters one tick (called at the START of each
// matchday for the teams that are about to play).
export function tickAvailability(state: GameState, teamIds: Set<number>): void {
  if (state.players.length === 0) return;
  for (const p of state.players) {
    if (!teamIds.has(p.teamId)) continue;
    if (p.matchesSuspendedLeft > 0) p.matchesSuspendedLeft -= 1;
    if (p.injuredMatchesLeft > 0) p.injuredMatchesLeft -= 1;
  }
}

function competingTeamIds(state: GameState): Set<number> {
  return new Set(
    state.teams
      .filter(
        (t) =>
          t.divisionOrden !== null &&
          t.federationId === state.playerFederationId,
      )
      .map((t) => t.id),
  );
}

function bestPlayer(
  candidates: Player[],
  valueFn: (p: Player) => number,
): Player | undefined {
  let best: Player | undefined;
  let bestVal = -1;
  for (const p of candidates) {
    const v = valueFn(p);
    if (v <= 0) continue;
    if (v > bestVal || (v === bestVal && best && p.calidad > best.calidad)) {
      best = p;
      bestVal = v;
    }
  }
  return best;
}

// Compute the season awards (max_goleador / max_asistente / mejor_portero) for
// the just-closed year and reset per-season player stats.
export function settleSeasonAwards(s: GameState): void {
  if (s.players.length === 0) return;
  const teamIds = competingTeamIds(s);
  const competing = s.players.filter((p) => teamIds.has(p.teamId));
  const teamName = new Map(s.teams.map((t) => [t.id, t.name]));

  const push = (
    tipo: Award['tipo'],
    winner: Player | undefined,
    valor: number,
  ) => {
    if (!winner || valor <= 0) return;
    s.awards.push({
      year: s.year,
      tipo,
      playerId: winner.id,
      playerName: winner.name,
      teamId: winner.teamId,
      teamName: teamName.get(winner.teamId) ?? '—',
      valor,
    });
  };

  const topScorer = bestPlayer(competing, (p) => p.season.goals);
  push('max_goleador', topScorer, topScorer?.season.goals ?? 0);

  const topAssister = bestPlayer(competing, (p) => p.season.assists);
  push('max_asistente', topAssister, topAssister?.season.assists ?? 0);

  const keepers = competing.filter((p) => p.posicion === 'POR');
  const bestKeeper = bestPlayer(keepers, (p) => p.season.cleanSheets);
  push('mejor_portero', bestKeeper, bestKeeper?.season.cleanSheets ?? 0);

  for (const p of s.players) {
    p.season.goals = 0;
    p.season.assists = 0;
    p.season.cleanSheets = 0;
    p.season.yellowCards = 0;
    p.season.redCards = 0;
    p.matchesSuspendedLeft = 0;
    p.injuredMatchesLeft = 0;
  }
}
