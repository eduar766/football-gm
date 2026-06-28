// Season events / polémicas (§1, §2): rare incidents the commissioner resolves.
// Spawn uses an INDEPENDENT rng (state.eventsRng) so the match-engine stream
// stays golden-stable. Default tests don't act on events; spawned events
// accumulate deterministically without changing simulation outcomes.

import { rngNext, type RngState } from './rng';
import type {
  EventAction,
  EventSeverity,
  EventType,
  GameEvent,
  GameState,
} from './types';

export const EVENT_SPAWN_PROB = 0.04;
const INVESTIGATION_COST = 1_000_000;
const ARRAIGO_ACT_HIT = 3;
const ARRAIGO_IGNORE_BONUS = 1;
const PRESTIGE_CADUCO_HIT = 2;

const TYPES: EventType[] = [
  'arbitraje_dudoso',
  'incidente_aficion',
  'declaraciones_polemicas',
  'doping_positivo',
  'conflicto_jugadores',
  'crisis_economica_club',
  'escandalo_directiva',
  'manipulacion_resultados',
];

const SEVERITY_MAP: Record<EventType, EventSeverity> = {
  arbitraje_dudoso: 'media',
  incidente_aficion: 'media',
  declaraciones_polemicas: 'baja',
  doping_positivo: 'alta',
  conflicto_jugadores: 'media',
  crisis_economica_club: 'alta',
  escandalo_directiva: 'alta',
  manipulacion_resultados: 'alta',
};

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
    case 'doping_positivo':
      return `Resultado positivo de doping en un jugador de ${club}: escándalo mediático.`;
    case 'conflicto_jugadores':
      return `Conflicto interno entre jugadores de ${club}: vestuario desestabilizado.`;
    case 'crisis_economica_club':
      return `${club} atraviesa una grave crisis económica: posible insolvencia.`;
    case 'escandalo_directiva':
      return `Escándalo en la directiva de ${club}: presuntas irregularidades financieras.`;
    case 'manipulacion_resultados':
      return `Investigación por posible manipulación de resultados en ${club}.`;
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
    severity: SEVERITY_MAP[tipo],
    chainedFromId: null,
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

    // Type-specific mechanical consequences.
    switch (event.tipo) {
      case 'arbitraje_dudoso':
        // Lose 1 impulse (political capital consumed by investigation).
        s.eventImpulseLoss += 1;
        s.impulsesRemaining = Math.max(0, s.impulsesRemaining - 1);
        break;
      case 'incidente_aficion':
        // Stadium capacity reduced 10% for this season.
        s.eventCapacityPenaltyPct = Math.min(0.5, s.eventCapacityPenaltyPct + 0.1);
        break;
      case 'declaraciones_polemicas':
        // Fine for reckless statements.
        s.prestige = Math.max(0, s.prestige - 1);
        mirrorPlayerPrestige(s);
        break;
      case 'doping_positivo':
        // Team loses 10 strength for the season (player suspension + media pressure).
        if (team) team.strength = Math.max(35, team.strength - 10);
        break;
      case 'conflicto_jugadores':
        // Team loses 5 strength (locker room disruption).
        if (team) team.strength = Math.max(35, team.strength - 5);
        break;
      case 'crisis_economica_club':
        // Federation bails out the club: 5M€ cost, club remains stable.
        // Previously gave +3M€ (wrong direction — was a free exploit).
        s.treasury -= 5_000_000;
        break;
      case 'escandalo_directiva':
        // Lose 2 impulses (crisis of confidence).
        s.eventImpulseLoss += 2;
        s.impulsesRemaining = Math.max(0, s.impulsesRemaining - 2);
        break;
      case 'manipulacion_resultados':
        // Demote team one division (existing behavior).
        if (team && team.divisionOrden !== null) {
          team.divisionOrden += 1;
        }
        break;
    }

    event.status = 'resuelto_actuar';
  } else {
    const ignorePrestigeCost = event.severity === 'alta' ? 4 : event.severity === 'media' ? 2 : 1;
    s.prestige = Math.max(0, s.prestige - ignorePrestigeCost);
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
      if (ev.severity === 'alta') penalty += 2;
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
