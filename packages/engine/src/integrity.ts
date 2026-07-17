// Fase 17D: escándalos e integridad. A deterministic candidate detector
// scans recent league results for suspiciously lopsided matches between a
// team with nothing at stake and one fighting for something; scandalRng
// decides which candidates actually become tracked cases (capped 2/season).
// Repeated impulse use also accumulates a hidden exposureRisk that can blow
// up into an institutional scandal at season close. Everything here is
// gated on players.length > 0 and only ever touches scandalRng, so
// player-less golden runs are byte-identical.

import { rngNext } from './rng';
import { computeStandings, type StandingRow } from './standings';
import { pushMail } from './mailbox';
import { logFederation } from './federation-log';
import { earnPC, spendPC } from './politics';
import type { GameState, IntegrityCase } from './types';
import type { SeasonCloseContext } from './season-pipeline';

export const EXPOSURE_MAX = 95;
const EXPOSURE_PER_IMPULSE = 8;
const EXPOSURE_REPEAT_BONUS = 4;
const EXPOSURE_DECAY = 6;

const CASE_CAP_PER_SEASON = 2;
const CANDIDATE_MATERIALIZE_P = 0.5;
const DETECTION_WINDOW = 5;
const SUSPICIOUS_MARGIN = 3;
const STRONG_MARGIN = 5;

export const INVESTIGATION_COST = 2_000_000;
const INVESTIGATION_MATCHDAYS = 3;
const INVESTIGATION_CONFIRM_P = 0.4;

const ARCHIVE_EXPOSURE_BONUS = 6;
const BURY_LEAK_RISK_BASE = 20;
const BURY_LEAK_RISK_DISCOUNTED = 10;
const BURY_PC_COST = 3;
const LEAK_RISK_GROWTH = 15;

const SCANDAL_PRESTIGE_PENALTY = -3;
const SCANDAL_CONFIDENCE_PENALTY = -10;
const SCANDAL_OPINION_PENALTY = -15;
const LEAK_EXTRA_OPINION_PENALTY = -20;
const LEAK_GRUDGE_NOT_INVOLVED = 30;

const SANCTION_FINE = 2_000_000;
const SANCTION_POINTS = 6;
const SANCTION_OPINION_BONUS = 8;
const SANCTION_PC_BONUS = 2;
const SANCTION_PRESTIGE_BONUS = 1;
const SANCTION_ARRAIGO_PENALTY = -15;
const SANCTION_GRUDGE_PENALTY = 40;

const PARDON_ARRAIGO_BONUS = 8;
const PARDON_LEAK_RISK = 35;

// Impulses are the main exposure lever (called directly from applyImpulse in
// engine.ts). Favoring the same team again this season compounds the risk —
// "siempre el mismo equipo" is the classic tell.
export function registerImpulseExposure(s: GameState, favoredTeamId: number): void {
  const priorCount = s.impulseFavorCounts[favoredTeamId] ?? 0;
  const gain = EXPOSURE_PER_IMPULSE + (priorCount > 0 ? EXPOSURE_REPEAT_BONUS : 0);
  s.exposureRisk = Math.min(EXPOSURE_MAX, s.exposureRisk + gain);
  s.impulseFavorCounts[favoredTeamId] = priorCount + 1;
}

// Mathematical-elimination heuristic: a team is "safe" only once it can no
// longer reach the title AND can no longer be dragged into the relegation
// zone within the matchdays left. Mirrors the pressure-boost check already
// inline in advanceMatchday, but scaled by remaining matchdays instead of a
// fixed last-day margin.
// Exported for direct unit testing only — not part of the package's public API.
export function hasSomethingAtStake(rows: StandingRow[], teamId: number, remainingMatchdays: number): boolean {
  if (rows.length < 4) return true;
  const sorted = [...rows].sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff);
  const idx = sorted.findIndex((r) => r.teamId === teamId);
  if (idx < 0) return true;
  const maxSwing = remainingMatchdays * 3;
  const row = sorted[idx];
  if (sorted[0].points - row.points <= maxSwing) return true; // still alive for the title
  const n = sorted.length;
  const relegCount = n > 6 ? 2 : 1;
  const safetyRow = sorted[n - relegCount - 1];
  if (safetyRow && row.points - safetyRow.points <= maxSwing) return true; // still in danger
  return false;
}

// Called at the end of advanceMatchday (md = the matchday just played, before
// s.currentMatchday advances) with s.results already including it. Scans the
// last DETECTION_WINDOW matchdays of division-1 results for candidates;
// scandalRng decides which detected candidates actually stick as a case.
export function detectAndSpawnCases(s: GameState, md: number): void {
  if (s.players.length === 0) return;

  const div1Teams = s.teams.filter((t) => t.federationId === s.playerFederationId && t.divisionOrden === 1);
  const div1Results = s.results.filter((r) => r.divisionOrden === 1);
  const table = computeStandings(div1Teams, div1Results);
  const remaining = Math.max(0, s.totalMatchdays - md);
  const windowStart = Math.max(1, md - (DETECTION_WINDOW - 1));
  const byId = new Map(s.teams.map((t) => [t.id, t]));

  // Variant 2 of the detector (§5.3): the bottom side winning away by ≥3 at
  // the leader's ground is suspicious on its own — both sides have stakes,
  // but the result is impossible enough that the suspicion falls on the
  // leader (who lost inexplicably at home).
  const sorted = [...table].sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff);
  const leaderId = sorted.length >= 4 ? sorted[0].teamId : null;
  const colistaId = sorted.length >= 4 ? sorted[sorted.length - 1].teamId : null;

  for (const r of div1Results) {
    if (r.matchday < windowStart || r.matchday > md) continue;
    if (s.integrityCases.filter((c) => c.year === s.year).length >= CASE_CAP_PER_SEASON) return;
    if (s.integrityCases.some((c) => c.matchday === r.matchday && c.homeId === r.homeId && c.awayId === r.awayId)) continue;

    const margin = Math.abs(r.homeGoals - r.awayGoals);
    if (margin < SUSPICIOUS_MARGIN) continue;
    const colistaShock =
      leaderId !== null && colistaId !== null &&
      r.homeId === leaderId && r.awayId === colistaId &&
      r.awayGoals - r.homeGoals >= SUSPICIOUS_MARGIN;
    const homeStake = hasSomethingAtStake(table, r.homeId, remaining);
    const awayStake = hasSomethingAtStake(table, r.awayId, remaining);
    if (!colistaShock && homeStake === awayStake) continue; // both or neither at stake — not suspicious

    if (rngNext(s.scandalRng) >= CANDIDATE_MATERIALIZE_P) continue; // detected, didn't stick

    const suspectTeamId = colistaShock ? r.homeId : homeStake ? r.awayId : r.homeId;
    const repeatOffender = s.integrityCases.some((c) => c.suspectTeamId === suspectTeamId);
    const strong = margin >= STRONG_MARGIN || repeatOffender;
    const homeName = byId.get(r.homeId)?.name ?? 'Desconocido';
    const awayName = byId.get(r.awayId)?.name ?? 'Desconocido';

    const kase: IntegrityCase = {
      id: s.nextCaseId++,
      year: s.year,
      matchday: r.matchday,
      homeId: r.homeId,
      awayId: r.awayId,
      suspectTeamId,
      suspicion: colistaShock
        ? `${homeName} ${r.homeGoals}-${r.awayGoals} ${awayName} (jornada ${r.matchday}): el líder cae goleado en casa contra el colista. Nadie se explica el resultado.`
        : `${homeName} ${r.homeGoals}-${r.awayGoals} ${awayName} (jornada ${r.matchday}): ${margin} goles de diferencia entre un equipo sin nada en juego y otro que se lo jugaba todo.`,
      strong,
      status: 'abierto',
      investigationEndsMatchday: null,
      leakRisk: 0,
      resolution: null,
    };
    s.integrityCases.push(kase);

    pushMail(s, {
      year: s.year,
      matchday: md,
      category: 'aviso',
      title: 'Resultado sospechoso',
      body: `${homeName} ${r.homeGoals}-${r.awayGoals} ${awayName} (jornada ${r.matchday}) ha levantado sospechas de amaño. Decide qué hacer.`,
      actionKind: 'integrity_case',
      refId: kase.id,
      teamId: null,
      deadlineMatchday: null,
      createdAtMatchday: md,
    });
  }
}

// Checks investigation timers each advanceMatchday; resolves any that hit
// their deadline this matchday.
export function resolveInvestigation(s: GameState, md: number): void {
  if (s.players.length === 0) return;
  const byId = new Map(s.teams.map((t) => [t.id, t]));

  for (const c of s.integrityCases) {
    if (c.status !== 'investigando') continue;
    if (c.investigationEndsMatchday === null || md < c.investigationEndsMatchday) continue;

    const confirmed = rngNext(s.scandalRng) < INVESTIGATION_CONFIRM_P;
    c.status = confirmed ? 'confirmado' : 'sin_pruebas';
    const homeName = byId.get(c.homeId)?.name ?? 'Desconocido';
    const awayName = byId.get(c.awayId)?.name ?? 'Desconocido';
    c.resolution = confirmed
      ? 'La investigación confirmó el amaño.'
      : 'La investigación no encontró pruebas suficientes.';

    if (!confirmed) {
      s.publicOpinion = Math.max(0, s.publicOpinion - 1);
    }

    pushMail(s, {
      year: s.year,
      matchday: md,
      category: 'aviso',
      title: confirmed ? 'Amaño confirmado' : 'Investigación cerrada sin pruebas',
      body: confirmed
        ? `La investigación sobre ${homeName} vs ${awayName} (jornada ${c.matchday}) confirmó el amaño. Debes decidir cómo actuar.`
        : `La investigación sobre ${homeName} vs ${awayName} (jornada ${c.matchday}) no encontró pruebas.`,
      actionKind: 'integrity_case',
      refId: c.id,
      teamId: null,
      deadlineMatchday: null,
      createdAtMatchday: md,
    });
  }
}

export function startInvestigation(prev: GameState, caseId: number): GameState {
  const c = prev.integrityCases.find((c) => c.id === caseId);
  if (!c || c.status !== 'abierto') return prev;
  if (prev.treasury < INVESTIGATION_COST) return prev;

  const s = structuredClone(prev);
  const kase = s.integrityCases.find((k) => k.id === caseId)!;
  kase.status = 'investigando';
  kase.investigationEndsMatchday = s.currentMatchday + INVESTIGATION_MATCHDAYS;
  s.treasury -= INVESTIGATION_COST;
  return s;
}

export function archiveCase(prev: GameState, caseId: number): GameState {
  const c = prev.integrityCases.find((c) => c.id === caseId);
  if (!c || c.status !== 'abierto') return prev;

  const s = structuredClone(prev);
  const kase = s.integrityCases.find((k) => k.id === caseId)!;
  kase.status = 'archivado';
  kase.resolution = 'Archivado sin investigar.';
  s.exposureRisk = Math.min(EXPOSURE_MAX, s.exposureRisk + ARCHIVE_EXPOSURE_BONUS);
  return s;
}

export function buryCase(prev: GameState, caseId: number, spendForDiscount: boolean): GameState {
  const c = prev.integrityCases.find((c) => c.id === caseId);
  if (!c || c.status !== 'abierto' || !c.strong) return prev;

  const s = structuredClone(prev);
  const kase = s.integrityCases.find((k) => k.id === caseId)!;
  let leakRisk = BURY_LEAK_RISK_BASE;
  if (spendForDiscount && spendPC(s, BURY_PC_COST, `Encubrir caso de amaño #${caseId}`)) {
    leakRisk = BURY_LEAK_RISK_DISCOUNTED;
  }
  kase.status = 'enterrado';
  kase.leakRisk = leakRisk;
  kase.resolution = 'Enterrado sin investigar.';
  return s;
}

export function sanctionFixing(prev: GameState, caseId: number): GameState {
  const c = prev.integrityCases.find((c) => c.id === caseId);
  if (!c || c.status !== 'confirmado') return prev;
  const team = prev.teams.find((t) => t.id === c.suspectTeamId);
  if (!team) return prev;

  const s = structuredClone(prev);
  const kase = s.integrityCases.find((k) => k.id === caseId)!;
  const t = s.teams.find((t) => t.id === c.suspectTeamId)!;

  s.sanctions.push({
    id: s.nextSanctionId++,
    teamId: t.id,
    normId: 0, // sentinel: not norm-based — a match-fixing sanction (Fase 17D)
    year: s.year,
    appliesToYear: s.year,
    motivo: `Amaño de partido confirmado (jornada ${kase.matchday})`,
    castigo: `−${SANCTION_POINTS} puntos, multa de ${SANCTION_FINE.toLocaleString('es-ES')} €`,
    pointsPenalty: SANCTION_POINTS,
  });
  s.treasury += SANCTION_FINE;
  t.treasury -= SANCTION_FINE;
  t.arraigo = Math.max(0, Math.min(100, t.arraigo + SANCTION_ARRAIGO_PENALTY));

  const president = s.presidents.find((p) => p.teamId === t.id);
  if (president) president.grudge = Math.min(100, president.grudge + SANCTION_GRUDGE_PENALTY);

  s.publicOpinion = Math.min(100, s.publicOpinion + SANCTION_OPINION_BONUS);
  earnPC(s, SANCTION_PC_BONUS, `Sanción por amaño: ${t.name}`);
  s.prestige = Math.min(100, s.prestige + SANCTION_PRESTIGE_BONUS);

  kase.resolution = `Sancionado: ${t.name} pierde ${SANCTION_POINTS} puntos y paga ${SANCTION_FINE.toLocaleString('es-ES')} €.`;

  logFederation(s, {
    year: s.year,
    matchday: 0,
    type: 'integrity_case',
    title: 'Amaño sancionado',
    detail: kase.resolution,
    value: -SANCTION_POINTS,
    teamId: t.id,
  });

  return s;
}

export function pardonFixing(prev: GameState, caseId: number): GameState {
  const c = prev.integrityCases.find((c) => c.id === caseId);
  if (!c || c.status !== 'confirmado') return prev;
  const team = prev.teams.find((t) => t.id === c.suspectTeamId);
  if (!team) return prev;

  const s = structuredClone(prev);
  const kase = s.integrityCases.find((k) => k.id === caseId)!;
  const t = s.teams.find((t) => t.id === c.suspectTeamId)!;

  t.arraigo = Math.min(100, t.arraigo + PARDON_ARRAIGO_BONUS);
  kase.status = 'enterrado';
  kase.leakRisk = PARDON_LEAK_RISK;
  kase.resolution = `Perdonado discretamente: ${t.name} no recibe sanción.`;

  logFederation(s, {
    year: s.year,
    matchday: 0,
    type: 'integrity_case',
    title: 'Amaño perdonado',
    detail: kase.resolution,
    value: null,
    teamId: t.id,
  });

  return s;
}

// closeSeason step (priority 58 — after governance-streak/55, before
// apply-prestige/60, so any scandal prestige hit folds into ctx.prestigeDelta
// for THIS season's history entry). Opinion/confidence effects are published
// via ctx.meta and consumed by close-season-opinion/175 and
// board-confidence/240 respectively, since those steps run later.
export function closeSeasonIntegrity(s: GameState, ctx: SeasonCloseContext): void {
  if (s.players.length === 0) return;

  let opinionPenalty = 0;
  let confidencePenalty = 0;

  if (s.exposureRisk > 0 && rngNext(s.scandalRng) * 100 < s.exposureRisk) {
    ctx.prestigeDelta += SCANDAL_PRESTIGE_PENALTY;
    opinionPenalty += SCANDAL_OPINION_PENALTY;
    confidencePenalty += SCANDAL_CONFIDENCE_PENALTY;
    s.exposureRisk = 0;
    pushMail(s, {
      year: s.year,
      matchday: 0,
      category: 'aviso',
      title: 'Escándalo institucional',
      body: 'Ha trascendido que favoreciste sistemáticamente a ciertos clubes con tus impulsos. La prensa y la junta lo notan.',
      actionKind: null,
      refId: null,
      teamId: null,
      deadlineMatchday: null,
      createdAtMatchday: 0,
    });
    logFederation(s, {
      year: s.year,
      matchday: 0,
      type: 'scandal',
      title: 'Escándalo institucional',
      detail: 'El uso reiterado de impulsos salió a la luz.',
      value: SCANDAL_PRESTIGE_PENALTY,
      teamId: null,
    });
  } else {
    s.exposureRisk = Math.max(0, s.exposureRisk - EXPOSURE_DECAY);
  }

  for (const c of s.integrityCases) {
    if (c.status !== 'enterrado') continue;
    if (rngNext(s.scandalRng) * 100 < c.leakRisk) {
      c.status = 'filtrado';
      c.resolution = 'El encubrimiento salió a la luz.';
      ctx.prestigeDelta += SCANDAL_PRESTIGE_PENALTY;
      opinionPenalty += SCANDAL_OPINION_PENALTY + LEAK_EXTRA_OPINION_PENALTY;
      confidencePenalty += SCANDAL_CONFIDENCE_PENALTY;
      for (const p of s.presidents) {
        if (p.teamId !== c.suspectTeamId) p.grudge = Math.min(100, p.grudge + LEAK_GRUDGE_NOT_INVOLVED);
      }
      pushMail(s, {
        year: s.year,
        matchday: 0,
        category: 'aviso',
        title: 'Encubrimiento al descubierto',
        body: `Se ha filtrado que enterraste el caso de amaño de la jornada ${c.matchday}. El golpe a tu credibilidad es mayor por el encubrimiento.`,
        actionKind: 'integrity_case',
        refId: c.id,
        teamId: null,
        deadlineMatchday: null,
        createdAtMatchday: 0,
      });
      logFederation(s, {
        year: s.year,
        matchday: 0,
        type: 'integrity_case',
        title: 'Encubrimiento filtrado',
        detail: `El caso de amaño de la jornada ${c.matchday} salió a la luz pese al encubrimiento.`,
        value: SCANDAL_PRESTIGE_PENALTY,
        teamId: c.suspectTeamId,
      });
    } else {
      c.leakRisk = Math.min(100, c.leakRisk + LEAK_RISK_GROWTH);
    }
  }

  if (opinionPenalty !== 0) {
    ctx.meta.set('integrityOpinionPenalty', (ctx.meta.get('integrityOpinionPenalty') as number ?? 0) + opinionPenalty);
  }
  if (confidencePenalty !== 0) {
    ctx.meta.set('integrityConfidenceDelta', (ctx.meta.get('integrityConfidenceDelta') as number ?? 0) + confidencePenalty);
  }
}
