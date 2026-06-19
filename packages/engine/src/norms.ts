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
function valorActual(team: Team, norm: Norm, players: Player[]): number {
  return norm.tipo === 'tope_salarial' ? wageBill(team.id, players) : team.strength;
}

function breaches(team: Team, norm: Norm, players: Player[]): boolean {
  const actual = valorActual(team, norm, players);
  if (norm.tipo === 'tope_plantilla') return actual > norm.valor;
  if (norm.tipo === 'minimo_competitivo') return actual < norm.valor;
  if (norm.tipo === 'tope_salarial') return actual > norm.valor;
  return false;
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
  // Salary cap is denominated in € (large integers); strength-based norms
  // live in 1-100. Clamp accordingly so each norm's UI input range stays
  // meaningful in its own units.
  const v =
    tipo === 'tope_salarial'
      ? Math.max(0, Math.min(MAX_SALARY_CAP, Math.round(valor)))
      : Math.max(1, Math.min(100, Math.round(valor)));
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
  const motivo =
    norm.tipo === 'tope_plantilla'
      ? `Supera el tope de plantilla (${actual} > ${norm.valor})`
      : norm.tipo === 'minimo_competitivo'
        ? `No alcanza el mínimo competitivo (${actual} < ${norm.valor})`
        : `Supera el tope salarial (${actual.toLocaleString('es-ES')} € > ${norm.valor.toLocaleString('es-ES')} €)`;
  s.sanctions.push({
    id: s.nextSanctionId,
    teamId,
    normId,
    year: s.year,
    appliesToYear: s.year,
    motivo,
    castigo: `−${SANCTION_POINTS} puntos`,
    pointsPenalty: SANCTION_POINTS,
  });
  s.nextSanctionId += 1;
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
