// Fase 17B: public opinion (third constituency alongside board confidence and
// arraigo) + political capital (spendable currency). closeSeasonOpinion mirrors
// evaluateBoardConfidence's shape exactly — deterministic deltas accumulated
// into one history entry per season, no RNG. Gated on players.length > 0 so
// player-less golden runs never touch it (matches board.ts/demands.ts).

import { computeStandings } from './standings';
import { logFederation } from './federation-log';
import type { GameState } from './types';

const OPINION_START = 50;
const REGRESSION_K = 0.10;

const D_TITLE_RACE = 6;
const TITLE_RACE_MATCHDAYS_LEFT = 3;
const TITLE_RACE_GAP = 3;

const D_HIGH_SCORING = 2;
const AVG_GOALS_THRESHOLD = 2.8;

const D_CUP_FINAL = 3;
const D_NEW_CHAMPION = 4;

const D_DEMAND_IGNORED = -3;
const D_DEMAND_IGNORED_MAX = -9;

export const PC_MIN = 0;
export const PC_MAX = 12;

// closeSeason step (priority 175 — after economy/prizes, before characters
// 195 and the narrative layer). Reads s.results/s.cups/s.history before
// reset-for-pretemporada (290) wipes/advances them; s.year is still the
// closing season's year (year-bump runs at 260).
// integrityPenalty: published by the integrity-rolls step (priority 58, via
// ctx.meta) when a scandal or leaked cover-up fired this close (Fase 17D).
export function closeSeasonOpinion(s: GameState, integrityPenalty = 0): void {
  if (s.players.length === 0) return;

  let d = integrityPenalty;
  const reasons: string[] = [];
  if (integrityPenalty !== 0) reasons.push('escándalo de integridad');

  if (s.totalMatchdays >= TITLE_RACE_MATCHDAYS_LEFT) {
    const cutoff = s.totalMatchdays - TITLE_RACE_MATCHDAYS_LEFT;
    const topFlightTeams = s.teams.filter(
      (t) => t.federationId === s.playerFederationId && t.divisionOrden === 1,
    );
    const partialResults = s.results.filter((r) => r.divisionOrden === 1 && r.matchday <= cutoff);
    const table = computeStandings(topFlightTeams, partialResults);
    if (table.length >= 2 && table[0].points - table[1].points <= TITLE_RACE_GAP) {
      d += D_TITLE_RACE;
      reasons.push('carrera de título apretada');
    }
  }

  const leagueResults = s.results.filter((r) => r.divisionOrden === 1);
  if (leagueResults.length > 0) {
    const avgGoals = leagueResults.reduce((a, r) => a + r.homeGoals + r.awayGoals, 0) / leagueResults.length;
    if (avgGoals >= AVG_GOALS_THRESHOLD) {
      d += D_HIGH_SCORING;
      reasons.push('temporada goleadora');
    }
  }

  if (s.cups.some((c) => c.year === s.year && c.championTeamId !== null)) {
    d += D_CUP_FINAL;
    reasons.push('final de copa disputada');
  }

  const thisYearChampion = s.history.find((h) => h.year === s.year && h.divisionOrden === 1);
  const lastYearChampion = s.history.find((h) => h.year === s.year - 1 && h.divisionOrden === 1);
  if (thisYearChampion && lastYearChampion && thisYearChampion.championId !== lastYearChampion.championId) {
    d += D_NEW_CHAMPION;
    reasons.push('nuevo campeón');
  }

  const demandsIgnored = s.clubDemands.filter(
    (dm) => dm.year === s.year && dm.resolved && dm.satisfied === false,
  ).length;
  if (demandsIgnored > 0) {
    d += Math.max(D_DEMAND_IGNORED_MAX, D_DEMAND_IGNORED * demandsIgnored);
    reasons.push(`${demandsIgnored} petición(es) ignoradas`);
  }

  let next = Math.max(0, Math.min(100, s.publicOpinion + d));
  next = Math.round(next + (OPINION_START - next) * REGRESSION_K);
  next = Math.max(0, Math.min(100, next));

  s.publicOpinion = next;
  s.opinionHistory.push({
    year: s.year,
    value: next,
    reasons: reasons.length > 0 ? reasons : ['temporada tranquila'],
  });
}

export function earnPC(s: GameState, amount: number, reason: string): void {
  const before = s.politicalCapital;
  s.politicalCapital = Math.min(PC_MAX, before + amount);
  const delta = s.politicalCapital - before;
  if (delta === 0) return;
  logFederation(s, {
    year: s.year,
    matchday: 0,
    type: 'political_capital',
    title: 'Capital político ganado',
    detail: reason,
    value: delta,
    teamId: null,
  });
}

// Returns false (no mutation) when the balance can't cover the cost.
export function spendPC(s: GameState, amount: number, reason: string): boolean {
  if (s.politicalCapital < amount) return false;
  s.politicalCapital = Math.max(PC_MIN, s.politicalCapital - amount);
  logFederation(s, {
    year: s.year,
    matchday: 0,
    type: 'political_capital',
    title: 'Capital político gastado',
    detail: reason,
    value: -amount,
    teamId: null,
  });
  return true;
}
