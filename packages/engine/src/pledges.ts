// Fase 17C: el libro de promesas. Verified once per season close
// (verifyPledges, priority 165 — before opinion/characters read its effects).
// Each PledgeKind has a concrete, checkable condition against data already in
// state; no new bookkeeping beyond what Pledge.refId/amount already carry.

import { logFederation } from './federation-log';
import { earnPC } from './politics';
import type { GameState, Pledge } from './types';

const ARRAIGO_FULFILLED = 6;
const ARRAIGO_BROKEN = -10;
const GRUDGE_BROKEN = 25;
const PC_FULFILLED = 2;
const PC_BROKEN = -1;

function isFulfilled(state: GameState, p: Pledge): boolean {
  switch (p.kind) {
    case 'plaza_copa': {
      const cup = state.cups.find((c) => c.id === p.refId);
      return !!cup && cup.participantTeamIds.includes(p.teamId);
    }
    case 'mejora_reparto': {
      const liga = state.competitionPrizes.find((cp) => cp.kind === 'liga');
      const currentSpread = liga && liga.shares.length > 1
        ? liga.shares[0] - liga.shares[liga.shares.length - 1]
        : 0;
      return currentSpread <= (p.amount ?? 0);
    }
    case 'exencion_norma':
      return !state.sanctions.some(
        (sa) => sa.teamId === p.teamId && sa.normId === p.refId && sa.year >= p.madeYear,
      );
    case 'rescate_futuro': {
      const demands = state.clubDemands.filter(
        (d) => d.teamId === p.teamId && d.type === 'rescate' && d.year >= p.madeYear && d.resolved,
      );
      // Never tested (no rescue was ever needed) counts as kept; tested and
      // ignored/rejected counts as broken.
      return demands.length === 0 || demands.every((d) => d.satisfied === true);
    }
  }
}

// closeSeason step: any pledge past its deadline is settled — fulfilled or
// broken, never left pending across seasons.
export function verifyPledges(s: GameState): void {
  for (const p of s.pledges) {
    if (p.status !== 'pendiente') continue;
    if (s.year < p.deadlineYear) continue;

    const team = s.teams.find((t) => t.id === p.teamId);
    const fulfilled = isFulfilled(s, p);
    p.status = fulfilled ? 'cumplida' : 'rota';

    if (team) {
      team.arraigo = Math.max(0, Math.min(100, team.arraigo + (fulfilled ? ARRAIGO_FULFILLED : ARRAIGO_BROKEN)));
    }
    const president = s.presidents.find((pr) => pr.teamId === p.teamId);
    if (president && !fulfilled) {
      president.grudge = Math.min(100, president.grudge + GRUDGE_BROKEN);
    }
    if (fulfilled) {
      earnPC(s, PC_FULFILLED, `promesa cumplida a ${team?.name ?? 'un club'}`);
    } else {
      s.politicalCapital = Math.max(0, s.politicalCapital + PC_BROKEN);
    }

    logFederation(s, {
      year: s.year,
      matchday: 0,
      type: 'pledge_result',
      title: fulfilled ? 'Promesa cumplida' : 'Promesa incumplida',
      detail: `${p.kind} — ${team?.name ?? 'club'}`,
      value: null,
      teamId: p.teamId,
    });
  }
}
