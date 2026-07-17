// Fase 17F: la conspiración de la Superliga — the dark mirror of adhesion.
// Neglected big clubs (low arraigo, top-quartile strength) plot to leave the
// federation. Single closeSeason step (advanceConspiracy, priority 168).
// Reuses politicsRng exclusively — no new RNG stream. At most one conspiracy
// active at a time.

import { rngNext } from './rng';
import { logFederation } from './federation-log';
import { pushMail } from './mailbox';
import { removePresidentForTeam } from './characters';
import type { Conspiracy, ConspiracyDemand, Federation, GameState, Team } from './types';

const TRIGGER_MIN_MEMBERS = 3;
const TRIGGER_ARRAIGO_MAX = 40;
const TRIGGER_STRENGTH_PERCENTILE = 0.75; // top 25% of the federation's teams
const TRIGGER_PROB = 0.5;
const APPEASEMENT_ARRAIGO = 55;
const CONSUMMATION_ESCISION_SHARE = 0.5; // >= half of division 1 leaving ends the game

function playerTeams(s: GameState): Team[] {
  return s.teams.filter((t) => t.federationId === s.playerFederationId && t.divisionOrden !== null);
}

function findConspiracyCandidates(s: GameState): Team[] {
  const teams = playerTeams(s);
  if (teams.length === 0) return [];
  const sortedStrength = teams.map((t) => t.strength).sort((a, b) => a - b);
  const idx = Math.min(sortedStrength.length - 1, Math.floor(sortedStrength.length * TRIGGER_STRENGTH_PERCENTILE));
  const threshold = sortedStrength[idx];
  return teams.filter((t) => t.arraigo < TRIGGER_ARRAIGO_MAX && t.strength >= threshold);
}

function hasAggravatingFactors(s: GameState): boolean {
  if (s.publicOpinion < 25) return true;
  const c = s.conspiracy;
  if (!c) return false;
  return s.pledges.some(
    (p) => p.status === 'rota' && p.deadlineYear === s.year && c.memberTeamIds.includes(p.teamId),
  );
}

function pickDestinationFederation(s: GameState): Federation | undefined {
  const rivalIds = new Set(s.federations.filter((f) => !f.isPlayer).map((f) => f.id));
  const byCoefficient = [...s.federationCoefficients]
    .filter((fc) => rivalIds.has(fc.federationId))
    .sort((a, b) => b.cumulativeScore - a.cumulativeScore);
  if (byCoefficient.length > 0) {
    const fed = s.federations.find((f) => f.id === byCoefficient[0].federationId);
    if (fed) return fed;
  }
  const rivals = s.federations.filter((f) => !f.isPlayer);
  if (rivals.length === 0) return undefined;
  return [...rivals].sort((a, b) => b.prestige - a.prestige)[0];
}

function finalize(s: GameState, phase: 'desactivada' | 'consumada'): void {
  const c = s.conspiracy;
  if (!c) return;
  c.phase = phase;
  s.conspiracyHistory.push(c);
  s.conspiracy = null;
}

function maybeStartConspiracy(s: GameState): void {
  const candidates = findConspiracyCandidates(s);
  if (candidates.length < TRIGGER_MIN_MEMBERS) return;
  if (rngNext(s.politicsRng) >= TRIGGER_PROB) return;

  const ringleader = [...candidates].sort((a, b) => a.arraigo - b.arraigo)[0];
  s.conspiracy = {
    phase: 'rumor',
    memberTeamIds: candidates.map((t) => t.id),
    ringleaderTeamId: ringleader.id,
    startedYear: s.year,
    demands: [],
    deadlineYear: 0,
  };

  logFederation(s, {
    year: s.year,
    matchday: 0,
    type: 'conspiracy',
    title: 'Rumores de cenas discretas entre presidentes',
    detail: 'Tu asesor menciona movimientos poco claros entre algunos clubes. Nada confirmado.',
    value: null,
    teamId: null,
  });
  pushMail(s, {
    year: s.year,
    matchday: 0,
    category: 'aviso',
    title: 'Cenas discretas entre presidentes',
    body: 'Se comenta en los pasillos que varios presidentes llevan semanas reuniéndose fuera de la agenda oficial. Probablemente no sea nada.',
    actionKind: null,
    refId: null,
    teamId: null,
    deadlineMatchday: null,
    createdAtMatchday: 0,
  });
}

function pickDemands(s: GameState, c: Conspiracy): ConspiracyDemand[] {
  const candidates: ConspiracyDemand[] = [];

  const ligaPrize = s.competitionPrizes.find((p) => p.kind === 'liga');
  candidates.push({ kind: 'mejora_reparto_grandes', refId: null, baseline: ligaPrize?.pool ?? 0, met: false });

  const recurringCup = s.cups.find((cup) => cup.recurring && cup.status !== 'finalizada');
  if (recurringCup) {
    candidates.push({ kind: 'plazas_copa_garantizadas', refId: recurringCup.id, baseline: null, met: false });
  }

  const norm = s.norms[0];
  if (norm) {
    candidates.push({ kind: 'derogar_norma', refId: norm.id, baseline: null, met: false });
  }

  const members = c.memberTeamIds.map((id) => s.teams.find((t) => t.id === id)).filter((t): t is Team => !!t);
  const totalCapacity = members.reduce((a, t) => a + t.stadiumCapacity, 0);
  candidates.push({ kind: 'inversion_estadios', refId: null, baseline: totalCapacity, met: false });

  // Deterministic Fisher-Yates via politicsRng, then take 2-3.
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rngNext(s.politicsRng) * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const want = candidates.length >= 3 ? (rngNext(s.politicsRng) < 0.5 ? 2 : 3) : candidates.length;
  return shuffled.slice(0, Math.min(want, candidates.length));
}

function evaluateDemand(s: GameState, c: Conspiracy, d: ConspiracyDemand): boolean {
  switch (d.kind) {
    case 'mejora_reparto_grandes': {
      const ligaPrize = s.competitionPrizes.find((p) => p.kind === 'liga');
      return !!ligaPrize && ligaPrize.pool >= (d.baseline ?? 0) * 1.15;
    }
    case 'plazas_copa_garantizadas': {
      const cup = s.cups.find((cup) => cup.id === d.refId);
      return !!cup && c.memberTeamIds.every((id) => cup.participantTeamIds.includes(id));
    }
    case 'derogar_norma':
      return d.refId == null || !s.norms.some((n) => n.id === d.refId);
    case 'inversion_estadios': {
      const members = c.memberTeamIds.map((id) => s.teams.find((t) => t.id === id)).filter((t): t is Team => !!t);
      const total = members.reduce((a, t) => a + t.stadiumCapacity, 0);
      return total >= (d.baseline ?? 0) + 10_000;
    }
  }
}

function applyAppeasement(s: GameState, c: Conspiracy): void {
  c.memberTeamIds = c.memberTeamIds.filter((id) => {
    const t = s.teams.find((tm) => tm.id === id);
    return !!t && t.arraigo < APPEASEMENT_ARRAIGO;
  });
  if (c.memberTeamIds.length < TRIGGER_MIN_MEMBERS) {
    logFederation(s, {
      year: s.year,
      matchday: 0,
      type: 'conspiracy',
      title: 'La conspiración se disuelve',
      detail: 'Suficientes clubes recuperaron la confianza en el proyecto. La amenaza se apaga sola.',
      value: null,
      teamId: null,
    });
    finalize(s, 'desactivada');
  }
}

function consummate(s: GameState, c: Conspiracy): void {
  const div1 = s.teams.filter((t) => t.federationId === s.playerFederationId && t.divisionOrden === 1);
  const leavingDiv1 = c.memberTeamIds.filter((id) => div1.some((t) => t.id === id)).length;

  const departedNames: string[] = [];
  for (const id of c.memberTeamIds) {
    const t = s.teams.find((tm) => tm.id === id);
    if (!t || t.federationId !== s.playerFederationId) continue;
    const dest = pickDestinationFederation(s);
    if (!dest) continue;
    removePresidentForTeam(s, t.id);
    t.federationId = dest.id;
    t.divisionOrden = null;
    t.arraigo = 30;
    departedNames.push(t.name);
    logFederation(s, {
      year: s.year,
      matchday: 0,
      type: 'conspiracy',
      title: 'Fuga a la Superliga',
      detail: `${t.name} abandona la federación para unirse a la Superliga, acogido por ${dest.name}`,
      value: null,
      teamId: t.id,
    });
  }

  finalize(s, 'consumada');

  if (div1.length > 0 && leavingDiv1 / div1.length >= CONSUMMATION_ESCISION_SHARE) {
    s.gameOver = {
      reason: 'escision',
      year: s.year,
      message: 'La mitad de la primera división se ha escindido para fundar la Superliga. La federación no sobrevive al cisma.',
    };
    pushMail(s, {
      year: s.year,
      matchday: 0,
      category: 'aviso',
      title: 'La Superliga se consuma',
      body: `${departedNames.join(', ')} han abandonado la federación. La primera división queda descabezada. Has sido destituido.`,
      actionKind: null,
      refId: null,
      teamId: null,
      deadlineMatchday: null,
      createdAtMatchday: 0,
    });
  } else {
    s.prestige = Math.max(0, s.prestige - 6);
    s.publicOpinion = Math.max(0, Math.min(100, s.publicOpinion - 10));
    s.boardConfidence.value = Math.max(0, Math.min(100, s.boardConfidence.value - 15));
    pushMail(s, {
      year: s.year,
      matchday: 0,
      category: 'aviso',
      title: 'La Superliga se consuma',
      body: `${departedNames.join(', ')} han abandonado la federación. La liga sobrevive, amputada.`,
      actionKind: null,
      refId: null,
      teamId: null,
      deadlineMatchday: null,
      createdAtMatchday: 0,
    });
  }
}

function resolveUltimatum(s: GameState, c: Conspiracy): void {
  for (const d of c.demands) d.met = evaluateDemand(s, c, d);
  const metCount = c.demands.filter((d) => d.met).length;
  if (metCount >= 2) {
    s.publicOpinion = Math.max(0, Math.min(100, s.publicOpinion + 4));
    logFederation(s, {
      year: s.year,
      matchday: 0,
      type: 'conspiracy',
      title: 'El comisionado salva la liga',
      detail: 'Las demandas de los clubes descontentos se cumplieron a tiempo. La conspiración se disuelve.',
      value: null,
      teamId: null,
    });
    finalize(s, 'desactivada');
  } else {
    consummate(s, c);
  }
}

function notifyOrganizada(s: GameState, c: Conspiracy): void {
  const names = c.memberTeamIds
    .map((id) => s.teams.find((t) => t.id === id)?.name)
    .filter((n): n is string => !!n)
    .join(', ');
  logFederation(s, {
    year: s.year,
    matchday: 0,
    type: 'conspiracy',
    title: 'La conspiración toma forma',
    detail: `Se confirma: ${names} están organizando su salida de la federación.`,
    value: null,
    teamId: null,
  });
  pushMail(s, {
    year: s.year,
    matchday: 0,
    category: 'aviso',
    title: 'Conspiración confirmada',
    body: `${names} están planeando abandonar la federación. Sube su arraigo a 55 o más para sacarlos de la conspiración, o rompe al cabecilla en Gobernanza.`,
    actionKind: 'conspiracy',
    refId: null,
    teamId: null,
    deadlineMatchday: null,
    createdAtMatchday: 0,
  });
}

function notifyUltimatum(s: GameState, c: Conspiracy): void {
  logFederation(s, {
    year: s.year,
    matchday: 0,
    type: 'conspiracy',
    title: 'Ultimátum de la Superliga',
    detail: `Los clubes conspiradores exigen ${c.demands.length} condiciones o abandonarán la federación.`,
    value: null,
    teamId: null,
  });
  pushMail(s, {
    year: s.year,
    matchday: 0,
    category: 'aviso',
    title: 'Ultimátum de la Superliga',
    body: 'Los clubes conspiradores han hecho pública una lista de exigencias. Cumple al menos dos antes del próximo cierre de temporada o se marcharán.',
    actionKind: 'conspiracy',
    refId: null,
    teamId: null,
    deadlineMatchday: c.deadlineYear,
    createdAtMatchday: 0,
  });
}

function advanceExistingConspiracy(s: GameState): void {
  const c = s.conspiracy;
  if (!c) return;

  if (c.phase === 'organizada') {
    applyAppeasement(s, c);
    if (s.conspiracy === null) return; // deactivated by appeasement
  }

  if (c.phase === 'ultimatum') {
    if (s.year >= c.deadlineYear) resolveUltimatum(s, c);
    return;
  }

  const jumps = hasAggravatingFactors(s) ? 2 : 1;
  for (let i = 0; i < jumps; i++) {
    if (c.phase === 'rumor') {
      c.phase = 'organizada';
      notifyOrganizada(s, c);
    } else if (c.phase === 'organizada') {
      c.phase = 'ultimatum';
      c.demands = pickDemands(s, c);
      c.deadlineYear = s.year + 1;
      notifyUltimatum(s, c);
      break; // demands were just set — resolve on a later close, not this one
    } else {
      break;
    }
  }
}

// closeSeason step (priority 168). Gated on players.length so player-less
// golden runs never touch politicsRng from here.
export function advanceConspiracy(s: GameState): void {
  if (s.players.length === 0) return;
  if (s.conspiracy === null) {
    maybeStartConspiracy(s);
    return; // a freshly started conspiracy stays at 'rumor' this close
  }
  advanceExistingConspiracy(s);
}

// Governance action: expel/sanction the ringleader once the conspiracy is
// public (organizada or ultimatum). Deactivates the conspiracy, but the
// ringleader leaves immediately and the remaining members hold a grudge.
export function expelRingleader(prev: GameState): GameState {
  const c = prev.conspiracy;
  if (!c || (c.phase !== 'organizada' && c.phase !== 'ultimatum')) return prev;

  const s = structuredClone(prev);
  const conspiracy = s.conspiracy!;
  const ringleaderId = conspiracy.ringleaderTeamId;
  const team = s.teams.find((t) => t.id === ringleaderId);
  if (!team) return prev;

  const dest = pickDestinationFederation(s);
  removePresidentForTeam(s, ringleaderId);
  if (dest) {
    team.federationId = dest.id;
    team.divisionOrden = null;
    team.arraigo = 30;
  }

  for (const id of conspiracy.memberTeamIds) {
    if (id === ringleaderId) continue;
    const president = s.presidents.find((p) => p.teamId === id);
    if (president) president.grudge = Math.min(100, president.grudge + 20);
  }

  s.prestige = Math.max(0, s.prestige - 2);
  s.publicOpinion = Math.max(0, Math.min(100, s.publicOpinion - 8));

  logFederation(s, {
    year: s.year,
    matchday: 0,
    type: 'conspiracy',
    title: 'El cabecilla es expulsado',
    detail: `${team.name} es apartado por conspirar contra la federación. La conspiración pierde a su organizador.`,
    value: null,
    teamId: ringleaderId,
  });

  finalize(s, 'desactivada');
  return s;
}
