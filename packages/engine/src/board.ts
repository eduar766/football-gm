// Fase 14.8: board confidence + defeat (destitution). A 0–100 meter evaluated
// at closeSeason. When a losing condition is met, s.gameOver is set. The ENGINE
// only sets the flag (it does NOT early-return from the season loop) so unit
// tests and the golden master keep running; the imperative shell (backend)
// refuses to advance once gameOver is set. Gated on players.length > 0 so
// engine-only runs (golden) never trigger it. No RNG — golden-stable.

import { pushMail } from './mailbox';
import { logFederation } from './federation-log';
import type { GameOverReason, GameState, MandateDifficulty } from './types';

export const CONFIDENCE_START = 60;

// Fase 17G: mandate confidence swings now scale with the chosen difficulty
// (replaces the old flat D_MANDATE_OK/D_MANDATE_FAIL — a harder mandate is
// worth more when met and forgiven more when missed, per the design's
// "la derrota debe poder pelearse" framing).
const MANDATE_CONFIDENCE: Record<MandateDifficulty, { met: number; failed: number }> = {
  facil: { met: 2, failed: -12 },
  medio: { met: 5, failed: -8 },
  dificil: { met: 9, failed: -5 },
};
const D_PRESTIGE_UP = 5;
const D_PRESTIGE_DOWN = -6;
const D_TREASURY_NEG = -10;
const D_TEAM_LEFT = -12;
const D_DEMAND_EXPIRED = -4;
const D_OPINION_LOW = -5; // Fase 17B: public opinion drags board confidence
const D_OPINION_HIGH = 3;

const GAME_OVER_MESSAGES: Record<GameOverReason, string> = {
  destitucion_confianza: 'La junta ha perdido toda la confianza en tu gestión y te ha destituido.',
  quiebra: 'La federación acumula dos temporadas en números rojos. La junta te destituye.',
  exodo: 'Demasiados clubes han abandonado la federación bajo tu mando. Estás fuera.',
  mandatos: 'Has incumplido tres mandatos consecutivos de la junta. Se acabó.',
  liga_vacia: 'La liga se ha quedado sin equipos suficientes para competir. Fin del proyecto.',
  escision: 'La mitad de la primera división se ha escindido para fundar la Superliga. La federación no sobrevive al cisma.',
};

// Called at closeSeason (before the year increment) with the season's prestige
// delta. Updates confidence, tracks the negative-treasury streak, and may set
// s.gameOver. In-place mutation.
// integrityDelta: published by the integrity-rolls step (priority 58, via
// ctx.meta) when a scandal or leaked cover-up fired this close (Fase 17D).
export function evaluateBoardConfidence(s: GameState, prestigeDelta: number, integrityDelta = 0): void {
  if (s.players.length === 0) return; // real games only → golden untouched
  if (s.gameOver) return;

  let d = integrityDelta;
  const reasons: string[] = [];
  if (integrityDelta !== 0) reasons.push('escándalo de integridad');

  const mandate = s.mandates.find((m) => m.year === s.year);
  if (mandate) {
    const swing = MANDATE_CONFIDENCE[mandate.difficulty];
    if (mandate.met === true) {
      d += swing.met;
      reasons.push(`mandato cumplido (${mandate.difficulty})`);
    } else if (mandate.met === false) {
      d += swing.failed;
      reasons.push(`mandato fallido (${mandate.difficulty})`);
    }
  }

  if (prestigeDelta > 0) d += D_PRESTIGE_UP;
  else if (prestigeDelta < 0) d += D_PRESTIGE_DOWN;

  if (s.treasury < 0) {
    d += D_TREASURY_NEG;
    reasons.push('tesorería negativa');
  }

  const teamsLeftThisYear = s.federationLog.filter(
    (e) => e.type === 'team_left' && e.year === s.year,
  ).length;
  if (teamsLeftThisYear > 0) {
    d += D_TEAM_LEFT * teamsLeftThisYear;
    reasons.push(`${teamsLeftThisYear} club(es) se marcharon`);
  }

  const demandsExpired = s.clubDemands.filter(
    (dm) => dm.resolved && dm.satisfied === false && dm.year === s.year,
  ).length;
  if (demandsExpired > 0) {
    d += D_DEMAND_EXPIRED * demandsExpired;
    reasons.push(`${demandsExpired} petición(es) ignoradas`);
  }

  // Fase 17B: public opinion (already updated for this close by the
  // close-season-opinion step, priority 175, which runs before this one, 240).
  if (s.publicOpinion < 30) {
    d += D_OPINION_LOW;
    reasons.push('opinión pública baja');
  } else if (s.publicOpinion >= 75) {
    d += D_OPINION_HIGH;
    reasons.push('opinión pública alta');
  }

  const before = s.boardConfidence.value;
  s.boardConfidence.value = Math.max(0, Math.min(100, before + d));
  s.boardConfidence.history.push({
    year: s.year,
    value: s.boardConfidence.value,
    reason: reasons.join(', ') || 'temporada estable',
  });

  // Negative-treasury streak (for the 'quiebra' condition).
  if (s.treasury < 0) s.negativeTreasurySeasons = (s.negativeTreasurySeasons ?? 0) + 1;
  else s.negativeTreasurySeasons = 0;

  // Early warning when confidence crosses below 30.
  if (s.boardConfidence.value <= 30 && before > 30) {
    pushMail(s, {
      year: s.year,
      matchday: 0,
      category: 'aviso',
      title: 'La junta te observa',
      body: `La confianza de la junta ha caído a ${s.boardConfidence.value}/100. Endereza el rumbo o serás destituido.`,
      actionKind: null,
      refId: null,
      teamId: null,
      deadlineMatchday: null,
      createdAtMatchday: 0,
    });
  }

  // Fase 17G: moción de censura intercepts the confidence-driven destitución
  // trigger — below 25, it opens a blocking motion (resolved via
  // resolveCensureMotion) instead of firing gameOver immediately. A second
  // motion within the same era is definitive: no survival options, straight
  // to destitución. This has its own reason-priority slot, ahead of the
  // other (unrelated) defeat conditions below.
  if (s.boardConfidence.value < 25 && !s.censureMotion) {
    if (s.censureUsedInEra) {
      s.gameOver = {
        reason: 'destitucion_confianza',
        year: s.year,
        message: GAME_OVER_MESSAGES.destitucion_confianza,
      };
      pushMail(s, {
        year: s.year,
        matchday: 0,
        category: 'aviso',
        title: 'Moción de censura definitiva',
        body: 'Ya sobreviviste una moción de censura esta era. La junta no te da una segunda oportunidad. Has sido destituido.',
        actionKind: null,
        refId: null,
        teamId: null,
        deadlineMatchday: null,
        createdAtMatchday: 0,
      });
    } else {
      s.censureMotion = { year: s.year };
      logFederation(s, {
        year: s.year,
        matchday: 0,
        type: 'censura',
        title: 'Moción de censura',
        detail: `La confianza de la junta ha caído a ${s.boardConfidence.value}/100. Se abre una moción de censura.`,
        value: null,
        teamId: null,
      });
      pushMail(s, {
        year: s.year,
        matchday: 0,
        category: 'aviso',
        title: 'Moción de censura',
        body: 'La junta ha abierto una moción de censura contra tu gestión. Resuélvela antes de cerrar la próxima temporada: gasta 6 PC, invoca una defensa por méritos (mandato cumplido o era completada este año), o acepta la destitución.',
        actionKind: 'censura',
        refId: null,
        teamId: null,
        deadlineMatchday: null,
        createdAtMatchday: 0,
      });
    }
  }

  // ── Defeat conditions (unrelated to the confidence-driven censura path above) ──
  const competing = s.teams.filter(
    (t) => t.federationId === s.playerFederationId && t.divisionOrden !== null,
  ).length;
  const teamsLeftTotal = s.federationLog.filter((e) => e.type === 'team_left').length;
  const decided = s.mandates
    .filter((m) => m.met !== null)
    .sort((a, b) => b.year - a.year)
    .slice(0, 3);
  const threeFails = decided.length >= 3 && decided.every((m) => m.met === false);

  let reason: GameOverReason | null = null;
  if (threeFails) reason = 'mandatos';
  else if ((s.negativeTreasurySeasons ?? 0) >= 2) reason = 'quiebra';
  else if (competing < 2) reason = 'liga_vacia';
  else if (teamsLeftTotal >= 3) reason = 'exodo';

  if (reason && !s.gameOver) {
    s.gameOver = { reason, year: s.year, message: GAME_OVER_MESSAGES[reason] };
    pushMail(s, {
      year: s.year,
      matchday: 0,
      category: 'aviso',
      title: 'Has sido destituido',
      body: GAME_OVER_MESSAGES[reason],
      actionKind: null,
      refId: null,
      teamId: null,
      deadlineMatchday: null,
      createdAtMatchday: 0,
    });
  }
}

// Fase 17G: commissioner action resolving an open moción de censura.
// 'aceptar' is always available (accept destitución outright). 'gastar_pc'
// and 'defensa_meritos' are unavailable once censureUsedInEra is true (a
// second motion within the same era is definitive — see evaluateBoardConfidence).
export function resolveCensureMotion(
  prev: GameState,
  mode: 'gastar_pc' | 'defensa_meritos' | 'aceptar',
): GameState {
  if (!prev.censureMotion) return prev;

  if (mode === 'aceptar') {
    const s = structuredClone(prev);
    s.gameOver = {
      reason: 'destitucion_confianza',
      year: s.year,
      message: GAME_OVER_MESSAGES.destitucion_confianza,
    };
    s.censureMotion = null;
    logFederation(s, {
      year: s.year, matchday: 0, type: 'censura',
      title: 'Moción de censura: destitución aceptada',
      detail: 'El comisionado acepta la destitución sin oponer defensa.',
      value: null, teamId: null,
    });
    return s;
  }

  if (prev.censureUsedInEra) return prev; // definitive — only 'aceptar' works

  const motion = prev.censureMotion;
  if (mode === 'gastar_pc') {
    if (prev.politicalCapital < 6) return prev;
    const s = structuredClone(prev);
    s.politicalCapital -= 6;
    s.boardConfidence.value = 40;
    s.censureUsedInEra = true;
    s.censureMotion = null;
    logFederation(s, {
      year: s.year, matchday: 0, type: 'censura',
      title: 'Moción de censura superada',
      detail: 'El comisionado compra tiempo gastando 6 PC. La confianza sube a 40.',
      value: -6, teamId: null,
    });
    return s;
  }

  // defensa_meritos
  const meritOk = prev.mandates.find((m) => m.year === motion.year)?.met === true
    || prev.eraHistory.some((e) => e.completedYear === motion.year);
  if (!meritOk) return prev;
  const s = structuredClone(prev);
  s.boardConfidence.value = 35;
  s.censureUsedInEra = true;
  s.censureMotion = null;
  logFederation(s, {
    year: s.year, matchday: 0, type: 'censura',
    title: 'Moción de censura superada por méritos',
    detail: 'El comisionado invoca un mandato cumplido o una era completada. La junta se retracta. La confianza sube a 35.',
    value: null, teamId: null,
  });
  return s;
}
