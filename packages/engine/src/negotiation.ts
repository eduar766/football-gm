// Negotiation & adhesion (design §4.2) plus the snowball brakes (§5). Pure:
// every exported mutator takes a state and returns a new one; the season-close
// progression mutates an already-cloned state.

import { rngNext } from './rng';
import type { Federation, GameState, Team } from './types';

// Prestige groups into 5 tiers; the tier is prelatory — it gates which teams a
// federation may even approach (§4.1).
export function tierOf(prestige: number): number {
  if (prestige >= 80) return 5;
  if (prestige >= 60) return 4;
  if (prestige >= 40) return 3;
  if (prestige >= 20) return 2;
  return 1;
}

function fedOf(state: GameState, id: number): Federation | undefined {
  return state.federations.find((f) => f.id === id);
}

export function teamTier(state: GameState, team: Team): number {
  const owner = fedOf(state, team.federationId);
  return owner ? tierOf(owner.prestige) : 1;
}

export function playerTier(state: GameState): number {
  const pf = fedOf(state, state.playerFederationId);
  return pf ? tierOf(pf.prestige) : 1;
}

function hasActiveNegotiation(state: GameState, teamId: number): boolean {
  return state.negotiations.some(
    (n) =>
      n.targetTeamId === teamId &&
      (n.state === 'gathering_requirements' ||
        n.state === 'offer' ||
        n.state === 'accepted'),
  );
}

export function canNegotiate(state: GameState, teamId: number): boolean {
  const t = state.teams.find((x) => x.id === teamId);
  if (!t) return false;
  if (t.federationId === state.playerFederationId) return false;
  if (hasActiveNegotiation(state, teamId)) return false;
  return teamTier(state, t) <= playerTier(state); // tier gate (§4.1)
}

// Teams the player may currently open a negotiation for. Pure selector for the
// "market" screen.
export function negotiableTeams(state: GameState): Team[] {
  const pt = playerTier(state);
  return state.teams.filter(
    (t) =>
      t.federationId !== state.playerFederationId &&
      teamTier(state, t) <= pt &&
      !hasActiveNegotiation(state, t.id),
  );
}

export function startNegotiation(prev: GameState, targetTeamId: number): GameState {
  if (!canNegotiate(prev, targetTeamId)) return prev;
  const team = prev.teams.find((t) => t.id === targetTeamId)!;
  const s = structuredClone(prev);

  // Requirements gathering takes 1-3 seasons; high arraigo (the late-game
  // brake, §5) and barely-reachable tier targets take longer.
  let seasons = 1;
  if (team.arraigo >= 60) seasons += 1;
  if (team.arraigo >= 80) seasons += 1;
  if (teamTier(prev, team) === playerTier(prev)) seasons += 1;

  s.negotiations.push({
    id: s.nextNegotiationId,
    targetTeamId,
    byFederationId: s.playerFederationId,
    fromFederationId: team.federationId,
    state: 'gathering_requirements',
    startedYear: s.year,
    requirementsSeasonsLeft: seasons,
    acceptedYear: null,
    effectiveYear: null,
  });
  s.nextNegotiationId += 1;
  return s;
}

export function rivalPoachAttempt(s: GameState, rivalFedId: number, targetTeamId: number): boolean {
  const rival = s.federations.find(f => f.id === rivalFedId);
  const target = s.teams.find(t => t.id === targetTeamId);
  if (!rival || !target) return false;
  if (target.federationId !== s.playerFederationId) return false;

  // Poach cooldown: cannot re-attempt same team for 2 seasons after failure.
  const cooldown = s.poachCooldowns[targetTeamId];
  if (cooldown && s.year < cooldown) return false;

  const rivalTier = tierOf(rival.prestige);
  const player = fedOf(s, s.playerFederationId);
  const playerPrestige = player?.prestige ?? 0;

  // Rival must be within 1 tier of the player
  if (rivalTier < tierOf(playerPrestige) - 1) return false;

  // Chance based on arraigo and prestige differential
  let chance = 0.15 - target.arraigo * 0.002 + (rival.prestige - playerPrestige) * 0.003;
  chance = Math.min(0.4, Math.max(0.05, chance));

  const success = rngNext(s.rng) < chance;
  if (!success) {
    // Set 2-season cooldown on failure.
    s.poachCooldowns[targetTeamId] = s.year + 2;
  }
  return success;
}

const PRESTIGE_TRANSFER_MAX = 8;
const WEAKENED_THRESHOLD = 15;

// One season of progression for every active negotiation, then reactive
// rivals. Mutates the (already-cloned) state. Called from
// closeAndStartNextSeason AFTER the year advances so timers see the new year.
export function progressNegotiations(s: GameState): void {
  for (const n of s.negotiations) {
    const team = s.teams.find((t) => t.id === n.targetTeamId);
    if (!team) continue;

    if (n.state === 'gathering_requirements') {
      n.requirementsSeasonsLeft -= 1;
      if (n.requirementsSeasonsLeft <= 0) n.state = 'offer';
      continue;
    }

    if (n.state === 'offer') {
      const by = fedOf(s, n.byFederationId);
      const from = fedOf(s, team.federationId);
      let chance =
        0.6 -
        team.arraigo * 0.005 +
        ((by?.prestige ?? 0) - (from?.prestige ?? 0)) * 0.004;
      chance = Math.min(0.95, Math.max(0.05, chance));
      if (rngNext(s.rng) < chance) {
        n.state = 'accepted';
        n.acceptedYear = s.year;
        n.effectiveYear = s.year + 2; // effective two years after acceptance
      } else {
        n.state = 'rejected';
      }
      continue;
    }

    if (n.state === 'accepted') {
      if (n.effectiveYear !== null && s.year >= n.effectiveYear) {
        const by = fedOf(s, n.byFederationId);
        const from = fedOf(s, team.federationId);
        const transfer = Math.min(
          PRESTIGE_TRANSFER_MAX,
          Math.max(1, Math.round(team.strength / 8)),
        );
        if (by) by.prestige += transfer;
        if (from) from.prestige = Math.max(0, from.prestige - transfer);
        team.federationId = n.byFederationId; // adhesion effective
        team.arraigo = 30; // fresh start: low loyalty in the new federation
        n.state = 'effective';
      }
      continue;
    }
  }

  // Reactive rivals (§5): a weakened federation digs in, raising the arraigo of
  // the teams it still owns so they are harder to poach.
  for (const fed of s.federations) {
    if (fed.isPlayer || fed.prestige >= WEAKENED_THRESHOLD) continue;
    for (const t of s.teams) {
      if (t.federationId === fed.id) t.arraigo = Math.min(100, t.arraigo + 3);
    }
  }

  const pf = fedOf(s, s.playerFederationId);
  if (pf) s.prestige = pf.prestige; // keep the mirror consistent
}
