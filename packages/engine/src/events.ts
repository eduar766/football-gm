// Season events / polémicas (§1, §2): rare incidents the commissioner resolves.
// Spawn uses an INDEPENDENT rng (state.eventsRng) so the match-engine stream
// stays golden-stable. Default tests don't act on events; spawned events
// accumulate deterministically without changing simulation outcomes.

import { rngNext, type RngState } from './rng';
import type {
  EventAction,
  EventType,
  GameEvent,
  GameState,
} from './types';

export const EVENT_SPAWN_PROB = 0.04;
const INVESTIGATION_COST = 1_000_000;
const ARRAIGO_ACT_HIT = 3;
const ARRAIGO_IGNORE_BONUS = 1;
const PRESTIGE_IGNORE_HIT = 1;
const PRESTIGE_CADUCO_HIT = 2;

const TYPES: EventType[] = [
  'arbitraje_dudoso',
  'incidente_aficion',
  'declaraciones_polemicas',
];

function competingPlayerTeamIds(state: GameState): number[] {
  return state.teams
    .filter(
      (t) =>
        t.divisionOrden !== null &&
        t.federationId === state.playerFederationId,
    )
    .map((t) => t.id);
}

function pickType(rng: RngState): EventType {
  return TYPES[Math.floor(rngNext(rng) * TYPES.length)] ?? TYPES[0];
}

function pickTeamId(rng: RngState, ids: number[]): number | null {
  if (ids.length === 0) return null;
  return ids[Math.floor(rngNext(rng) * ids.length)];
}

function buildMessage(tipo: EventType, teamName: string | null): string {
  const club = teamName ?? 'la liga';
  switch (tipo) {
    case 'arbitraje_dudoso':
      return `Polémica arbitral en un partido de ${club}: la prensa pide investigación.`;
    case 'incidente_aficion':
      return `Incidentes de aficionados de ${club}: hay denuncias formales.`;
    case 'declaraciones_polemicas':
      return `${club} hace unas declaraciones polémicas contra la federación.`;
  }
}

// Spawn at most one event for this matchday (gated by EVENT_SPAWN_PROB).
// Mutates the already-cloned state. Uses eventsRng — no state.rng usage.
// No-op when there are no players in state: events are a real-game layer
// (engine-only default tests never see them, keeping golden numerics stable).
export function maybeSpawnEvent(s: GameState, matchday: number): void {
  if (s.players.length === 0) return;
  if (rngNext(s.eventsRng) >= EVENT_SPAWN_PROB) return;
  const tipo = pickType(s.eventsRng);
  const teamId = pickTeamId(s.eventsRng, competingPlayerTeamIds(s));
  const teamName = s.teams.find((t) => t.id === teamId)?.name ?? null;
  s.events.push({
    id: s.nextEventId++,
    year: s.year,
    matchday,
    tipo,
    status: 'pendiente',
    teamId,
    message: buildMessage(tipo, teamName),
    resolvedAction: null,
  });
}

function mirrorPlayerPrestige(s: GameState): void {
  const pf = s.federations.find((f) => f.id === s.playerFederationId);
  if (pf) pf.prestige = s.prestige;
}

export function resolveEvent(
  prev: GameState,
  eventId: number,
  action: EventAction,
): GameState {
  const ev = prev.events.find((e) => e.id === eventId);
  if (!ev || ev.status !== 'pendiente') return prev;
  const s = structuredClone(prev);
  const event = s.events.find((e) => e.id === eventId)!;
  const team = event.teamId
    ? s.teams.find((t) => t.id === event.teamId)
    : undefined;

  if (action === 'actuar') {
    s.treasury -= INVESTIGATION_COST;
    if (team) team.arraigo = Math.max(0, team.arraigo - ARRAIGO_ACT_HIT);
    event.status = 'resuelto_actuar';
  } else {
    s.prestige = Math.max(0, s.prestige - PRESTIGE_IGNORE_HIT);
    mirrorPlayerPrestige(s);
    if (team) team.arraigo = Math.min(100, team.arraigo + ARRAIGO_IGNORE_BONUS);
    event.status = 'resuelto_ignorar';
  }
  event.resolvedAction = action;
  return s;
}

// At season close, any event still pending from the closed year expires —
// letting it rot costs more prestige than ignoring it deliberately.
export function expireStaleEvents(s: GameState, closedYear: number): void {
  let penalty = 0;
  for (const ev of s.events) {
    if (ev.status === 'pendiente' && ev.year <= closedYear) {
      ev.status = 'caducado';
      penalty += PRESTIGE_CADUCO_HIT;
    }
  }
  if (penalty > 0) {
    s.prestige = Math.max(0, s.prestige - penalty);
    mirrorPlayerPrestige(s);
  }
}

export function pendingEvents(state: GameState): GameEvent[] {
  return state.events.filter((e) => e.status === 'pendiente');
}
