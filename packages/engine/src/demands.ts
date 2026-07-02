// Fase 14.5: club requests to the commissioner. Rescue is no longer a free
// commissioner action — a club in crisis *asks* for it. Ignoring any request
// erodes arraigo (loyalty); chronic low arraigo makes a club leave the
// federation (exodus). Pure functions; the random pieces use eventsRng so the
// match engine (state.rng) stays golden-stable. Everything here is gated on
// players.length > 0 so engine-only tests (golden) never see demands.

import { rngNext } from './rng';
import { pushMail, markMailByRef } from './mailbox';
import { logFederation } from './federation-log';
import type { ClubDemand, GameState, Team } from './types';

// Tunables — kept together so playtesting can adjust them fast.
export const RESCATE_THRESHOLD = -2_000_000;        // club treasury below this → begs for rescue
export const DEMAND_DEADLINE_MATCHDAYS = 3;         // matchdays to respond before it expires
export const PENALIZACION_IGNORAR = 12;             // arraigo lost when a request is ignored/rejected
export const REWARD_ARRAIGO = 6;                    // arraigo gained when a request is satisfied
export const UMBRAL_FUGA = 10;                      // arraigo at/below which a club is at risk
export const EXODUS_SEASONS = 2;                    // consecutive low-arraigo closes before leaving
export const INVERSION_DEMAND_PROB = 0.05;          // per-matchday chance of a stadium-investment ask
export const ESTADIO_UPGRADE = 5_000;               // capacity added when a stadium ask is granted
export const INVERSION_COST = 4_000_000;            // € a stadium ask costs the federation

function playerTeams(s: GameState): Team[] {
  return s.teams.filter(
    (t) => t.federationId === s.playerFederationId && t.divisionOrden !== null,
  );
}

function openDemandFor(s: GameState, teamId: number): ClubDemand | undefined {
  return s.clubDemands.find((d) => d.teamId === teamId && !d.resolved);
}

function pushDemand(s: GameState, demand: ClubDemand, team: Team, body: string): void {
  s.clubDemands.push(demand);
  pushMail(s, {
    year: s.year,
    matchday: demand.createdMatchday,
    category: 'peticion',
    title:
      demand.type === 'rescate'
        ? `${team.name} pide un rescate económico`
        : `${team.name} pide inversión en su estadio`,
    body,
    actionKind: demand.type === 'rescate' ? 'rescue_request' : 'demand',
    refId: demand.id,
    teamId: team.id,
    deadlineMatchday: demand.deadlineMatchday,
    createdAtMatchday: demand.createdMatchday,
  });
}

// Called each advanceMatchday after the match sim. Creates requests; no-op with
// no players (keeps golden numerics stable).
export function generateClubDemands(s: GameState, matchday: number): void {
  if (s.players.length === 0) return;
  if (!s.clubDemands) s.clubDemands = [];
  const deadline = matchday + DEMAND_DEADLINE_MATCHDAYS;

  // 1. Deterministic rescue requests from clubs in the red.
  for (const t of playerTeams(s)) {
    if (t.treasury < RESCATE_THRESHOLD && !openDemandFor(s, t.id)) {
      const amount = Math.max(1_000_000, -t.treasury);
      pushDemand(
        s,
        {
          id: s.nextDemandId++,
          teamId: t.id,
          type: 'rescate',
          year: s.year,
          createdMatchday: matchday,
          deadlineMatchday: deadline,
          amount,
          resolved: false,
          satisfied: null,
        },
        t,
        `${t.name} atraviesa una crisis de tesorería (${t.treasury.toLocaleString('es-ES')} €) y solicita una inyección de ${amount.toLocaleString('es-ES')} €. Si no respondes antes de la jornada ${deadline}, su arraigo caerá.`,
      );
    }
  }

  // 2. One optional stadium-investment request from a healthy club.
  // Uses the dedicated demandsRng so it never perturbs events/match streams.
  if (rngNext(s.demandsRng) < INVERSION_DEMAND_PROB) {
    const eligible = playerTeams(s).filter(
      (t) => t.treasury >= 0 && !openDemandFor(s, t.id),
    );
    if (eligible.length > 0) {
      const t = eligible[Math.floor(rngNext(s.demandsRng) * eligible.length)];
      pushDemand(
        s,
        {
          id: s.nextDemandId++,
          teamId: t.id,
          type: 'inversion_estadio',
          year: s.year,
          createdMatchday: matchday,
          deadlineMatchday: deadline,
          amount: INVERSION_COST,
          resolved: false,
          satisfied: null,
        },
        t,
        `${t.name} quiere ampliar su estadio y pide ${INVERSION_COST.toLocaleString('es-ES')} € de apoyo. Atenderlo sube su arraigo; ignorarlo lo baja.`,
      );
    }
  }
}

function ignoreDemand(s: GameState, demand: ClubDemand): void {
  demand.resolved = true;
  demand.satisfied = false;
  const team = s.teams.find((t) => t.id === demand.teamId);
  if (team) team.arraigo = Math.max(0, team.arraigo - PENALIZACION_IGNORAR);
  markMailByRef(s, demand.type === 'rescate' ? 'rescue_request' : 'demand', demand.id, 'caducado');
  pushMail(s, {
    year: s.year,
    matchday: demand.createdMatchday,
    category: 'aviso',
    title: `${team?.name ?? 'Un club'} se siente ignorado`,
    body: `No atendiste su petición a tiempo. Su arraigo cae ${PENALIZACION_IGNORAR} puntos${team ? ` (ahora ${team.arraigo})` : ''}.`,
    actionKind: null,
    refId: demand.id,
    teamId: demand.teamId,
    deadlineMatchday: null,
    createdAtMatchday: demand.createdMatchday,
  });
}

// Expire overdue, unresolved requests. `seasonEnd` forces expiry regardless of
// matchday (the season is closing). Applies the arraigo penalty. In-place.
export function expireDemands(s: GameState, currentMatchday: number, seasonEnd = false): void {
  if (!s.clubDemands) return;
  for (const d of s.clubDemands) {
    if (d.resolved) continue;
    if (seasonEnd || currentMatchday >= d.deadlineMatchday) ignoreDemand(s, d);
  }
}

// Mark the rescue request of a team satisfied — used by the existing rescueTeam
// action so a manual rescue also closes the club's open request. In-place.
export function satisfyRescueDemand(s: GameState, teamId: number): void {
  const demand = s.clubDemands?.find(
    (d) => d.teamId === teamId && d.type === 'rescate' && !d.resolved,
  );
  if (!demand) return;
  demand.resolved = true;
  demand.satisfied = true;
  const team = s.teams.find((t) => t.id === teamId);
  if (team) team.arraigo = Math.min(100, team.arraigo + REWARD_ARRAIGO);
  markMailByRef(s, 'rescue_request', demand.id, 'resuelto');
}

// Attend or reject a club request from the inbox.
export function resolveDemand(
  prev: GameState,
  demandId: number,
  accept: boolean,
  amount?: number,
): GameState {
  const existing = prev.clubDemands?.find((d) => d.id === demandId && !d.resolved);
  if (!existing) return prev;

  const s = structuredClone(prev);
  const demand = s.clubDemands.find((d) => d.id === demandId)!;
  const team = s.teams.find((t) => t.id === demand.teamId);
  if (!team) return prev;

  if (!accept) {
    ignoreDemand(s, demand);
    return s;
  }

  if (demand.type === 'rescate') {
    const inject = Math.max(0, Math.round(amount ?? demand.amount ?? 0));
    if (inject === 0 || s.treasury < inject) return prev; // can't afford
    s.treasury -= inject;
    team.treasury += inject;
    s.rescueLog.push({ year: s.year, teamId: team.id, teamName: team.name, amount: inject });
    logFederation(s, {
      year: s.year, matchday: demand.createdMatchday, type: 'rescue',
      title: 'Rescate concedido', detail: `Atendiste la petición de ${team.name}: ${inject.toLocaleString('es-ES')} €`,
      value: inject, teamId: team.id,
    });
  } else {
    const cost = Math.max(0, Math.round(amount ?? demand.amount ?? INVERSION_COST));
    if (s.treasury < cost) return prev;
    s.treasury -= cost;
    team.stadiumCapacity += ESTADIO_UPGRADE;
    logFederation(s, {
      year: s.year, matchday: demand.createdMatchday, type: 'sponsor_signed',
      title: 'Inversión en estadio', detail: `Ampliaste el estadio de ${team.name} (+${ESTADIO_UPGRADE.toLocaleString('es-ES')} aforo)`,
      value: cost, teamId: team.id,
    });
  }

  demand.resolved = true;
  demand.satisfied = true;
  team.arraigo = Math.min(100, team.arraigo + REWARD_ARRAIGO);
  markMailByRef(s, demand.type === 'rescate' ? 'rescue_request' : 'demand', demand.id, 'resuelto');
  pushMail(s, {
    year: s.year, matchday: demand.createdMatchday, category: 'aviso',
    title: `${team.name} agradece tu apoyo`,
    body: `Atendiste su petición. Su arraigo sube ${REWARD_ARRAIGO} puntos (ahora ${team.arraigo}).`,
    actionKind: null, refId: demand.id, teamId: team.id,
    deadlineMatchday: null, createdAtMatchday: demand.createdMatchday,
  });
  return s;
}

// Called at closeSeason after the arraigo decay. Clubs stuck at/under the
// threshold for EXODUS_SEASONS consecutive closes leave for a rival federation
// (nothing is deleted — only federationId + divisionOrden change). In-place.
export function processExodus(s: GameState): void {
  if (s.players.length === 0) return;
  if (!s.lowArraigoSeasons) s.lowArraigoSeasons = {};

  const rivals = s.federations.filter((f) => !f.isPlayer);
  if (rivals.length === 0) return; // nowhere to go — keep the club

  // Highest-prestige rival poaches the disaffected club.
  const poacher = [...rivals].sort((a, b) => b.prestige - a.prestige)[0];

  for (const t of s.teams.filter((t) => t.federationId === s.playerFederationId && t.divisionOrden !== null)) {
    if (t.arraigo <= UMBRAL_FUGA) {
      s.lowArraigoSeasons[t.id] = (s.lowArraigoSeasons[t.id] ?? 0) + 1;
    } else {
      s.lowArraigoSeasons[t.id] = 0;
    }

    if ((s.lowArraigoSeasons[t.id] ?? 0) >= EXODUS_SEASONS) {
      t.federationId = poacher.id;
      t.divisionOrden = null;
      t.arraigo = 40; // fresh (low) loyalty in the new home
      s.lowArraigoSeasons[t.id] = 0;
      logFederation(s, {
        year: s.year, matchday: 0, type: 'team_left',
        title: 'Un club abandona la federación',
        detail: `${t.name} se marcha a ${poacher.name} por falta de arraigo`,
        value: null, teamId: t.id,
      });
      pushMail(s, {
        year: s.year, matchday: 0, category: 'aviso',
        title: `${t.name} abandona la federación`,
        body: `Harto de no ser atendido, ${t.name} se une a ${poacher.name}. Pierdes el club.`,
        actionKind: null, refId: t.id, teamId: t.id,
        deadlineMatchday: null, createdAtMatchday: 0,
      });
    }
  }
}
