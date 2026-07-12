// Featured matches (Fase 15D). Pure derivation from data that already
// exists — no new state, no new rng, nothing persisted. Same fidelity-tiers
// lesson as VirtuaFC: the cheap Poisson kernel is the default for every
// match; this is the rich envelope built ONLY for the handful the
// commissioner would actually want to read about.
//
// Scoped to LEAGUE matches (MatchReport) because that's the only match type
// with goal-level detail (minute + scorer). Cup matches (CupMatch) only
// store the final scoreline — no goalscorers, no minutes — so a cup final
// can't get the same chronology without first teaching cup simulation to
// emit MatchReports too. Left as a follow-up; not force-fit here.

import { computeStandings } from './standings';
import { detectRivalries } from './headlines';
import type { GameState, MatchReport, Team } from './types';

export type FeaturedTag = 'derbi' | 'titulo' | 'goleada' | 'remontada' | 'hat_trick';

export interface FeaturedMoment {
  minute: number;
  teamId: number | null; // null when the scorer isn't a tracked Player (no squad data)
  playerName: string | null;
  runningScore: string; // "home-away" immediately after this goal
}

export interface FeaturedReport {
  matchday: number;
  divisionOrden: number;
  homeId: number;
  homeName: string;
  awayId: number;
  awayName: string;
  homeGoals: number;
  awayGoals: number;
  tags: FeaturedTag[];
  moments: FeaturedMoment[];
  narrative: string;
}

const BLOWOUT_MARGIN = 4;
const TITLE_RACE_LAST_N_MATCHDAYS = 3;
const TITLE_RACE_TOP_N = 3;
const TITLE_RACE_MAX_GAP = 3;
const HAT_TRICK_GOALS = 3;

function detectDerby(s: GameState, report: MatchReport): boolean {
  return detectRivalries(s).some(
    (r) =>
      (r.teamAId === report.homeId && r.teamBId === report.awayId) ||
      (r.teamAId === report.awayId && r.teamBId === report.homeId),
  );
}

// Both teams inside the D1 top 3, separated by a tight point gap, in the
// closing stretch of the season — a duel that actually decides something.
function detectTitleRace(s: GameState, report: MatchReport): boolean {
  if (report.divisionOrden !== 1) return false;
  if (s.totalMatchdays <= 0) return false;
  if (report.matchday < s.totalMatchdays - TITLE_RACE_LAST_N_MATCHDAYS + 1) return false;

  const teams = s.teams.filter(
    (t) => t.divisionOrden === 1 && t.federationId === s.playerFederationId,
  );
  const upToNow = s.results.filter((r) => r.divisionOrden === 1 && r.matchday <= report.matchday);
  const table = computeStandings(teams, upToNow);

  const homePos = table.findIndex((r) => r.teamId === report.homeId);
  const awayPos = table.findIndex((r) => r.teamId === report.awayId);
  if (homePos === -1 || awayPos === -1) return false;
  if (homePos >= TITLE_RACE_TOP_N || awayPos >= TITLE_RACE_TOP_N) return false;

  return Math.abs(table[homePos].points - table[awayPos].points) <= TITLE_RACE_MAX_GAP;
}

// Reconstructs the running score goal-by-goal. Goalscorers don't carry a
// team field directly — it's derived from the scorer's Player.teamId.
function buildMoments(s: GameState, report: MatchReport): FeaturedMoment[] {
  const teamOf = new Map(s.players.map((p) => [p.id, p.teamId]));
  const nameOf = new Map(s.players.map((p) => [p.id, p.name]));
  const sorted = [...report.goalscorers].sort((a, b) => a.minute - b.minute);

  let home = 0;
  let away = 0;
  const moments: FeaturedMoment[] = [];
  for (const g of sorted) {
    const teamId = teamOf.get(g.playerId) ?? null;
    if (teamId === report.homeId) home++;
    else if (teamId === report.awayId) away++;
    moments.push({
      minute: g.minute,
      teamId,
      playerName: nameOf.get(g.playerId) ?? null,
      runningScore: `${home}-${away}`,
    });
  }
  return moments;
}

// A genuine lead SWAP (home leading -> away leading, or vice versa), not
// just the first goal establishing an initial lead.
function detectComeback(moments: FeaturedMoment[], report: MatchReport): boolean {
  let leader: 'home' | 'away' | null = null;
  let home = 0;
  let away = 0;
  let swaps = 0;
  for (const m of moments) {
    if (m.teamId === report.homeId) home++;
    else if (m.teamId === report.awayId) away++;
    else continue; // unknown scorer team — skip, can't place it on the timeline

    const newLeader = home > away ? 'home' : away > home ? 'away' : null;
    if (newLeader && leader && newLeader !== leader) swaps++;
    if (newLeader) leader = newLeader;
  }
  return swaps > 0;
}

function detectHatTrick(report: MatchReport): number | null {
  const counts = new Map<number, number>();
  for (const g of report.goalscorers) counts.set(g.playerId, (counts.get(g.playerId) ?? 0) + 1);
  for (const [playerId, count] of counts) {
    if (count >= HAT_TRICK_GOALS) return playerId;
  }
  return null;
}

const TAG_LABEL: Record<FeaturedTag, string> = {
  derbi: 'Derbi',
  titulo: 'Duelo directo por el título',
  goleada: 'Goleada',
  remontada: 'Remontada',
  hat_trick: 'Hat-trick',
};

function buildNarrative(
  s: GameState,
  report: MatchReport,
  home: Team,
  away: Team,
  tags: FeaturedTag[],
  hatTrickPlayerId: number | null,
): string {
  const labels = tags.map((t) => TAG_LABEL[t]).join(' · ');
  let text = `${labels}: ${home.name} ${report.homeGoals}-${report.awayGoals} ${away.name}.`;
  if (hatTrickPlayerId !== null) {
    const scorer = s.players.find((p) => p.id === hatTrickPlayerId);
    if (scorer) text += ` Hat-trick de ${scorer.name}.`;
  }
  return text;
}

// Returns null if the match doesn't qualify as featured by any criterion.
export function buildFeaturedReport(s: GameState, report: MatchReport): FeaturedReport | null {
  const home = s.teams.find((t) => t.id === report.homeId);
  const away = s.teams.find((t) => t.id === report.awayId);
  if (!home || !away) return null;

  const tags: FeaturedTag[] = [];
  if (detectDerby(s, report)) tags.push('derbi');
  if (detectTitleRace(s, report)) tags.push('titulo');
  if (Math.abs(report.homeGoals - report.awayGoals) >= BLOWOUT_MARGIN) tags.push('goleada');

  const moments = buildMoments(s, report);
  if (detectComeback(moments, report)) tags.push('remontada');
  const hatTrickPlayerId = detectHatTrick(report);
  if (hatTrickPlayerId !== null) tags.push('hat_trick');

  if (tags.length === 0) return null;

  return {
    matchday: report.matchday,
    divisionOrden: report.divisionOrden,
    homeId: report.homeId,
    homeName: home.name,
    awayId: report.awayId,
    awayName: away.name,
    homeGoals: report.homeGoals,
    awayGoals: report.awayGoals,
    tags,
    moments,
    narrative: buildNarrative(s, report, home, away, tags, hatTrickPlayerId),
  };
}

export function isFeaturedMatch(s: GameState, report: MatchReport): boolean {
  return buildFeaturedReport(s, report) !== null;
}
