// Fase 17C: the Assembly. Structural/governance decisions that used to be
// unilateral now require a club vote (§4.2 of the design doc). Pure functions
// over GameState, following the existing prev->structuredClone->return
// convention so callers can dispatch through `applyApprovedProposal` and
// re-assign (`s = applyApprovedProposal(s, proposal)`) without silently
// dropping the mutation.
//
// Four of the seven kinds wrap functions that already guard
// `phase !== 'pretemporada'` (setLeaguePrize, createCup, runLevelingLeague,
// setLeagueFormat) — proposeMeasure enforces the same gate up front so a
// passed vote is never applied mid-season against a no-op. Resolution is
// hooked at the top of startSeason (before fixtures are built) and the top of
// advanceMatchday, plus a closeSeason safety net — see engine.ts.

import { rngNext } from './rng';
import { presidentOf } from './characters';
import { spendPC } from './politics';
import { logFederation } from './federation-log';
import { addNorm, removeNorm } from './norms';
import { setLeaguePrize } from './prizes';
import { createCup } from './cups';
import { runLevelingLeague, setLeagueFormat } from './structure';
import { wageBill } from './salaries';
import type {
  AdmisionAceleradaPayload,
  AssemblyProposal,
  AssemblyVote,
  CambioFormatoPayload,
  CambioRepartoPayload,
  CopaRecurrentePayload,
  DerogarNormaPayload,
  ExpansionDivisionPayload,
  GameState,
  NormaNuevaPayload,
  Pledge,
  PledgeKind,
  PresidentTrait,
  ProposalKind,
  ProposalPayload,
  Team,
} from './types';

const MAX_PENDING_PROPOSALS = 2;
const MAX_MANUAL_REVEALS = 3;
const BUY_VOTE_COST = 2;
const REPROPOSE_COST = 4;
const SOFT_VOTE_THRESHOLD = -20; // buyVote/pledgeForVote only touch score > this

// Only these two reshape the whole league rather than one club's situation.
const MAJORITY_2_3: ProposalKind[] = ['expansion_division', 'cambio_formato', 'admision_acelerada'];
// These wrap functions that already guard phase !== 'pretemporada'; gating the
// proposal itself here means a passed vote can never land mid-season.
const PRETEMPORADA_ONLY: ProposalKind[] = ['cambio_reparto', 'copa_recurrente', 'expansion_division', 'cambio_formato'];

function payload<T>(p: ProposalPayload): T {
  return p as T;
}

// ── Vote-intention formula (§4.3) ────────────────────────────────────────────

function arraigoModifier(team: Team): number {
  if (team.arraigo >= 70) return 15;
  if (team.arraigo <= 35) return -15;
  return 0;
}

function traitModifier(trait: PresidentTrait, kind: ProposalKind, p: ProposalPayload): number {
  switch (trait) {
    case 'leal': return 10;
    case 'institucional': return 0;
    case 'ambicioso':
      if (kind === 'expansion_division' || kind === 'copa_recurrente') return 15;
      if (kind === 'norma_nueva' && payload<NormaNuevaPayload>(p).tipo === 'tope_salarial') return -10;
      return 0;
    case 'tradicionalista':
      if (kind === 'cambio_formato') return -20;
      if (kind === 'norma_nueva' && payload<NormaNuevaPayload>(p).tipo === 'minimo_cantera') return 10;
      return 0;
    case 'mercenario':
      return 0; // handled by pledgeMemoryModifier instead — mercenarios only care about active promises
  }
}

// "Memoria de promesas": a club that got burned votes against you; a club you
// kept your word with votes with you. Mercenarios only weigh ACTIVE promises
// (not past fulfilled ones), and weigh broken ones harder.
function pledgeMemoryModifier(state: GameState, teamId: number, trait: PresidentTrait): number {
  const mine = state.pledges.filter((p) => p.teamId === teamId);
  const broken = mine.some((p) => p.status === 'rota');
  const pending = mine.some((p) => p.status === 'pendiente');
  const fulfilledRecently = mine.some((p) => p.status === 'cumplida' && state.year - p.deadlineYear <= 2);

  if (trait === 'mercenario') {
    if (pending) return 25;
    if (broken) return -35;
    return 0;
  }
  if (broken) return -30;
  if (fulfilledRecently) return 20;
  return 0;
}

function interesBase(state: GameState, team: Team, kind: ProposalKind, p: ProposalPayload): number {
  switch (kind) {
    case 'norma_nueva': {
      const { tipo } = payload<NormaNuevaPayload>(p);
      if (tipo === 'tope_salarial') {
        const teams = state.teams.filter(
          (t) => t.federationId === state.playerFederationId && t.divisionOrden !== null,
        );
        const bills = teams.map((t) => wageBill(t.id, state.players)).sort((a, b) => a - b);
        const median = bills[Math.floor(bills.length / 2)] ?? 0;
        return wageBill(team.id, state.players) > median ? -25 : 15;
      }
      return 5; // baseline: mild support for governance in general
    }
    case 'derogar_norma': {
      const { normId } = payload<DerogarNormaPayload>(p);
      const norm = state.norms.find((n) => n.id === normId);
      if (!norm) return 0;
      // Whoever would have opposed creating it wants it gone, and vice versa.
      return -interesBase(state, team, 'norma_nueva', { tipo: norm.tipo, valor: norm.valor });
    }
    case 'cambio_reparto': {
      const { shares } = payload<CambioRepartoPayload>(p);
      const current = state.competitionPrizes.find((cp) => cp.kind === 'liga');
      const currentSpread = current && current.shares.length > 1
        ? current.shares[0] - current.shares[current.shares.length - 1]
        : 0;
      const newSpread = shares.length > 1 ? shares[0] - shares[shares.length - 1] : 0;
      const moreEqual = newSpread < currentSpread;

      const pool = state.teams.filter(
        (t) => t.federationId === state.playerFederationId && t.divisionOrden !== null,
      );
      const sorted = [...pool].sort((a, b) => b.strength - a.strength);
      const rank = sorted.findIndex((t) => t.id === team.id);
      const isTopQuartile = rank >= 0 && rank < Math.ceil(sorted.length * 0.25);
      const isBottomHalf = rank >= Math.floor(sorted.length * 0.5);

      if (moreEqual) return isTopQuartile ? -35 : isBottomHalf ? 30 : 5;
      return isTopQuartile ? 20 : isBottomHalf ? -15 : 0;
    }
    case 'copa_recurrente': {
      const { participantTeamIds } = payload<CopaRecurrentePayload>(p);
      return participantTeamIds.includes(team.id) ? 25 : 10;
    }
    case 'expansion_division':
      // Lower-division teams gain promotion chances; top-flight clubs are neutral.
      return team.divisionOrden !== null && team.divisionOrden > 1 ? 25 : 5;
    case 'cambio_formato':
      return payload<CambioFormatoPayload>(p).format === 'ida_vuelta' ? 10 : -10;
    case 'admision_acelerada':
      return 10; // growing the league is generally popular; no strong opposition group
  }
}

function bucketIntention(score: number): AssemblyVote['intention'] {
  if (score > 10) return 'favor';
  if (score < -10) return 'contra';
  return 'indeciso';
}

function computeVotes(state: GameState, kind: ProposalKind, p: ProposalPayload): AssemblyVote[] {
  const census = state.teams.filter(
    (t) => t.federationId === state.playerFederationId && t.divisionOrden !== null,
  );
  return census.map((team) => {
    const president = presidentOf(state, team.id);
    const trait: PresidentTrait = president?.trait ?? 'institucional';
    const score = interesBase(state, team, kind, p)
      + arraigoModifier(team)
      + traitModifier(trait, kind, p)
      + pledgeMemoryModifier(state, team.id, trait)
      - (president?.grudge ?? 0) / 4;
    return {
      teamId: team.id,
      score,
      intention: bucketIntention(score),
      revealed: trait === 'institucional',
      bought: false,
      pledgeId: null,
      final: null,
    };
  });
}

// ── Payload sanity checks ────────────────────────────────────────────────────

function validatePayload(state: GameState, kind: ProposalKind, p: ProposalPayload): boolean {
  switch (kind) {
    case 'norma_nueva': return true; // addNorm clamps internally
    case 'derogar_norma':
      return state.norms.some((n) => n.id === payload<DerogarNormaPayload>(p).normId);
    case 'cambio_reparto': {
      const { pool, shares } = payload<CambioRepartoPayload>(p);
      return pool >= 0 && shares.length > 0;
    }
    case 'copa_recurrente':
      return payload<CopaRecurrentePayload>(p).participantTeamIds.length >= 2;
    case 'expansion_division':
    case 'cambio_formato':
      return true;
    case 'admision_acelerada': {
      const n = state.negotiations.find((neg) => neg.id === payload<AdmisionAceleradaPayload>(p).negotiationId);
      return !!n && n.byFederationId === state.playerFederationId
        && (n.state === 'gathering_requirements' || n.state === 'accepted');
    }
  }
}

// ── Proposal lifecycle ───────────────────────────────────────────────────────

// force=true spends REPROPOSE_COST PC to bypass a same-season rejection
// cooldown (§4.2). Returns prev unchanged on any guard failure.
export function proposeMeasure(
  prev: GameState,
  kind: ProposalKind,
  p: ProposalPayload,
  force = false,
): GameState {
  const pending = prev.proposals.filter((pp) => pp.status === 'en_tramite').length;
  if (pending >= MAX_PENDING_PROPOSALS) return prev;
  if (PRETEMPORADA_ONLY.includes(kind) && prev.phase !== 'pretemporada') return prev;
  if (!validatePayload(prev, kind, p)) return prev;

  const cooldownActive = prev.proposals.some(
    (pp) => pp.kind === kind && pp.status === 'rechazada' && pp.year === prev.year,
  );

  const s = structuredClone(prev);
  if (cooldownActive) {
    if (!force) return prev;
    if (!spendPC(s, REPROPOSE_COST, `re-presentó una propuesta de ${kind} tras un rechazo`)) return prev;
  }

  s.proposals.push({
    id: s.nextProposalId++,
    kind,
    payload: p,
    majority: MAJORITY_2_3.includes(kind) ? 'dos_tercios' : 'simple',
    year: s.year,
    proposedAtMatchday: s.currentMatchday,
    votes: computeVotes(s, kind, p),
    status: 'en_tramite',
    resolvedAtMatchday: null,
  });
  return s;
}

export function withdrawProposal(prev: GameState, proposalId: number): GameState {
  if (!prev.proposals.some((pp) => pp.id === proposalId && pp.status === 'en_tramite')) return prev;
  const s = structuredClone(prev);
  s.proposals = s.proposals.filter((pp) => pp.id !== proposalId);
  return s;
}

// Consult a club's intention (free for leal/tradicionalista/ambicioso/
// institucional, capped at MAX_MANUAL_REVEALS per proposal; institucional is
// always revealed already; mercenario never reveals).
export function revealIntention(prev: GameState, proposalId: number, teamId: number): GameState {
  const proposal = prev.proposals.find((pp) => pp.id === proposalId && pp.status === 'en_tramite');
  if (!proposal) return prev;
  const vote = proposal.votes.find((v) => v.teamId === teamId);
  if (!vote || vote.revealed) return prev;
  if (presidentOf(prev, teamId)?.trait === 'mercenario') return prev;

  const manualReveals = proposal.votes.filter(
    (v) => v.revealed && presidentOf(prev, v.teamId)?.trait !== 'institucional',
  ).length;
  if (manualReveals >= MAX_MANUAL_REVEALS) return prev;

  const s = structuredClone(prev);
  s.proposals.find((pp) => pp.id === proposalId)!.votes.find((v) => v.teamId === teamId)!.revealed = true;
  return s;
}

export function buyVote(prev: GameState, proposalId: number, teamId: number): GameState {
  const proposal = prev.proposals.find((pp) => pp.id === proposalId && pp.status === 'en_tramite');
  if (!proposal) return prev;
  const vote = proposal.votes.find((v) => v.teamId === teamId);
  if (!vote || vote.bought || vote.score <= SOFT_VOTE_THRESHOLD) return prev;

  const s = structuredClone(prev);
  if (!spendPC(s, BUY_VOTE_COST, 'compró un voto en la asamblea')) return prev;
  s.proposals.find((pp) => pp.id === proposalId)!.votes.find((v) => v.teamId === teamId)!.bought = true;
  return s;
}

export function pledgeForVote(
  prev: GameState,
  proposalId: number,
  teamId: number,
  kind: PledgeKind,
  refId?: number,
  amount?: number,
): GameState {
  const proposal = prev.proposals.find((pp) => pp.id === proposalId && pp.status === 'en_tramite');
  if (!proposal) return prev;
  const vote = proposal.votes.find((v) => v.teamId === teamId);
  if (!vote || vote.pledgeId !== null || vote.score <= SOFT_VOTE_THRESHOLD) return prev;

  const s = structuredClone(prev);
  // mejora_reparto is auto-verified against the reparto's own spread, not a
  // caller-supplied figure: snapshot the current spread as the baseline.
  let finalAmount = amount ?? null;
  if (kind === 'mejora_reparto') {
    const liga = s.competitionPrizes.find((cp) => cp.kind === 'liga');
    finalAmount = liga && liga.shares.length > 1 ? liga.shares[0] - liga.shares[liga.shares.length - 1] : 0;
  }
  const pledge: Pledge = {
    id: s.nextPledgeId++,
    teamId,
    kind,
    refId: refId ?? null,
    amount: finalAmount,
    madeYear: s.year,
    deadlineYear: s.year + 2,
    status: 'pendiente',
  };
  s.pledges.push(pledge);
  s.proposals.find((pp) => pp.id === proposalId)!.votes.find((v) => v.teamId === teamId)!.pledgeId = pledge.id;
  return s;
}

// ── Resolution + dispatch ────────────────────────────────────────────────────

function finalizeVote(state: GameState, vote: AssemblyVote): 'favor' | 'contra' {
  if (vote.bought || vote.pledgeId !== null) return 'favor';
  if (vote.intention !== 'indeciso') return vote.intention;
  const pFavor = Math.min(0.95, Math.max(0.05, 0.5 + vote.score / 40));
  return rngNext(state.politicsRng) < pFavor ? 'favor' : 'contra';
}

function applyAdmisionAcelerada(prev: GameState, negotiationId: number): GameState {
  const n = prev.negotiations.find((neg) => neg.id === negotiationId);
  if (!n || n.byFederationId !== prev.playerFederationId) return prev;
  const s = structuredClone(prev);
  const neg = s.negotiations.find((nn) => nn.id === negotiationId)!;
  if (neg.state === 'gathering_requirements' && neg.requirementsSeasonsLeft > 0) {
    neg.requirementsSeasonsLeft -= 1;
  } else if (neg.state === 'accepted' && neg.effectiveYear !== null && neg.acceptedYear !== null
    && neg.effectiveYear > neg.acceptedYear + 1) {
    neg.effectiveYear -= 1;
  }
  return s;
}

// Dispatches an APPROVED proposal to the existing (unilateral) engine function
// it wraps. Every call site must re-assign the result — this returns a NEW
// GameState, it does not mutate in place (matching addNorm/setLeaguePrize/
// createCup/runLevelingLeague/setLeagueFormat, which all clone internally).
export function applyApprovedProposal(state: GameState, proposal: AssemblyProposal): GameState {
  switch (proposal.kind) {
    case 'norma_nueva': {
      const { tipo, valor } = payload<NormaNuevaPayload>(proposal.payload);
      return addNorm(state, tipo, valor);
    }
    case 'derogar_norma':
      return removeNorm(state, payload<DerogarNormaPayload>(proposal.payload).normId);
    case 'cambio_reparto': {
      const { pool, shares } = payload<CambioRepartoPayload>(proposal.payload);
      return setLeaguePrize(state, pool, shares);
    }
    case 'copa_recurrente': {
      const { name, tipo, formato, categoria, participantTeamIds } = payload<CopaRecurrentePayload>(proposal.payload);
      return createCup(state, name, tipo, formato, categoria, participantTeamIds, true);
    }
    case 'expansion_division':
      return runLevelingLeague(state, payload<ExpansionDivisionPayload>(proposal.payload).plan);
    case 'cambio_formato':
      return setLeagueFormat(state, payload<CambioFormatoPayload>(proposal.payload).format);
    case 'admision_acelerada':
      return applyAdmisionAcelerada(state, payload<AdmisionAceleradaPayload>(proposal.payload).negotiationId);
  }
}

// Tallies final votes for one pending proposal, marks it aprobada/rechazada,
// and applies it if approved. Must be called as `s = resolveProposal(s, id)`.
export function resolveProposal(prev: GameState, proposalId: number): GameState {
  const proposal = prev.proposals.find((pp) => pp.id === proposalId && pp.status === 'en_tramite');
  if (!proposal) return prev;

  let s = structuredClone(prev);
  const p = s.proposals.find((pp) => pp.id === proposalId)!;
  let favor = 0;
  for (const vote of p.votes) {
    vote.final = finalizeVote(s, vote);
    if (vote.final === 'favor') favor++;
  }
  const total = p.votes.length;
  const threshold = p.majority === 'dos_tercios' ? Math.ceil((2 / 3) * total) : Math.floor(total / 2) + 1;
  const passed = total > 0 && favor >= threshold;
  p.status = passed ? 'aprobada' : 'rechazada';
  p.resolvedAtMatchday = s.currentMatchday;

  logFederation(s, {
    year: s.year,
    matchday: 0,
    type: 'assembly_result',
    title: passed ? 'La asamblea aprobó una propuesta' : 'La asamblea rechazó una propuesta',
    detail: `${p.kind} — ${favor}/${total} votos a favor`,
    value: null,
    teamId: null,
  });

  if (passed) s = applyApprovedProposal(s, p);
  return s;
}

// Called at the top of startSeason/advanceMatchday and as a closeSeason
// safety net. Resolves every currently-pending proposal (capped at
// MAX_PENDING_PROPOSALS, so this is always cheap).
export function resolveAllPendingProposals(prev: GameState): GameState {
  let s = prev;
  const pendingIds = s.proposals.filter((p) => p.status === 'en_tramite').map((p) => p.id);
  for (const id of pendingIds) s = resolveProposal(s, id);
  return s;
}
