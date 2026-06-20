// Cups / tournaments (§4.4): knockout OR round-robin ("liga") brackets that
// run alongside the league and conclude at season close. A cup can be for the
// first team or the youth (cantera) sides. Pure functions; an INDEPENDENT
// cupsRng so the match-engine stream stays golden-stable (default tests create
// no cups => zero rng consumption => golden idempotent).

import { rngNext, type RngState } from './rng';
import { generateFixtures } from './fixtures';
import { simulateMatch } from './match';
import { payCupPrize } from './prizes';
import { computeStandings } from './standings';
import type {
  Cup,
  CupCategory,
  CupFormat,
  CupMatch,
  CupRound,
  CupScheduleEntry,
  CupType,
  GameState,
  MatchResult,
  Team,
} from './types';

const BYE = -1;
const MAX_PARTICIPANTS = 32;

function simulatePenalties(rng: RngState, home: Team, away: Team): { homePenalties: number; awayPenalties: number } {
  let homeP = 0;
  let awayP = 0;
  const homeAdv = home.strength / (home.strength + away.strength);
  for (let i = 0; i < 5; i++) {
    if (rngNext(rng) < 0.4 + homeAdv * 0.3) homeP++;
    if (rngNext(rng) < 0.4 + (1 - homeAdv) * 0.3) awayP++;
  }
  while (homeP === awayP) {
    if (rngNext(rng) < 0.4 + homeAdv * 0.3) homeP++;
    if (rngNext(rng) < 0.4 + (1 - homeAdv) * 0.3) awayP++;
  }
  return { homePenalties: homeP, awayPenalties: awayP };
}

function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function shuffle<T>(arr: T[], rng: RngState): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rngNext(rng) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function buildMatch(homeId: number, awayId: number): CupMatch {
  if (homeId === BYE && awayId !== BYE) {
    return { homeTeamId: BYE, awayTeamId: awayId, homeGoals: 0, awayGoals: 1, played: true, winnerTeamId: awayId };
  }
  if (awayId === BYE && homeId !== BYE) {
    return { homeTeamId: homeId, awayTeamId: BYE, homeGoals: 1, awayGoals: 0, played: true, winnerTeamId: homeId };
  }
  return { homeTeamId: homeId, awayTeamId: awayId, homeGoals: null, awayGoals: null, played: false, winnerTeamId: null };
}

function isCompetingPlayerTeam(state: GameState, teamId: number): boolean {
  const t = state.teams.find((x) => x.id === teamId);
  return (
    !!t &&
    t.divisionOrden !== null &&
    t.federationId === state.playerFederationId
  );
}

// Youth (cantera) competitions use the academy side's strength.
function effectiveTeam(team: Team, categoria: CupCategory): Team {
  return categoria === 'juvenil' ? { ...team, strength: team.youthStrength } : team;
}

export function createCup(
  prev: GameState,
  name: string,
  tipo: CupType,
  formato: CupFormat,
  categoria: CupCategory,
  participantTeamIds: number[],
): GameState {
  // Competitions must exist BEFORE the season starts so the calendar can
  // include them (§4.8). Once temporada is running, no new cups may be added.
  if (prev.phase !== 'pretemporada') return prev;
  const trimmed = name.trim();
  if (trimmed.length === 0) return prev;
  const unique = Array.from(new Set(participantTeamIds));
  if (unique.length < 2 || unique.length > MAX_PARTICIPANTS) return prev;
  for (const id of unique) if (!isCompetingPlayerTeam(prev, id)) return prev;

  const s = structuredClone(prev);
  let firstRound: CupMatch[];
  if (formato === 'liga') {
    // Single round-robin among all participants (everyone plays everyone once).
    firstRound = generateFixtures(unique, s.cupsRng, 0, 1).map((f) =>
      buildMatch(f.homeId, f.awayId),
    );
  } else {
    const padded = [...unique];
    while (padded.length < nextPowerOf2(unique.length)) padded.push(BYE);
    const shuffled = shuffle(padded, s.cupsRng);
    firstRound = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      firstRound.push(buildMatch(shuffled[i], shuffled[i + 1]));
    }
  }
  s.cups.push({
    id: s.nextCupId++,
    name: trimmed,
    tipo,
    formato,
    categoria,
    year: s.year,
    status: 'en_curso',
    participantTeamIds: unique,
    rounds: [{ numero: 1, matches: firstRound }],
    championTeamId: null,
  });
  return s;
}

function playPendingInRound(
  s: GameState,
  round: CupRound,
  categoria: CupCategory,
  knockout: boolean,
): void {
  for (const m of round.matches) {
    if (m.played) continue;
    const home = s.teams.find((t) => t.id === m.homeTeamId);
    const away = s.teams.find((t) => t.id === m.awayTeamId);
    if (!home || !away) {
      m.played = true;
      m.winnerTeamId = home?.id ?? away?.id ?? null;
      continue;
    }
    const { homeGoals, awayGoals } = simulateMatch(
      effectiveTeam(home, categoria),
      effectiveTeam(away, categoria),
      s.cupsRng,
    );
    m.homeGoals = homeGoals;
    m.awayGoals = awayGoals;
    if (homeGoals > awayGoals) m.winnerTeamId = home.id;
    else if (awayGoals > homeGoals) m.winnerTeamId = away.id;
    else if (knockout) {
      const penalties = simulatePenalties(s.cupsRng, home, away);
      m.winnerTeamId = penalties.homePenalties > penalties.awayPenalties ? home.id : away.id;
    }
    else m.winnerTeamId = null; // league draws have no winner
    m.played = true;
  }
}

function crownLeagueCup(s: GameState, cup: Cup): void {
  const round = cup.rounds[0];
  const teams = s.teams.filter((t) => cup.participantTeamIds.includes(t.id));
  const results: MatchResult[] = round.matches.map((m) => ({
    matchday: 1,
    divisionOrden: 0,
    homeId: m.homeTeamId,
    awayId: m.awayTeamId,
    homeGoals: m.homeGoals ?? 0,
    awayGoals: m.awayGoals ?? 0,
  }));
  const table = computeStandings(teams, results);
  cup.championTeamId = table[0]?.teamId ?? null;
  cup.status = 'finalizada';
}

// Generate the next knockout round from the winners of the last played one.
// Idempotent: returns silently if the round already exists.
function ensureNextKnockoutRound(cup: Cup, numero: number): void {
  if (cup.rounds.some((r) => r.numero === numero)) return;
  const prev = cup.rounds[cup.rounds.length - 1];
  if (!prev) return;
  const winners = prev.matches
    .map((m) => m.winnerTeamId)
    .filter((id): id is number => id !== null);
  const nextMatches: CupMatch[] = [];
  for (let i = 0; i < winners.length; i += 2) {
    nextMatches.push(buildMatch(winners[i], winners[i + 1] ?? BYE));
  }
  cup.rounds.push({ numero, matches: nextMatches });
}

// Number of rounds a cup will play in total. Used by scheduleCups so the
// calendar can place each round at (i-0.5)·T/R inside the league season.
export function roundsForCup(cup: Cup): number {
  if (cup.formato === 'liga') return 1;
  const n = nextPowerOf2(Math.max(2, cup.participantTeamIds.length));
  return Math.ceil(Math.log2(n));
}

// Play one scheduled cup round inside advanceMatchday (Fase 6.2). Pure on
// `s.cups[*]` + `s.cupsRng`; never touches state.rng so the match engine
// stream stays golden-stable.
export function playCupRound(s: GameState, cupId: number, roundNumero: number): void {
  const cup = s.cups.find((c) => c.id === cupId);
  if (!cup || cup.status === 'finalizada') return;

  if (cup.formato === 'liga') {
    // Round-robin: one round contains every match; play it whole and crown.
    const round = cup.rounds[0];
    if (!round) return;
    playPendingInRound(s, round, cup.categoria, false);
    crownLeagueCup(s, cup);
    if (cup.championTeamId) {
      const champion = s.teams.find(t => t.id === cup.championTeamId);
      if (champion) {
        const participants = cup.participantTeamIds
          .map(id => s.teams.find(t => t.id === id))
          .filter((t): t is Team => !!t && t.id !== cup.championTeamId);
        const avgStrength = participants.reduce((a, t) => a + t.strength, 0) / participants.length;
        if (champion.strength + 15 < avgStrength) {
          const fed = s.federations.find(f => f.id === champion.federationId);
          if (fed) fed.prestige += 2;
          if (champion.federationId === s.playerFederationId) s.prestige += 2;
        }
      }
    }
    payCupPrize(s, cup); // Fase 6.5
    return;
  }

  // Knockout: ensure the round exists (built from the prior winners) and play it.
  ensureNextKnockoutRound(cup, roundNumero);
  const round = cup.rounds.find((r) => r.numero === roundNumero);
  if (!round) return;
  playPendingInRound(s, round, cup.categoria, true);

  // If only one team advances, this was the final → crown the champion.
  const winners = round.matches
    .map((m) => m.winnerTeamId)
    .filter((id): id is number => id !== null);
  if (winners.length <= 1) {
    cup.championTeamId = winners[0] ?? null;
    cup.status = 'finalizada';
    if (cup.championTeamId) {
      const champion = s.teams.find(t => t.id === cup.championTeamId);
      if (champion) {
        const participants = cup.participantTeamIds
          .map(id => s.teams.find(t => t.id === id))
          .filter((t): t is Team => !!t && t.id !== cup.championTeamId);
        const avgStrength = participants.reduce((a, t) => a + t.strength, 0) / participants.length;
        if (champion.strength + 15 < avgStrength) {
          const fed = s.federations.find(f => f.id === champion.federationId);
          if (fed) fed.prestige += 2;
          if (champion.federationId === s.playerFederationId) s.prestige += 2;
        }
      }
    }
    payCupPrize(s, cup); // Fase 6.5
  }
}

// Build the calendar slots for every in-progress cup in the current year.
// Each round i of R is placed at round((i-0.5)·T/R), clamped to [1, T] so
// the rounds spread evenly through the league matchdays.
export function scheduleCups(s: GameState, totalMatchdays: number): CupScheduleEntry[] {
  if (totalMatchdays <= 0) return [];
  const schedule: CupScheduleEntry[] = [];
  for (const cup of s.cups) {
    if (cup.status === 'finalizada') continue;
    if (cup.year !== s.year) continue;
    const R = roundsForCup(cup);
    for (let i = 1; i <= R; i++) {
      const raw = Math.round(((i - 0.5) * totalMatchdays) / R);
      const md = Math.min(totalMatchdays, Math.max(1, raw));
      schedule.push({ matchday: md, cupId: cup.id, roundNumero: i });
    }
  }
  // Stable order: by matchday, then by cup id, then by round.
  return schedule.sort(
    (a, b) =>
      a.matchday - b.matchday ||
      a.cupId - b.cupId ||
      a.roundNumero - b.roundNumero,
  );
}

export function activeCups(state: GameState): Cup[] {
  return state.cups.filter((c) => c.status === 'en_curso');
}
