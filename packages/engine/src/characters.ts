// Fase 17A: club presidents (player-federation teams) + rival-federation
// commissioners. Purely narrative in v1 — traits shade federationLog entries
// and (from 17C onward) vote intention. Generation at game creation / adhesion
// uses a one-shot seed-derived draw so it never perturbs the persistent
// streams; rotation at season close uses the dedicated politicsRng stream.
// Rival-commissioner traits never bias rival-sim.ts (would perturb rivalRng).

import { rngNext, type RngState } from './rng';
import { randomDirectorName } from './names';
import { logFederation } from './federation-log';
import type { ClubPresident, GameState, PresidentTrait, RivalCommissioner, RivalCommissionerTrait } from './types';

const PRESIDENT_TRAITS: PresidentTrait[] = [
  'leal', 'ambicioso', 'tradicionalista', 'mercenario', 'institucional',
];
const RIVAL_COMMISSIONER_TRAITS: RivalCommissionerTrait[] = [
  'agresivo', 'conservador', 'corrupto', 'visionario', 'diplomatico',
];

// Probability a given team's president is replaced at any given season close.
const ROTATION_CHANCE = 0.08;

function pickTrait<T>(rng: RngState, traits: T[]): T {
  return traits[Math.floor(rngNext(rng) * traits.length)];
}

export function generatePresident(rng: RngState, teamId: number, year: number): Omit<ClubPresident, 'id'> {
  return {
    teamId,
    name: randomDirectorName(rng),
    trait: pickTrait(rng, PRESIDENT_TRAITS),
    sinceYear: year,
    grudge: 0,
  };
}

export function generateRivalCommissioner(rng: RngState, federationId: number, year: number): RivalCommissioner {
  return {
    federationId,
    name: randomDirectorName(rng),
    trait: pickTrait(rng, RIVAL_COMMISSIONER_TRAITS),
    sinceYear: year,
  };
}

export function presidentOf(s: GameState, teamId: number): ClubPresident | undefined {
  return s.presidents.find((p) => p.teamId === teamId);
}

// A team just joined the player's federation (adhesion effective, or built
// from scratch): give it a president. Draws from the persistent politicsRng
// stream — this happens mid-game, not at creation, so the one-shot seed draw
// used by createGame/migrateState does not apply here.
export function addPresidentForTeam(s: GameState, teamId: number): void {
  if (presidentOf(s, teamId)) return; // defensive: already has one
  const next = generatePresident(s.politicsRng, teamId, s.year);
  s.presidents.push({ id: s.nextPresidentId++, ...next });
}

// A team just left the player's federation (poached, exodus): its president
// stops being tracked. Nothing is deleted elsewhere in the model, but a
// president only makes sense for a team the commissioner currently governs.
export function removePresidentForTeam(s: GameState, teamId: number): void {
  s.presidents = s.presidents.filter((p) => p.teamId !== teamId);
}

// closeSeason step: each player-federation team has an independent chance of
// a presidential handover. A new president always starts with grudge 0 — the
// escape hatch a jugador gets from a broken pledge is a boardroom coup.
export function rotatePresidents(s: GameState): void {
  for (const t of s.teams) {
    if (t.federationId !== s.playerFederationId) continue;
    const current = presidentOf(s, t.id);
    if (!current) continue; // defensive: should not happen post-migration
    if (rngNext(s.politicsRng) >= ROTATION_CHANCE) continue;

    const outgoing = current.name;
    const next = generatePresident(s.politicsRng, t.id, s.year);
    current.name = next.name;
    current.trait = next.trait;
    current.sinceYear = s.year;
    current.grudge = 0;

    logFederation(s, {
      year: s.year,
      matchday: 0,
      type: 'president_change',
      title: `Relevo en la presidencia de ${t.name}`,
      detail: `${outgoing} deja el cargo. ${next.name} (${next.trait}) asume la presidencia.`,
      value: null,
      teamId: t.id,
    });
  }
}
