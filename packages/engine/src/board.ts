// Fase 14.8: board confidence + defeat (destitution). A 0–100 meter evaluated
// at closeSeason. When a losing condition is met, s.gameOver is set. The ENGINE
// only sets the flag (it does NOT early-return from the season loop) so unit
// tests and the golden master keep running; the imperative shell (backend)
// refuses to advance once gameOver is set. Gated on players.length > 0 so
// engine-only runs (golden) never trigger it. No RNG — golden-stable.

import { pushMail } from './mailbox';
import type { GameOverReason, GameState } from './types';

export const CONFIDENCE_START = 60;

const D_MANDATE_OK = 8;
const D_MANDATE_FAIL = -15;
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
  if (mandate?.met === true) {
    d += D_MANDATE_OK;
    reasons.push('mandato cumplido');
  } else if (mandate?.met === false) {
    d += D_MANDATE_FAIL;
    reasons.push('mandato fallido');
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

  // ── Defeat conditions ──
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
  if (s.boardConfidence.value <= 0) reason = 'destitucion_confianza';
  else if (threeFails) reason = 'mandatos';
  else if ((s.negativeTreasurySeasons ?? 0) >= 2) reason = 'quiebra';
  else if (competing < 2) reason = 'liga_vacia';
  else if (teamsLeftTotal >= 3) reason = 'exodo';

  if (reason) {
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
