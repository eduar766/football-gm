// Fase 17G: eras y legado — the missing victory condition. Four eras
// (Fundacional -> Consolidación -> Reconocimiento -> Élite mundial), each
// with 3 "todos" milestones. Single closeSeason step, priority 262 (after
// federation coefficients + record book at 260/250, before the SeasonReport
// prescan at 265 so a completed era can headline the newspaper).
//
// Ratchet design: every milestone predicate reads *current* state only —
// permanence comes from `s.eraMilestonesAchieved` accumulating true results
// close over close (an achievement that regresses later still counts, same
// spirit as any other "hito" in this design). The set resets to [] whenever
// the era advances, since a new era's milestones are unrelated keys.
//
// Reward-granting is split from milestone detection so migrateState can call
// the pure predicate (to silently backfill `era` for veteran saves) without
// replaying +15 confidence / +3 PC / +1 impulse / mailbox spam on load.

import { playerLeagueTeamCount } from './structure';
import { logFederation } from './federation-log';
import { pushMail } from './mailbox';
import type { GameState } from './types';

export const MAX_ERA = 4;
const BIG_CONTRACT_THRESHOLD = 3_000_000;

interface EraMilestone {
  key: string;
  label: string;
  met: (s: GameState) => boolean;
}

function playerCoefficientRank(s: GameState): number | null {
  const fc = s.federationCoefficients.find((c) => c.federationId === s.playerFederationId);
  return fc ? fc.lastRank : null;
}

function hasRecurringCupWithEditions(s: GameState, minEditions: number): boolean {
  const counts = new Map<string, number>();
  for (const c of s.cups) {
    if (!c.recurring || c.status !== 'finalizada') continue;
    counts.set(c.name, (counts.get(c.name) ?? 0) + 1);
  }
  return [...counts.values()].some((n) => n >= minEditions);
}

function poachedFromTopFederationThisClose(s: GameState): boolean {
  const topRankedFederationIds = new Set(
    s.federationCoefficients.filter((c) => c.lastRank > 0 && c.lastRank <= 3).map((c) => c.federationId),
  );
  if (topRankedFederationIds.size === 0) return false;
  return s.negotiations.some(
    (n) => n.state === 'effective' && n.effectiveYear === s.year && topRankedFederationIds.has(n.fromFederationId),
  );
}

function opinionAtLeastTwoConsecutiveCloses(s: GameState, threshold: number): boolean {
  const last = s.opinionHistory.slice(-2);
  if (last.length < 2) return false;
  const [a, b] = last;
  return a.value >= threshold && b.value >= threshold && b.year === a.year + 1;
}

function hasBigCommercialContract(s: GameState): boolean {
  const teamHasIt = s.teams.some(
    (t) => t.federationId === s.playerFederationId && t.sponsors.some((sp) => sp.valorAnual >= BIG_CONTRACT_THRESHOLD),
  );
  if (teamHasIt) return true;
  return s.commercialContracts.some((c) => c.valorAnual >= BIG_CONTRACT_THRESHOLD);
}

function wonInterLeagueCup(s: GameState): boolean {
  const playerTeamIds = new Set(s.teams.filter((t) => t.federationId === s.playerFederationId).map((t) => t.id));
  return s.cups.some((c) => c.tipo === 'inter_ligas' && c.championTeamId != null && playerTeamIds.has(c.championTeamId));
}

const ERA_MILESTONES: Record<number, EraMilestone[]> = {
  1: [
    { key: 'teams', label: '14 equipos en la liga', met: (s) => playerLeagueTeamCount(s) >= 14 },
    {
      key: 'divisions',
      label: '2 divisiones activas',
      met: (s) => s.divisions.filter((d) => d.federationId === s.playerFederationId).length >= 2,
    },
    { key: 'contract', label: 'Primer contrato comercial grande', met: hasBigCommercialContract },
  ],
  2: [
    { key: 'coef_top5', label: 'Coeficiente top 5', met: (s) => (playerCoefficientRank(s) ?? Infinity) <= 5 },
    { key: 'recurring_cup', label: 'Copa recurrente con ≥3 ediciones', met: (s) => hasRecurringCupWithEditions(s, 3) },
    { key: 'teams16', label: '16 equipos en la liga', met: (s) => playerLeagueTeamCount(s) >= 16 },
  ],
  3: [
    { key: 'coef_top3', label: 'Coeficiente top 3', met: (s) => (playerCoefficientRank(s) ?? Infinity) <= 3 },
    { key: 'poached_top3', label: 'Robar un club a una federación top-3', met: poachedFromTopFederationThisClose },
    { key: 'opinion65x2', label: 'Opinión ≥65 en dos cierres seguidos', met: (s) => opinionAtLeastTwoConsecutiveCloses(s, 65) },
  ],
  4: [
    { key: 'coef_1', label: 'Coeficiente nº1', met: (s) => playerCoefficientRank(s) === 1 },
    { key: 'teams20', label: '20+ equipos en la liga', met: (s) => playerLeagueTeamCount(s) >= 20 },
    { key: 'inter_ligas', label: 'Ganar la copa inter-ligas', met: wonInterLeagueCup },
  ],
};

// Pure: given the current era and its already-accumulated keys, ratchets in
// any newly-true milestone (current state only — no mutation).
function ratchet(s: GameState, era: number, achieved: string[]): string[] {
  const milestones = ERA_MILESTONES[era];
  if (!milestones) return achieved;
  const next = new Set(achieved);
  for (const m of milestones) {
    if (!next.has(m.key) && m.met(s)) next.add(m.key);
  }
  return [...next];
}

function isComplete(era: number, achieved: string[]): boolean {
  const milestones = ERA_MILESTONES[era];
  if (!milestones) return false;
  return milestones.every((m) => achieved.includes(m.key));
}

// Used only by migrateState: silently walks a veteran save's CURRENT state
// forward through as many eras as its state already qualifies for, with zero
// side effects (no rewards, no mail, no federationLog — those are earned
// live, not replayed on load). Returns the era the save should already be at.
export function backfillEra(s: GameState): number {
  let era = 1;
  while (era <= MAX_ERA) {
    const achieved = ratchet(s, era, []);
    if (!isComplete(era, achieved)) break;
    era += 1;
  }
  return era;
}

// closeSeason step (priority 262). Gated on players.length so player-less
// golden runs never touch this (era milestones like "14 equipos" would
// otherwise fire trivially in the default golden setup).
export function evaluateEra(s: GameState): void {
  if (s.players.length === 0) return;
  if (s.era > MAX_ERA) return; // era IV already completed — narrative summit, nothing left to ratchet

  s.eraMilestonesAchieved = ratchet(s, s.era, s.eraMilestonesAchieved);
  if (!isComplete(s.era, s.eraMilestonesAchieved)) return;

  const completedEra = s.era;
  s.era += 1;
  s.eraMilestonesAchieved = [];
  s.eraHistory.push({ era: completedEra, completedYear: s.year });

  s.impulsesPerSeason += 1;
  s.boardConfidence.value = Math.min(100, s.boardConfidence.value + 15);
  s.politicalCapital = Math.min(12, s.politicalCapital + 3);
  // Fase 17G: a new era resets the "one censure survival" budget.
  s.censureUsedInEra = false;

  const ERA_NAMES: Record<number, string> = {
    1: 'Fundacional', 2: 'Consolidación', 3: 'Reconocimiento', 4: 'Élite mundial',
  };
  logFederation(s, {
    year: s.year,
    matchday: 0,
    type: 'era',
    title: `Era completada: ${ERA_NAMES[completedEra] ?? completedEra}`,
    detail: `La federación alcanza un nuevo hito histórico tras cumplir todos los objetivos de la era ${ERA_NAMES[completedEra] ?? completedEra}.`,
    value: null,
    teamId: null,
  });
  pushMail(s, {
    year: s.year,
    matchday: 0,
    category: 'hito',
    title: `Nueva era: ${ERA_NAMES[s.era] ?? s.era}`,
    body: `Has completado la era ${ERA_NAMES[completedEra] ?? completedEra}. La junta te concede un impulso adicional permanente, +15 de confianza y 3 PC.`,
    actionKind: null,
    refId: null,
    teamId: null,
    deadlineMatchday: null,
    createdAtMatchday: 0,
  });
}
