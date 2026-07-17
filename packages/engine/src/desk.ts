// Fase 17E: el despacho semanal. Three lightweight per-matchday trays
// (prime time, referees for hot matches, a press question) that densify
// advancing a jornada without ever blocking it — every tray auto-resolves
// deterministically when the commissioner never opens the desk. Entirely
// gated on players.length > 0 (matches every other Fase 17 sub-phase), so
// player-less golden runs are byte-identical to before this file existed.
// Referees NEVER touch a match result — they only modulate the spawn chance
// of a linked `arbitraje_dudoso` event, rolled from the dedicated deskRng
// stream (never eventsRng).

import { rngNext } from './rng';
import { randomDirectorName } from './names';
import { detectRivalries, generateHeadlines } from './headlines';
import { hasSomethingAtStake } from './integrity';
import { computeStandings } from './standings';
import { spawnRefereeEvent } from './events';
import type { DeskDecisions, Fixture, GameState, Referee, RefereeTrait } from './types';
import type { RngState } from './rng';

const PRIMETIME_BONUS = 50_000;
const PRIMETIME_DROUGHT_THRESHOLD = 8;
const PRIMETIME_DROUGHT_MAX_HITS = 3; // max −3 arraigo/season per club

const HOT_MATCH_WINDOW = 5; // "últimas 5 jornadas"
const ESTRELLA_FATIGUE_GAP = 3; // can pitch again once md - lastHotMatchday >= 3 (1-in-3 cadence)
const NOVATO_PROMOTE_AT = 4; // consecutive clean hot matches -> promotes to estricto

const EVENT_PROB_BASE = 0.15;
const EVENT_PROB_ESTRELLA = 0.075; // -50%
const EVENT_PROB_NOVATO = 0.225; // +50%

const PRESS_PROB = 0.35;
const EVASION_STREAK = 3;
const EVASION_OPINION_PENALTY = 3;

const REFEREE_TRAITS: RefereeTrait[] = ['estricto', 'permisivo', 'estrella', 'novato'];

export function generateReferee(rng: RngState, id: number): Referee {
  return {
    id,
    name: randomDirectorName(rng),
    trait: REFEREE_TRAITS[Math.floor(rngNext(rng) * REFEREE_TRAITS.length)] ?? 'estricto',
    hotMatchesClean: 0,
    lastHotMatchday: 0,
  };
}

function isHotMatch(s: GameState, fixture: Fixture): boolean {
  if (fixture.divisionOrden !== 1) return false;
  const isDerby = detectRivalries(s).some(
    (r) =>
      (r.teamAId === fixture.homeId && r.teamBId === fixture.awayId) ||
      (r.teamAId === fixture.awayId && r.teamBId === fixture.homeId),
  );
  if (isDerby) return true;

  if (s.totalMatchdays <= 0) return false;
  const remaining = s.totalMatchdays - fixture.matchday;
  if (remaining < 0 || remaining > HOT_MATCH_WINDOW - 1) return false;

  const div1Teams = s.teams.filter((t) => t.federationId === s.playerFederationId && t.divisionOrden === 1);
  const table = computeStandings(div1Teams, s.results.filter((r) => r.divisionOrden === 1));
  return hasSomethingAtStake(table, fixture.homeId, remaining) && hasSomethingAtStake(table, fixture.awayId, remaining);
}

function pickAutoReferee(s: GameState, md: number): Referee | undefined {
  const eligible = s.referees.filter((r) => {
    if (r.trait === 'novato') return false;
    if (r.trait === 'estrella' && r.lastHotMatchday > 0 && md - r.lastHotMatchday < ESTRELLA_FATIGUE_GAP) return false;
    return true;
  });
  if (eligible.length === 0) return undefined;
  return [...eligible].sort((a, b) => a.lastHotMatchday - b.lastHotMatchday)[0];
}

export interface DeskFixtureDto {
  homeId: number;
  homeName: string;
  awayId: number;
  awayName: string;
}

export interface DeskInboxResult {
  matchday: number;
  primetimeCandidates: DeskFixtureDto[];
  hotMatches: DeskFixtureDto[];
  availableReferees: Referee[];
  pressQuestionEligible: boolean;
  pending: DeskDecisions | null;
}

// Pure derivation of the current matchday's trays — never mutates, never
// rolls RNG. The press question's eligibility is deterministic (was last
// matchday's headline strong?); whether it actually manifests is rolled by
// applyDesk when the matchday is advanced, so repeated GETs stay consistent.
export function deskInbox(s: GameState): DeskInboxResult {
  const md = s.currentMatchday;
  const byId = new Map(s.teams.map((t) => [t.id, t]));
  const toDto = (f: { homeId: number; awayId: number }): DeskFixtureDto => ({
    homeId: f.homeId,
    homeName: byId.get(f.homeId)?.name ?? '—',
    awayId: f.awayId,
    awayName: byId.get(f.awayId)?.name ?? '—',
  });

  const div1Fixtures = s.fixtures.filter((f) => f.matchday === md && f.divisionOrden === 1);
  const hot = div1Fixtures.filter((f) => isHotMatch(s, f));
  const headlines = generateHeadlines(s); // already reflects the matchday just played (currentMatchday - 1)

  return {
    matchday: md,
    primetimeCandidates: div1Fixtures.map(toDto),
    hotMatches: hot.map(toDto),
    availableReferees: s.referees,
    pressQuestionEligible: md > 1 && headlines.length > 0,
    pending: s.deskPending && s.deskPending.matchday === md ? s.deskPending : null,
  };
}

// Stages a partial decision for the upcoming matchday. Validates references
// against this matchday's actual fixtures/referee pool before mutating —
// guard failures return prev unchanged (identity check == no-op).
export function setDeskDecisions(
  prev: GameState,
  patch: Partial<Omit<DeskDecisions, 'matchday'>>,
): GameState {
  if (prev.phase !== 'temporada') return prev;
  const md = prev.currentMatchday;
  const div1Fixtures = prev.fixtures.filter((f) => f.matchday === md && f.divisionOrden === 1);
  if (div1Fixtures.length === 0) return prev;

  if (patch.primetimeMatch) {
    const ok = div1Fixtures.some(
      (f) => f.homeId === patch.primetimeMatch!.homeId && f.awayId === patch.primetimeMatch!.awayId,
    );
    if (!ok) return prev;
  }
  if (patch.refereeAssignments) {
    for (const ra of patch.refereeAssignments) {
      const fixtureOk = div1Fixtures.some((f) => f.homeId === ra.homeId && f.awayId === ra.awayId);
      const refOk = prev.referees.some((r) => r.id === ra.refereeId);
      if (!fixtureOk || !refOk) return prev;
    }
  }

  const s = structuredClone(prev);
  const base: DeskDecisions =
    s.deskPending && s.deskPending.matchday === md
      ? s.deskPending
      : { matchday: md, primetimeMatch: null, refereeAssignments: [], pressAnswer: null };

  s.deskPending = {
    matchday: md,
    primetimeMatch: patch.primetimeMatch !== undefined ? patch.primetimeMatch : base.primetimeMatch,
    refereeAssignments: patch.refereeAssignments !== undefined ? patch.refereeAssignments : base.refereeAssignments,
    pressAnswer: patch.pressAnswer !== undefined ? patch.pressAnswer : base.pressAnswer,
  };
  return s;
}

// Called at the top of advanceMatchday, before this matchday's fixtures are
// simulated. Applies any staged decision, auto-resolves the rest, and clears
// deskPending. In-place mutation on the already-cloned state.
//
// Only acts on matchdays the commissioner actually staged a decision for
// (setDeskDecisions called this matchday). A passive playthrough that never
// opens the desk must stay byte-identical to before this sub-phase existed —
// no deskRng consumed, no arraigo/opinion side effects for choices the
// player never made, and critically no `arbitraje_dudoso` event that could
// block auto-advance the way any other pending event does. The feature is
// entirely opt-in per matchday, not a background auto-pilot.
export function applyDesk(s: GameState): void {
  if (s.players.length === 0) return;

  const md = s.currentMatchday;
  const pending = s.deskPending && s.deskPending.matchday === md ? s.deskPending : null;
  if (!pending) {
    s.deskPending = null;
    return;
  }

  // ── Press question, reacting to the matchday just played ─────────────
  if (md > 1) {
    const headlines = generateHeadlines(s);
    if (headlines.length > 0 && rngNext(s.deskRng) < PRESS_PROB) {
      const answer = pending?.pressAnswer ?? 'evasiva';
      if (answer === 'institucional') {
        s.boardConfidence.value = Math.min(100, s.boardConfidence.value + 2);
        s.publicOpinion = Math.max(0, s.publicOpinion - 1);
        s.consecutiveEvasions = 0;
      } else if (answer === 'populista') {
        s.publicOpinion = Math.min(100, s.publicOpinion + 3);
        s.boardConfidence.value = Math.max(0, s.boardConfidence.value - 2);
        s.consecutiveEvasions = 0;
      } else {
        s.consecutiveEvasions += 1;
        if (s.consecutiveEvasions >= EVASION_STREAK) {
          s.publicOpinion = Math.max(0, s.publicOpinion - EVASION_OPINION_PENALTY);
          s.consecutiveEvasions = 0;
        }
      }
    }
  }

  const div1Fixtures = s.fixtures.filter((f) => f.matchday === md && f.divisionOrden === 1);
  if (div1Fixtures.length === 0) {
    s.deskPending = null;
    return;
  }

  // ── Prime time (deterministic, no RNG) ────────────────────────────────
  const byId = new Map(s.teams.map((t) => [t.id, t]));
  let chosen = pending?.primetimeMatch
    ? div1Fixtures.find(
        (f) => f.homeId === pending.primetimeMatch!.homeId && f.awayId === pending.primetimeMatch!.awayId,
      )
    : undefined;
  if (!chosen) {
    chosen = [...div1Fixtures].sort((a, b) => {
      const sa = (byId.get(a.homeId)?.strength ?? 0) + (byId.get(a.awayId)?.strength ?? 0);
      const sb = (byId.get(b.homeId)?.strength ?? 0) + (byId.get(b.awayId)?.strength ?? 0);
      return sb - sa;
    })[0];
  }
  s.primetimeSeasonBonus += PRIMETIME_BONUS;
  for (const t of s.teams) {
    if (t.federationId !== s.playerFederationId || t.divisionOrden !== 1) continue;
    if (chosen && (t.id === chosen.homeId || t.id === chosen.awayId)) {
      s.primetimeDrought[t.id] = 0;
    } else {
      const cur = (s.primetimeDrought[t.id] ?? 0) + 1;
      s.primetimeDrought[t.id] = cur;
      if (
        cur % PRIMETIME_DROUGHT_THRESHOLD === 0 &&
        cur <= PRIMETIME_DROUGHT_THRESHOLD * PRIMETIME_DROUGHT_MAX_HITS
      ) {
        t.arraigo = Math.max(0, t.arraigo - 1);
      }
    }
  }

  // ── Referees for hot matches ───────────────────────────────────────────
  const hotFixtures = div1Fixtures.filter((f) => isHotMatch(s, f));
  for (const f of hotFixtures) {
    const manual = pending?.refereeAssignments.find((ra) => ra.homeId === f.homeId && ra.awayId === f.awayId);
    let ref = manual ? s.referees.find((r) => r.id === manual.refereeId) : undefined;
    if (!ref) ref = pickAutoReferee(s, md);
    if (!ref) continue;

    ref.lastHotMatchday = md;
    const prob =
      ref.trait === 'estrella' ? EVENT_PROB_ESTRELLA : ref.trait === 'novato' ? EVENT_PROB_NOVATO : EVENT_PROB_BASE;
    if (rngNext(s.deskRng) < prob) {
      ref.hotMatchesClean = 0;
      const targetTeamId = rngNext(s.deskRng) < 0.5 ? f.homeId : f.awayId;
      spawnRefereeEvent(s, md, targetTeamId);
    } else {
      ref.hotMatchesClean += 1;
      if (ref.trait === 'novato' && ref.hotMatchesClean >= NOVATO_PROMOTE_AT) {
        ref.trait = 'estricto';
        ref.hotMatchesClean = 0;
      }
    }
  }

  s.deskPending = null;
}
