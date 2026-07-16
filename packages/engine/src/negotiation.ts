// Negotiation & adhesion (design §4.2) plus the snowball brakes (§5). Pure:
// every exported mutator takes a state and returns a new one; the season-close
// progression mutates an already-cloned state.

import { rngNext } from './rng';
import { logFederation } from './federation-log';
import { addPresidentForTeam, removePresidentForTeam } from './characters';
import { spendPC } from './politics';
import type { Federation, GameState, Negotiation, NegotiationRequirement, Team } from './types';

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
  // Cooldown after rejection (§4.2 reintento)
  const cooldown = state.poachCooldowns[teamId];
  if (cooldown && state.year < cooldown) return false;
  return teamTier(state, t) <= playerTier(state); // tier gate (§4.1)
}

// Generate 1-3 requirements based on team arraigo. More demanding teams
// (high arraigo) want more assurances — revenue share and stadium quality.
function generateRequirements(state: GameState, team: Team): NegotiationRequirement[] {
  const reqs: NegotiationRequirement[] = [];
  const ownerFed = state.federations.find((f) => f.id === team.federationId);

  // Always: prestige parity — the team wants to join a federation that's at
  // least as strong as the one they're leaving.
  const prestigeObj = Math.max(10, (ownerFed?.prestige ?? 30) - 5);
  reqs.push({ tipo: 'prestigio', objetivo: prestigeObj, revealed: false, cumplido: false });

  // Medium+ arraigo: revenue share commitment.
  if (team.arraigo >= 40) {
    const repartoObj = Math.min(20, Math.max(5, Math.round(team.arraigo / 10)));
    reqs.push({ tipo: 'reparto', objetivo: repartoObj, revealed: false, cumplido: false });
  }

  // High arraigo: stadium infrastructure (max capacity in player league must exceed threshold).
  if (team.arraigo >= 70) {
    const playerTeams = state.teams.filter(
      (t) => t.federationId === state.playerFederationId && t.divisionOrden !== null,
    );
    const avgCap =
      playerTeams.length > 0
        ? playerTeams.reduce((s, t) => s + t.stadiumCapacity, 0) / playerTeams.length
        : 10_000;
    // Require average capacity ≥ 60% of the team's own capacity (achievable but not trivial).
    const estadioObj = Math.max(10_000, Math.round(team.stadiumCapacity * 0.6));
    // Only add if the player doesn't already meet it — otherwise it's trivial padding.
    if (avgCap < estadioObj) {
      reqs.push({ tipo: 'estadio', objetivo: estadioObj, revealed: false, cumplido: false });
    }
  }

  return reqs;
}

// Re-evaluate which requirements are currently satisfied. Called each season
// during gathering_requirements and once during offer evaluation.
function checkRequirements(s: GameState, n: Negotiation): void {
  const pf = s.federations.find((f) => f.id === s.playerFederationId);
  const playerPrestige = pf?.prestige ?? 0;
  const playerTeams = s.teams.filter(
    (t) => t.federationId === s.playerFederationId && t.divisionOrden !== null,
  );
  const avgCapacity =
    playerTeams.length > 0
      ? playerTeams.reduce((sum, t) => sum + t.stadiumCapacity, 0) / playerTeams.length
      : 0;

  for (const req of n.requirements) {
    if (!req.revealed) continue;
    switch (req.tipo) {
      case 'prestigio':
        req.cumplido = playerPrestige >= req.objetivo;
        break;
      case 'estadio':
        req.cumplido = avgCapacity >= req.objetivo;
        break;
      case 'reparto':
        req.cumplido = n.offerValue >= req.objetivo;
        break;
    }
  }
}

// Set the revenue-share offer value (0–30 %). Triggers a requirement re-check.
export function setNegotiationOfferValue(prev: GameState, negId: number, offerValue: number): GameState {
  const n = prev.negotiations.find(
    (n) => n.id === negId && (n.state === 'gathering_requirements' || n.state === 'offer'),
  );
  if (!n) return prev;
  const s = structuredClone(prev);
  const neg = s.negotiations.find((n) => n.id === negId)!;
  neg.offerValue = Math.min(30, Math.max(0, Math.round(offerValue)));
  checkRequirements(s, neg);
  return s;
}

const ACCELERATE_COST = 3;

// Fase 17B: spend political capital to reveal the next requirement
// immediately instead of waiting for the next season's progressNegotiations
// pass. Only during gathering_requirements, only the player's own
// negotiations, only while there's a requirement left to reveal.
export function accelerateNegotiation(prev: GameState, negId: number): GameState {
  const n = prev.negotiations.find((n) => n.id === negId);
  if (!n) return prev;
  if (n.byFederationId !== prev.playerFederationId) return prev;
  if (n.state !== 'gathering_requirements') return prev;
  if (n.revealedCount >= n.requirements.length) return prev;
  if (prev.politicalCapital < ACCELERATE_COST) return prev;

  const s = structuredClone(prev);
  const neg = s.negotiations.find((n) => n.id === negId)!;
  if (!spendPC(s, ACCELERATE_COST, `aceleró la negociación con ${teamNameOf(s, neg.targetTeamId)}`)) return prev;

  neg.requirements[neg.revealedCount].revealed = true;
  neg.revealedCount += 1;
  checkRequirements(s, neg);
  return s;
}

function teamNameOf(s: GameState, teamId: number): string {
  return s.teams.find((t) => t.id === teamId)?.name ?? 'un equipo';
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
    requirements: generateRequirements(prev, team),
    offerValue: 0,
    revealedCount: 0,
  });
  s.nextNegotiationId += 1;
  logFederation(s, {
    year: s.year,
    matchday: 0,
    type: 'negotiation_started',
    title: 'Negociación de adhesión iniciada',
    detail: `Comenzaste a negociar la incorporación de ${team.name}`,
    value: null,
    teamId: targetTeamId,
  });
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
      // Reveal one requirement per season so the player discovers them gradually.
      if (n.revealedCount < n.requirements.length) {
        n.requirements[n.revealedCount].revealed = true;
        n.revealedCount += 1;
      }
      // Re-check all revealed requirements each season.
      checkRequirements(s, n);
      n.requirementsSeasonsLeft -= 1;
      if (n.requirementsSeasonsLeft <= 0) n.state = 'offer';
      continue;
    }

    if (n.state === 'offer') {
      // Batch 3: acceptance driven by requirements, not a dice roll.
      checkRequirements(s, n);
      const revealed = n.requirements.filter((r) => r.revealed);
      const met = revealed.filter((r) => r.cumplido).length;
      // Threshold: ≥75% of revealed requirements must be met, OR no requirements.
      const meetsThreshold = revealed.length === 0 || met / revealed.length >= 0.75;
      if (meetsThreshold) {
        n.state = 'accepted';
        n.acceptedYear = s.year;
        n.effectiveYear = s.year + 2;
      } else {
        n.state = 'rejected';
        // 1-season cooldown before the player can retry this team.
        s.poachCooldowns[n.targetTeamId] = s.year + 1;
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
        const wasPlayerTeam = team.federationId === s.playerFederationId;
        team.federationId = n.byFederationId; // adhesion effective
        team.divisionOrden = null; // pending integration: leveling league will place them
        team.arraigo = 30; // fresh start: low loyalty in the new federation
        n.state = 'effective';
        if (n.byFederationId === s.playerFederationId) {
          addPresidentForTeam(s, team.id);
          logFederation(s, {
            year: s.year,
            matchday: 0,
            type: 'negotiation_effective',
            title: 'Equipo incorporado',
            detail: `${team.name} se unió a tu federación (pendiente de ubicar en la nivelación)`,
            value: null,
            teamId: team.id,
          });
        } else if (wasPlayerTeam) {
          removePresidentForTeam(s, team.id);
        }
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
