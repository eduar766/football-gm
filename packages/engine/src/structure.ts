// League structure (§4.4): divisions, and the leveling league that decides
// which teams land in which division. Pure functions over GameState.

import { generateFixtures } from './fixtures';
import { simulateMatch } from './match';
import { computeStandings } from './standings';
import type { GameState, MatchResult, Team } from './types';

export const MAX_DIVISION_SIZE = 12;
export const PROMOTION_RELEGATION = 2;

const ORDINALS = ['Primera', 'Segunda', 'Tercera', 'Cuarta', 'Quinta', 'Sexta'];

export function divisionName(orden: number): string {
  const o = ORDINALS[orden - 1];
  return o ? `${o} División` : `División ${orden}`;
}

export function competingTeams(state: GameState): Team[] {
  return state.teams.filter((t) => t.divisionOrden !== null);
}

export function teamsInDivision(state: GameState, orden: number): Team[] {
  return state.teams.filter((t) => t.divisionOrden === orden);
}

// Player-owned teams adhered via negotiation but not yet placed in a division.
export function pendingIntegrationTeams(state: GameState): Team[] {
  return state.teams.filter(
    (t) => t.federationId === state.playerFederationId && t.divisionOrden === null,
  );
}

// Balanced group sizes: every group within 1 of the others, larger first.
function groupSizes(total: number, groups: number): number[] {
  const base = Math.floor(total / groups);
  const rem = total % groups;
  return Array.from({ length: groups }, (_, i) => base + (i < rem ? 1 : 0));
}

function rankByMiniLeague(teams: Team[], state: GameState): number[] {
  const fixtures = generateFixtures(
    teams.map((t) => t.id),
    state.rng,
  );
  const byId = new Map(teams.map((t) => [t.id, t]));
  const results: MatchResult[] = fixtures.map((fx) => {
    const { homeGoals, awayGoals } = simulateMatch(
      byId.get(fx.homeId)!,
      byId.get(fx.awayId)!,
      state.rng,
    );
    return { ...fx, homeGoals, awayGoals };
  });
  return computeStandings(teams, results).map((r) => r.teamId);
}

// Hold a leveling league among all player-owned teams (currently competing +
// pending) and redistribute them across divisions by merit (§4.4). Pretemporada
// only: startSeason will then build the calendar over the new structure.
export function runLevelingLeague(prev: GameState): GameState {
  if (prev.phase !== 'pretemporada') return prev;
  const pool = prev.teams.filter((t) => t.federationId === prev.playerFederationId);
  if (pool.length < 2) return prev;

  const s = structuredClone(prev);
  const poolNow = s.teams.filter((t) => t.federationId === s.playerFederationId);
  const ranked = rankByMiniLeague(poolNow, s);

  const nDiv = Math.max(1, Math.ceil(ranked.length / MAX_DIVISION_SIZE));
  const sizes = groupSizes(ranked.length, nDiv);

  const ordenById = new Map<number, number>();
  let cursor = 0;
  for (let d = 0; d < nDiv; d++) {
    for (let k = 0; k < sizes[d]; k++) {
      ordenById.set(ranked[cursor++], d + 1);
    }
  }
  for (const t of s.teams) {
    const orden = ordenById.get(t.id);
    if (orden !== undefined) t.divisionOrden = orden;
  }
  s.divisions = Array.from({ length: nDiv }, (_, i) => ({
    orden: i + 1,
    name: divisionName(i + 1),
  }));
  return s;
}
