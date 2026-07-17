// League structure (§4.4): divisions, and the leveling league that decides
// which teams land in which division. Pure functions over GameState.

import { generateFixtures } from './fixtures';
import { simulateMatch } from './match';
import { computeStandings } from './standings';
import type { GameState, LevelingPlan, MatchResult, Team } from './types';

export const MAX_DIVISION_SIZE = 12;
export const PROMOTION_RELEGATION = 2;
export const MAX_LEVELING_DIVISIONS = 3;

// Change how the league is contested (§4.4). Structural decision — only valid
// in pretemporada; startSeason will use this flag when building the calendar.
// Lives here (not engine.ts) so assembly.ts can dispatch 'cambio_formato'
// proposals to it without a circular import (engine.ts calls into assembly.ts
// to resolve pending proposals).
export function setLeagueFormat(
  prev: GameState,
  format: GameState['leagueFormat'],
): GameState {
  if (prev.phase !== 'pretemporada') return prev;
  if (prev.leagueFormat === format) return prev;
  const s = structuredClone(prev);
  s.leagueFormat = format;
  // 14.7: keep the global toggle and per-division formats in sync.
  for (const d of s.divisions) {
    if (d.federationId === s.playerFederationId) d.format = format;
  }
  return s;
}

// Validate a player-supplied leveling plan against the pool of player teams.
// Returns null when valid, or a human-readable reason when not.
export function validateLevelingPlan(plan: LevelingPlan, poolSize: number): string | null {
  const divs = plan.divisions;
  if (divs.length < 1) return 'El plan no tiene divisiones.';
  if (divs.length > MAX_LEVELING_DIVISIONS) return `Máximo ${MAX_LEVELING_DIVISIONS} divisiones.`;
  const sorted = [...divs].sort((a, b) => a.orden - b.orden);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].orden !== i + 1) return 'Los órdenes deben ser consecutivos empezando en 1.';
    if (sorted[i].size < 2) return 'Cada división necesita al menos 2 equipos.';
  }
  const total = divs.reduce((a, d) => a + d.size, 0);
  if (total !== poolSize) return `Los tamaños suman ${total}, pero hay ${poolSize} equipos.`;
  return null;
}

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

// Player-federation teams currently competing (in a division). Lives here
// (not engine.ts) so eras.ts and migrations.ts can both use it without a
// circular import — migrations.ts imports eras.ts for backfillEra, and
// engine.ts already imports CURRENT_SCHEMA_VERSION from migrations.ts.
export function playerLeagueTeamCount(s: GameState): number {
  return s.teams.filter(
    (t) => t.federationId === s.playerFederationId && t.divisionOrden !== null,
  ).length;
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
export function runLevelingLeague(prev: GameState, plan?: LevelingPlan): GameState {
  if (prev.phase !== 'pretemporada') return prev;
  const pool = prev.teams.filter((t) => t.federationId === prev.playerFederationId);
  if (pool.length < 2) return prev;

  // Fase 14.7: reject an invalid plan up front (engine convention: return prev).
  if (plan && validateLevelingPlan(plan, pool.length) !== null) return prev;

  const s = structuredClone(prev);
  const poolNow = s.teams.filter((t) => t.federationId === s.playerFederationId);
  const ranked = rankByMiniLeague(poolNow, s);

  // Division sizes + formats: from the player's plan, or the balanced default.
  let sizes: number[];
  let formats: (GameState['leagueFormat'] | undefined)[];
  let names: (string | undefined)[];
  if (plan) {
    const sorted = [...plan.divisions].sort((a, b) => a.orden - b.orden);
    sizes = sorted.map((d) => d.size);
    formats = sorted.map((d) => d.format);
    names = sorted.map((d) => d.name);
  } else {
    const nDiv = Math.max(1, Math.ceil(ranked.length / MAX_DIVISION_SIZE));
    sizes = groupSizes(ranked.length, nDiv);
    formats = sizes.map(() => s.leagueFormat);
    names = sizes.map(() => undefined);
  }

  const ordenById = new Map<number, number>();
  let cursor = 0;
  for (let d = 0; d < sizes.length; d++) {
    for (let k = 0; k < sizes[d]; k++) {
      ordenById.set(ranked[cursor++], d + 1);
    }
  }
  for (const t of s.teams) {
    const orden = ordenById.get(t.id);
    if (orden !== undefined) t.divisionOrden = orden;
  }
  // Rebuild ONLY the player's divisions; rival federations keep theirs (else the
  // rival simulation loses its divisions and stops running — see migration v12).
  const rivalDivisions = s.divisions.filter((d) => d.federationId !== s.playerFederationId);
  const playerDivisions = sizes.map((_, i) => ({
    orden: i + 1,
    name: names[i] ?? divisionName(i + 1),
    federationId: s.playerFederationId,
    format: formats[i] ?? s.leagueFormat,
  }));
  s.divisions = [...playerDivisions, ...rivalDivisions];
  return s;
}
