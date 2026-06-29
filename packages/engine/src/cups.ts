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
const CUP_CREATION_COST = 2_000_000;

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

function buildMatch(homeId: number, awayId: number, leg?: 'ida' | 'vuelta'): CupMatch {
  if (homeId === BYE && awayId !== BYE) {
    return { homeTeamId: BYE, awayTeamId: awayId, homeGoals: 0, awayGoals: 1, played: true, winnerTeamId: awayId, leg };
  }
  if (awayId === BYE && homeId !== BYE) {
    return { homeTeamId: homeId, awayTeamId: BYE, homeGoals: 1, awayGoals: 0, played: true, winnerTeamId: homeId, leg };
  }
  return { homeTeamId: homeId, awayTeamId: awayId, homeGoals: null, awayGoals: null, played: false, winnerTeamId: null, leg };
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
  recurring = false,
): GameState {
  // Competitions must exist BEFORE the season starts so the calendar can
  // include them (§4.8). Once temporada is running, no new cups may be added.
  if (prev.phase !== 'pretemporada') return prev;
  if (prev.treasury < CUP_CREATION_COST) return prev;
  const trimmed = name.trim();
  if (trimmed.length === 0) return prev;
  const unique = Array.from(new Set(participantTeamIds));
  if (unique.length < 2 || unique.length > MAX_PARTICIPANTS) return prev;
  for (const id of unique) if (!isCompetingPlayerTeam(prev, id)) return prev;

  const s = structuredClone(prev);
  s.treasury -= CUP_CREATION_COST;
  let firstRound: CupMatch[];
  let secondRound: CupMatch[] | null = null;
  if (formato === 'liga') {
    // Single round-robin among all participants (everyone plays everyone once).
    firstRound = generateFixtures(unique, s.cupsRng, 0, 1).map((f) =>
      buildMatch(f.homeId, f.awayId),
    );
  } else {
    // Shuffle real teams, then pair the first `byes` each with a BYE (auto-advance),
    // and pair the remaining teams against each other. This guarantees no BYE-BYE pairs,
    // which would otherwise produce winners=null and corrupt the bracket structure.
    const shuffled = shuffle([...unique], s.cupsRng);
    const byes = nextPowerOf2(shuffled.length) - shuffled.length;
    const isIV = formato === 'eliminatoria_ida_vuelta';
    firstRound = [];
    for (let i = 0; i < byes; i++) {
      firstRound.push(buildMatch(shuffled[i], BYE, isIV ? 'ida' : undefined));
    }
    for (let i = byes; i < shuffled.length; i += 2) {
      firstRound.push(buildMatch(shuffled[i], shuffled[i + 1], isIV ? 'ida' : undefined));
    }
    if (isIV) {
      secondRound = [];
      for (let i = 0; i < byes; i++) {
        secondRound.push(buildMatch(BYE, shuffled[i], 'vuelta'));
      }
      for (let i = byes; i < shuffled.length; i += 2) {
        secondRound.push(buildMatch(shuffled[i + 1], shuffled[i], 'vuelta'));
      }
    }
  }
  const rounds: CupRound[] = [{ numero: 1, matches: firstRound, ...(formato === 'eliminatoria_ida_vuelta' ? { leg: 'ida' as const } : {}) }];
  if (secondRound) rounds.push({ numero: 2, matches: secondRound, leg: 'vuelta' as const });
  s.cups.push({
    id: s.nextCupId++,
    name: trimmed,
    tipo,
    formato,
    categoria,
    year: s.year,
    status: 'en_curso',
    participantTeamIds: unique,
    rounds,
    championTeamId: null,
    recurring,
  });
  return s;
}

function playPendingInRound(
  s: GameState,
  round: CupRound,
  categoria: CupCategory,
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
// For ida_vuelta cups, looks back further to find the last completed leg
// (vuelta leg) that has winners, since ida legs don't determine winners.
function ensureNextKnockoutRound(cup: Cup, numero: number): void {
  if (cup.rounds.some((r) => r.numero === numero)) return;

  // Find the most recent round that has actual winners (vuelta legs for ida_vuelta,
  // any round for single-leg). Walk backwards until we find one.
  let prev: CupRound | undefined;
  for (let i = cup.rounds.length - 1; i >= 0; i--) {
    const r = cup.rounds[i];
    const hasWinners = r.matches.some((m) => m.winnerTeamId !== null);
    if (hasWinners) { prev = r; break; }
  }
  if (!prev) return;

  const winners = prev.matches
    .map((m) => m.winnerTeamId)
    .filter((id): id is number => id !== null);
  const nextMatches: CupMatch[] = [];
  const isIdaVuelta = cup.formato === 'eliminatoria_ida_vuelta';
  const leg = isIdaVuelta ? 'ida' as const : undefined;
  for (let i = 0; i < winners.length; i += 2) {
    nextMatches.push(buildMatch(winners[i], winners[i + 1] ?? BYE, leg));
  }
  cup.rounds.push({ numero, matches: nextMatches, ...(isIdaVuelta ? { leg: 'ida' as const } : {}) });
  // For ida_vuelta, also create the corresponding vuelta round immediately.
  if (isIdaVuelta && nextMatches.length > 0 && winners.length >= 2) {
    const vueltaMatches: CupMatch[] = [];
    for (let i = 0; i < winners.length; i += 2) {
      vueltaMatches.push(buildMatch(winners[i + 1] ?? BYE, winners[i], 'vuelta'));
    }
    cup.rounds.push({ numero: numero + 1, matches: vueltaMatches, leg: 'vuelta' as const });
  }
}

// Number of rounds a cup will play in total. Used by scheduleCups so the
// calendar can place each round at (i-0.5)·T/R inside the league season.
// For ida_vuelta, each logical round produces 2 legs (ida + vuelta).
export function roundsForCup(cup: Cup): number {
  if (cup.formato === 'liga') return 1;
  const n = nextPowerOf2(Math.max(2, cup.participantTeamIds.length));
  const knockoutRounds = Math.ceil(Math.log2(n));
  return cup.formato === 'eliminatoria_ida_vuelta' ? knockoutRounds * 2 : knockoutRounds;
}

// Compute aggregate winner for a two-leg matchup (ida + vuelta).
// Returns the winning teamId, or null if still pending.
function computeTwoLegWinner(idaMatches: CupMatch[], vueltaMatches: CupMatch[], s: GameState, categoria: CupCategory): void {
  for (let i = 0; i < idaMatches.length; i++) {
    const ida = idaMatches[i];
    const vuelta = vueltaMatches[i];
    if (!ida || !vuelta) continue;
    if (!ida.played || !vuelta.played) continue;

    const idaHome = ida.homeTeamId;
    const idaAway = ida.awayTeamId;
    // In vuelta, home/away are reversed: vuelta.home = ida.away, vuelta.away = ida.home
    const aggHome = (ida.homeGoals ?? 0) + (vuelta.awayGoals ?? 0); // ida home team's total goals
    const aggAway = (ida.awayGoals ?? 0) + (vuelta.homeGoals ?? 0); // ida away team's total goals

    if (aggHome > aggAway) {
      ida.winnerTeamId = idaHome;
      vuelta.winnerTeamId = idaHome;
    } else if (aggAway > aggHome) {
      ida.winnerTeamId = idaAway;
      vuelta.winnerTeamId = idaAway;
    } else {
      // Away goals: the ida away team scored more in the ida home venue? No —
      // away goals means the team that played away in the first leg scores at home.
      // Equivalently: compare ida.awayGoals vs vuelta.awayGoals.
      // ida away team's away goals = ida.awayGoals; ida home team's away goals = vuelta.awayGoals
      if ((ida.awayGoals ?? 0) > (vuelta.awayGoals ?? 0)) {
        ida.winnerTeamId = idaAway;
        vuelta.winnerTeamId = idaAway;
      } else if ((vuelta.awayGoals ?? 0) > (ida.awayGoals ?? 0)) {
        ida.winnerTeamId = idaHome;
        vuelta.winnerTeamId = idaHome;
      } else {
        // Penalties
        const home = s.teams.find((t) => t.id === idaHome);
        const away = s.teams.find((t) => t.id === idaAway);
        if (home && away) {
          const penalties = simulatePenalties(s.cupsRng, effectiveTeam(home, categoria), effectiveTeam(away, categoria));
          const penWinner = penalties.homePenalties > penalties.awayPenalties ? idaHome : idaAway;
          ida.winnerTeamId = penWinner;
          vuelta.winnerTeamId = penWinner;
        } else {
          ida.winnerTeamId = idaHome;
          vuelta.winnerTeamId = idaHome;
        }
      }
    }
  }
}

// Determine single-match winner (for single-leg knockout).
function determineMatchWinners(round: CupRound, s: GameState, categoria: CupCategory): void {
  for (const m of round.matches) {
    if (!m.played || m.winnerTeamId !== null) continue;
    const home = s.teams.find((t) => t.id === m.homeTeamId);
    const away = s.teams.find((t) => t.id === m.awayTeamId);
    if (!home || !away) { m.winnerTeamId = home?.id ?? away?.id ?? null; continue; }
    if ((m.homeGoals ?? 0) > (m.awayGoals ?? 0)) m.winnerTeamId = home.id;
    else if ((m.awayGoals ?? 0) > (m.homeGoals ?? 0)) m.winnerTeamId = away.id;
    else {
      const penalties = simulatePenalties(s.cupsRng, effectiveTeam(home, categoria), effectiveTeam(away, categoria));
      m.winnerTeamId = penalties.homePenalties > penalties.awayPenalties ? home.id : away.id;
    }
  }
}

function crownChampion(s: GameState, cup: Cup): void {
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
    playPendingInRound(s, round, cup.categoria);
    crownLeagueCup(s, cup);
    crownChampion(s, cup);
    return;
  }

  const isIdaVuelta = cup.formato === 'eliminatoria_ida_vuelta';

  if (isIdaVuelta) {
    const currentRound = cup.rounds.find((r) => r.numero === roundNumero);
    if (!currentRound) return;

    if (currentRound.leg !== 'ida') {
      // This is a vuelta leg — play it and compute aggregate.
      playPendingInRound(s, currentRound, cup.categoria);
      // Find the matching ida round (numero - 1).
      const matchingIda = cup.rounds.find((r) => r.numero === roundNumero - 1);
      if (matchingIda) {
        computeTwoLegWinner(matchingIda.matches, currentRound.matches, s, cup.categoria);
      }
      // Create the next logical round's ida+vuelta from aggregate winners.
      // Only when there are >=2 winners (the final produces exactly 1 winner).
      const aggregateWinners = currentRound.matches
        .map((m) => m.winnerTeamId)
        .filter((id): id is number => id !== null);
      if (aggregateWinners.length >= 2) {
        ensureNextKnockoutRound(cup, roundNumero + 1);
      }
    } else {
      // This is an ida leg — just play it (vuelta will come on next matchday).
      playPendingInRound(s, currentRound, cup.categoria);
    }

    // Check if this was the final: the last vuelta leg determines the champion.
    const lastVuelta = cup.rounds.filter((r) => r.leg === 'vuelta').pop();
    if (currentRound.leg === 'vuelta' && lastVuelta && lastVuelta.numero === roundNumero) {
      // Vuelta leg of the final was just completed — crown the champion.
      const winners = currentRound.matches
        .map((m) => m.winnerTeamId)
        .filter((id): id is number => id !== null);
      if (winners.length <= 1) {
        cup.championTeamId = winners[0] ?? null;
        cup.status = 'finalizada';
        crownChampion(s, cup);
      }
    }
    return;
  }

  // Single-leg knockout: play the round, determine winners, advance.
  ensureNextKnockoutRound(cup, roundNumero);
  const round = cup.rounds.find((r) => r.numero === roundNumero);
  if (!round) return;
  playPendingInRound(s, round, cup.categoria);
  determineMatchWinners(round, s, cup.categoria);

  const winners = round.matches
    .map((m) => m.winnerTeamId)
    .filter((id): id is number => id !== null);
  if (winners.length <= 1) {
    cup.championTeamId = winners[0] ?? null;
    cup.status = 'finalizada';
    crownChampion(s, cup);
  }
}

// Build the calendar slots for every in-progress cup in the current year.
// Each round i of R is placed at round((i-0.5)·T/R), clamped to [1, T] so
// the rounds spread evenly through the league matchdays.
// For ida_vuelta, each pair of consecutive legs (ida+vuelta) shares a slot
// range and are placed on consecutive matchdays.
export function scheduleCups(s: GameState, totalMatchdays: number): CupScheduleEntry[] {
  if (totalMatchdays <= 0) return [];
  const schedule: CupScheduleEntry[] = [];
  for (const cup of s.cups) {
    if (cup.status === 'finalizada') continue;
    if (cup.year !== s.year) continue;
    const R = roundsForCup(cup);
    if (cup.formato === 'eliminatoria_ida_vuelta') {
      // Each logical round occupies 2 legs on consecutive matchdays.
      const logicalRounds = R / 2;
      for (let i = 1; i <= logicalRounds; i++) {
        const raw = Math.round(((i - 0.5) * totalMatchdays) / logicalRounds);
        const md = Math.min(totalMatchdays, Math.max(1, raw));
        const idaNumero = i * 2 - 1;
        const vueltaNumero = i * 2;
        schedule.push({ matchday: md, cupId: cup.id, roundNumero: idaNumero });
        schedule.push({ matchday: Math.min(totalMatchdays, md + 1), cupId: cup.id, roundNumero: vueltaNumero });
      }
    } else {
      for (let i = 1; i <= R; i++) {
        const raw = Math.round(((i - 0.5) * totalMatchdays) / R);
        const md = Math.min(totalMatchdays, Math.max(1, raw));
        schedule.push({ matchday: md, cupId: cup.id, roundNumero: i });
      }
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

// Force every incomplete cup to finish before the season closes.
// Iterates rounds (playing any unplayed matches) until a champion is crowned or
// the safety limit is hit, then falls back to emergency crowning.
export function forceCompleteIncompleteCups(s: GameState): void {
  for (const cup of s.cups) {
    if (cup.status === 'finalizada') continue;

    // TypeScript narrows cup.status to 'en_curso' after the check above, but
    // playCupRound mutates it to 'finalizada'. Cast avoids the spurious error.
    for (let guard = 0; guard < 40 && (cup.status as string) !== 'finalizada'; guard++) {
      // Find the lowest-numbered round that still has unplayed matches.
      const nextRound = [...cup.rounds]
        .sort((a, b) => a.numero - b.numero)
        .find(r => r.matches.some(m => !m.played));

      if (nextRound) {
        playCupRound(s, cup.id, nextRound.numero);
      } else {
        // All rounds are played but no champion yet (multi-round knockout
        // that needs a new round generated). Try creating the next round.
        const lastRound = cup.rounds.reduce((a, b) => a.numero > b.numero ? a : b);
        const nextNum = lastRound.numero + 1;
        if (!cup.rounds.some(r => r.numero === nextNum)) {
          ensureNextKnockoutRound(cup, nextNum);
        }
        // If still no new round was generated, bail to emergency.
        if (!cup.rounds.some(r => r.numero === nextNum)) break;
      }
    }

    // Emergency fallback: crown the winner from the latest round that has one.
    if ((cup.status as string) !== 'finalizada') {
      const allWinners = [...cup.rounds]
        .sort((a, b) => b.numero - a.numero)
        .flatMap(r => r.matches.map(m => m.winnerTeamId))
        .filter((id): id is number => id !== null);
      cup.championTeamId = allWinners[0] ?? cup.participantTeamIds[0] ?? null;
      cup.status = 'finalizada';
      crownChampion(s, cup);
    }
  }
}

// Save templates from completed recurring cups and recreate them for next season.
export function saveRecurringCupTemplates(s: GameState): void {
  // Remove old templates and save new ones from this season's completed recurring cups.
  s.cupTemplates = s.cups
    .filter((c) => c.recurring && c.status === 'finalizada')
    .map((c) => ({
      name: c.name,
      tipo: c.tipo,
      formato: c.formato,
      categoria: c.categoria,
      participantTeamIds: c.participantTeamIds,
    }));
}

// Recreate recurring cups from templates. Called at the start of each new pretemporada.
export function recreateRecurringCups(s: GameState): void {
  if (s.cupTemplates.length === 0) return;
  // All teams currently competing in the player's league — used to add newcomers.
  const allCompetingIds = new Set(
    s.teams
      .filter(t => t.federationId === s.playerFederationId && t.divisionOrden !== null)
      .map(t => t.id),
  );

  for (const tmpl of s.cupTemplates) {
    // Keep original participants that still exist, plus any new competing teams
    // not yet in the list (so the recurring cup grows as the league grows).
    const validIds = [
      ...tmpl.participantTeamIds.filter(id => allCompetingIds.has(id)),
      ...[...allCompetingIds].filter(id => !tmpl.participantTeamIds.includes(id)),
    ];
    if (validIds.length < 2) continue;
    // Use the createCup logic inline to avoid re-charging treasury.
    let firstRound: CupMatch[];
    let secondRound: CupMatch[] | null = null;
    if (tmpl.formato === 'liga') {
      firstRound = generateFixtures(validIds, s.cupsRng, 0, 1).map((f) =>
        buildMatch(f.homeId, f.awayId),
      );
    } else {
      const shuffled = shuffle([...validIds], s.cupsRng);
      const byes = nextPowerOf2(shuffled.length) - shuffled.length;
      const isIV = tmpl.formato === 'eliminatoria_ida_vuelta';
      firstRound = [];
      for (let i = 0; i < byes; i++) {
        firstRound.push(buildMatch(shuffled[i], BYE, isIV ? 'ida' : undefined));
      }
      for (let i = byes; i < shuffled.length; i += 2) {
        firstRound.push(buildMatch(shuffled[i], shuffled[i + 1], isIV ? 'ida' : undefined));
      }
      if (isIV) {
        secondRound = [];
        for (let i = 0; i < byes; i++) {
          secondRound.push(buildMatch(BYE, shuffled[i], 'vuelta'));
        }
        for (let i = byes; i < shuffled.length; i += 2) {
          secondRound.push(buildMatch(shuffled[i + 1], shuffled[i], 'vuelta'));
        }
      }
    }
    const rounds: CupRound[] = [{ numero: 1, matches: firstRound, ...(tmpl.formato === 'eliminatoria_ida_vuelta' ? { leg: 'ida' as const } : {}) }];
    if (secondRound) rounds.push({ numero: 2, matches: secondRound, leg: 'vuelta' as const });
    s.cups.push({
      id: s.nextCupId++,
      name: tmpl.name,
      tipo: tmpl.tipo,
      formato: tmpl.formato,
      categoria: tmpl.categoria,
      year: s.year,
      status: 'en_curso',
      participantTeamIds: validIds,
      rounds,
      championTeamId: null,
      recurring: true,
    });
  }
}
