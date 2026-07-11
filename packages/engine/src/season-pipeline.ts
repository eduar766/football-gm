// Season-close pipeline (Fase 15 R1). closeSeason used to be a ~300-line
// monolith with an implicit ordering; it is now an ordered list of small
// steps executed by ascending priority. Adding a season-close system means
// pushing one step into the array with a free priority slot — zero edits to
// the existing steps. The extraction was literal: each step's body is the
// exact code block it replaced, in the original order, so the golden master
// is unchanged by this refactor.

import type { GameState } from './types';
import type { StandingRow } from './standings';

export interface SeasonCloseContext {
  // Final table per player-federation division, computed once (step
  // `final-standings`) before promotion/relegation mutates divisionOrden.
  standingsByOrden: Map<number, StandingRow[]>;
  // Competitive balance index (0-100) per division, computed alongside
  // standingsByOrden (Fase 15B) — read by the prestige/arraigo hooks and
  // stored in the season's history entry.
  balanceIndexByOrden: Map<number, number>;
  // Top-flight (division 1) table — feeds the prestige delta and the chronicle.
  topFlightTable: StandingRow[];
  // Season prestige delta: accumulated by the early steps, applied by
  // `apply-prestige`, and read-only afterwards (history, board confidence).
  prestigeDelta: number;
  // Prestige value before `apply-prestige` ran — history entries record both.
  prestigeBefore: number;
  // League-quality bump published by processEconomy, consumed after the
  // squad-based strength recompute.
  talentBump: number;
  // Ad-hoc keys published by one step and consumed by a later one without
  // coupling their types (metadata-bag pattern). Prefer the typed fields
  // above; use this only for one-off handshakes.
  meta: Map<string, unknown>;
}

export interface CloseSeasonStep {
  name: string;
  // Ascending execution order. Priorities are spaced (10, 20, 30…) so a new
  // step can be inserted between two existing ones without renumbering.
  priority: number;
  // Mutates `s` in place — closeSeason has already cloned the state.
  run(s: GameState, ctx: SeasonCloseContext): void;
}

export function createCloseSeasonContext(): SeasonCloseContext {
  return {
    standingsByOrden: new Map(),
    balanceIndexByOrden: new Map(),
    topFlightTable: [],
    prestigeDelta: 0,
    prestigeBefore: 0,
    talentBump: 0,
    meta: new Map(),
  };
}

export function runCloseSeasonPipeline(
  steps: readonly CloseSeasonStep[],
  s: GameState,
  ctx: SeasonCloseContext,
): void {
  const ordered = [...steps].sort((a, b) => a.priority - b.priority);
  for (const step of ordered) step.run(s, ctx);
}
