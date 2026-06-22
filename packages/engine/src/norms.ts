// Norms & sanctions (§4.7). The commissioner defines rules; autonomous teams
// may breach them; the commissioner sanctions offenders. Pure; deterministic;
// no state.rng — keeps the match engine golden-stable.

import { wageBill } from './salaries';
import type { StandingRow } from './standings';
import type { GameState, Norm, NormBreach, NormType, Player, Team } from './types';

export const SANCTION_POINTS = 3;
const GOVERNANCE_CAP = 5;
const MAX_SALARY_CAP = 200_000_000;

function isSubject(state: GameState, t: Team): boolean {
  return t.divisionOrden !== null && t.federationId === state.playerFederationId;
}

// What the norm cares about for a given team. For strength-based norms it's
// team.strength (1-100); for the wage cap it's the team's annual wage bill.
// For count norms it's the count of matching players in the squad.
function valorActual(team: Team, norm: Norm, players: Player[]): number {
  const squad = players.filter((p) => p.teamId === team.id);
  switch (norm.tipo) {
    case 'tope_salarial':
      return wageBill(team.id, players);
    case 'tope_extrangeros':
      return squad.filter((p) => p.nationality !== 'local').length;
    case 'minimo_cantera':
      return squad.filter((p) => p.cantera).length;
    case 'tope_edad_media':
      return squad.length > 0
        ? Math.round(squad.reduce((a, p) => a + p.age, 0) / squad.length)
        : 0;
    default:
      return team.strength;
  }
}

function breaches(team: Team, norm: Norm, players: Player[]): boolean {
  const actual = valorActual(team, norm, players);
  switch (norm.tipo) {
    case 'tope_plantilla':
      return actual > norm.valor;      // too strong
    case 'minimo_competitivo':
      return actual < norm.valor;      // too weak
    case 'tope_salarial':
      return actual > norm.valor;      // too expensive
    case 'tope_extrangeros':
      return actual > norm.valor;      // too many foreigners
    case 'minimo_cantera':
      return actual < norm.valor;      // too few homegrown
    case 'tope_edad_media':
      return actual > norm.valor;      // squad too old
    default:
      return false;
  }
}

function isSanctioned(
  state: GameState,
  teamId: number,
  normId: number,
  year: number,
): boolean {
  return state.sanctions.some(
    (s) => s.teamId === teamId && s.normId === normId && s.appliesToYear === year,
  );
}

export function normBreaches(state: GameState): NormBreach[] {
  const out: NormBreach[] = [];
  for (const norm of state.norms) {
    for (const team of state.teams) {
      if (!isSubject(state, team)) continue;
      if (!breaches(team, norm, state.players)) continue;
      out.push({
        teamId: team.id,
        teamName: team.name,
        normId: norm.id,
        tipo: norm.tipo,
        valor: norm.valor,
        valorActual: valorActual(team, norm, state.players),
        sanctioned: isSanctioned(state, team.id, norm.id, state.year),
      });
    }
  }
  return out;
}

export function addNorm(
  prev: GameState,
  tipo: NormType,
  valor: number,
): GameState {
  // Clamp per norm type: salary cap uses large € values; count norms use
  // small integers; strength norms use 1-100; age uses 16-40.
  let v: number;
  if (tipo === 'tope_salarial') {
    v = Math.max(0, Math.min(MAX_SALARY_CAP, Math.round(valor)));
  } else if (tipo === 'tope_edad_media') {
    v = Math.max(16, Math.min(40, Math.round(valor)));
  } else if (tipo === 'tope_extrangeros' || tipo === 'minimo_cantera') {
    v = Math.max(1, Math.min(25, Math.round(valor)));
  } else {
    v = Math.max(1, Math.min(100, Math.round(valor)));
  }
  const s = structuredClone(prev);
  // At most one active norm per type — adding replaces.
  s.norms = s.norms.filter((n) => n.tipo !== tipo);
  s.norms.push({ id: s.nextNormId, tipo, valor: v });
  s.nextNormId += 1;
  return s;
}

export function removeNorm(prev: GameState, normId: number): GameState {
  if (!prev.norms.some((n) => n.id === normId)) return prev;
  const s = structuredClone(prev);
  s.norms = s.norms.filter((n) => n.id !== normId);
  return s;
}

export function sanctionTeam(
  prev: GameState,
  teamId: number,
  normId: number,
): GameState {
  const norm = prev.norms.find((n) => n.id === normId);
  const team = prev.teams.find((t) => t.id === teamId);
  if (!norm || !team) return prev;
  if (!isSubject(prev, team) || !breaches(team, norm, prev.players)) return prev;
  if (isSanctioned(prev, teamId, normId, prev.year)) return prev;

  const s = structuredClone(prev);
  const actual = valorActual(team, norm, prev.players);
  const prevCount = s.violationHistory[teamId]?.[normId] ?? 0;
  const escalatedPoints = prevCount >= 2 ? 8 : prevCount === 1 ? 5 : SANCTION_POINTS;
  const motivo =
    norm.tipo === 'tope_plantilla'
      ? `Supera el tope de plantilla (${actual} > ${norm.valor})`
      : norm.tipo === 'minimo_competitivo'
        ? `No alcanza el mínimo competitivo (${actual} < ${norm.valor})`
        : norm.tipo === 'tope_extrangeros'
          ? `Supera el tope de extranjeros (${actual} > ${norm.valor})`
          : norm.tipo === 'minimo_cantera'
            ? `No alcanza el mínimo de cantera (${actual} < ${norm.valor})`
            : norm.tipo === 'tope_edad_media'
              ? `Supera el tope de edad media (${actual} > ${norm.valor})`
              : `Supera el tope salarial (${actual.toLocaleString('es-ES')} € > ${norm.valor.toLocaleString('es-ES')} €)`;
  s.sanctions.push({
    id: s.nextSanctionId,
    teamId,
    normId,
    year: s.year,
    appliesToYear: s.year,
    motivo,
    castigo: `−${escalatedPoints} puntos`,
    pointsPenalty: escalatedPoints,
  });
  s.nextSanctionId += 1;
  if (!s.violationHistory[teamId]) s.violationHistory[teamId] = {};
  s.violationHistory[teamId][normId] = prevCount + 1;
  return s;
}

export function pointPenaltiesForYear(
  state: GameState,
  year: number,
): Map<number, number> {
  const map = new Map<number, number>();
  for (const sanction of state.sanctions) {
    if (sanction.appliesToYear !== year) continue;
    map.set(
      sanction.teamId,
      (map.get(sanction.teamId) ?? 0) + sanction.pointsPenalty,
    );
  }
  return map;
}

// Subtract sanction points and re-sort with the same tiebreakers as
// computeStandings (points, goal diff, goals for, name).
export function applyPointPenalties(
  rows: StandingRow[],
  penalties: Map<number, number>,
): StandingRow[] {
  if (penalties.size === 0) return rows;
  return rows
    .map((r) => {
      const pen = penalties.get(r.teamId) ?? 0;
      return pen > 0 ? { ...r, points: Math.max(0, r.points - pen) } : r;
    })
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.goalDiff - a.goalDiff ||
        b.goalsFor - a.goalsFor ||
        a.name.localeCompare(b.name),
    );
}

// Letting teams flout the rules unchecked erodes the league's credibility:
// every unsanctioned breach at season close costs prestige (capped).
export function governancePenalty(state: GameState): number {
  let unsanctioned = 0;
  for (const norm of state.norms) {
    for (const team of state.teams) {
      if (!isSubject(state, team)) continue;
      if (!breaches(team, norm, state.players)) continue;
      if (!isSanctioned(state, team.id, norm.id, state.year)) unsanctioned++;
    }
  }
  return unsanctioned > 0 ? -Math.min(GOVERNANCE_CAP, unsanctioned) : 0;
}

export function decayViolationHistory(s: GameState): void {
  const penalizedThisYear = new Set(
    s.sanctions.filter(san => san.year === s.year).map(san => san.teamId),
  );
  for (const teamId of Object.keys(s.violationHistory).map(Number)) {
    if (penalizedThisYear.has(teamId)) continue;
    for (const normId of Object.keys(s.violationHistory[teamId]).map(Number)) {
      const count = s.violationHistory[teamId][normId];
      if (count > 0) {
        s.violationHistory[teamId][normId] = Math.max(0, count - 1);
      }
    }
  }
}
