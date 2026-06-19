// Functional core: every function takes a GameState and returns a NEW one.
// No I/O, no React, no DB. structuredClone keeps it pure at the boundary while
// staying readable inside. The imperative shell (backend) owns persistence.

import { makeRng, randInt } from './rng';
import { buildDivisionFixtures } from './fixtures';
import { simulateMatch } from './match';
import { computeStandings, type StandingRow } from './standings';
import { progressNegotiations } from './negotiation';
import { divisionName, PROMOTION_RELEGATION } from './structure';
import {
  generateContractOffers,
  processEconomy,
  STARTING_TREASURY,
} from './economy';
import {
  applyPointPenalties,
  governancePenalty,
  pointPenaltiesForYear,
} from './norms';
import {
  attributeMatchGoals,
  settleSeasonAwards,
  tickAvailability,
} from './awards';
import { expireStaleEvents, maybeSpawnEvent, pendingEvents } from './events';
import { playCupRound, scheduleCups } from './cups';
import { payLeaguePrize } from './prizes';
import { runTransferWindow } from './transfers';
import type {
  CreateGameOptions,
  Division,
  Federation,
  Fixture,
  GameState,
  Player,
  PlayerSeed,
  Team,
} from './types';

// Modest real-ish clubs: the design doc starts every game with 10 teams the
// player picks, possibly from lower divisions.
const DEFAULT_TEAM_NAMES = [
  'Atlético Riveras',
  'Unión Porteña',
  'Deportivo Sauces',
  'CD Maravillas',
  'Racing del Valle',
  'Sporting Aldea',
  'CF Peñalba',
  'Club Marítimo',
  'AD Ferroviaria',
  'Real Montaña',
];

const DEFAULT_IMPULSES_PER_SEASON = 3;
const DEFAULT_STARTING_PRESTIGE = 20;
const DEFAULT_ARRAIGO = 50;

// Building a club from scratch (§4.3): slow path — starts weak in the lowest
// division, no tier/negotiation needed, but it costs money (§5 tension). High
// arraigo: it is your own creation, hard for rivals to poach.
export const CREATE_TEAM_COST = 5_000_000;
const CREATED_TEAM_STRENGTH = 35;
const CREATED_TEAM_ARRAIGO = 75;

function teamsInDivision(teams: Team[], orden: number): Team[] {
  return teams.filter((t) => t.divisionOrden === orden);
}

export function createGame(seed: number, options: CreateGameOptions = {}): GameState {
  const impulsesPerSeason = options.impulsesPerSeason ?? DEFAULT_IMPULSES_PER_SEASON;
  const startingPrestige = options.startingPrestige ?? DEFAULT_STARTING_PRESTIGE;
  const playerFederationId = 1;

  const rng = makeRng(seed);
  const federations: Federation[] = [
    {
      id: playerFederationId,
      name: options.playerFederationName ?? 'Federación del Comisionado',
      prestige: startingPrestige,
      isPlayer: true,
    },
  ];

  const teams: Team[] = [];
  const players: Player[] = [];
  let nextTeamId = 1;
  let nextPlayerId = 1;

  if (options.teams && options.teams.length > 0) {
    for (const t of options.teams) {
      const teamId = nextTeamId++;
      teams.push({
        id: teamId,
        name: t.name,
        strength: t.strength,
        federationId: playerFederationId,
        arraigo: t.arraigo ?? DEFAULT_ARRAIGO,
        divisionOrden: 1,
        youthStrength: t.youthStrength ?? Math.max(20, t.strength - 12),
      });
      if (t.squad) {
        for (const p of t.squad) {
          players.push({
            id: nextPlayerId++,
            teamId,
            name: p.name,
            posicion: p.posicion,
            calidad: p.calidad,
            season: {
              goals: 0,
              assists: 0,
              cleanSheets: 0,
              yellowCards: 0,
              redCards: 0,
            },
            matchesSuspendedLeft: 0,
            injuredMatchesLeft: 0,
          });
        }
      }
    }
  } else {
    const names = options.teamNames ?? DEFAULT_TEAM_NAMES;
    for (const name of names) {
      const strength = 45 + Math.floor(randInt(rng, 0, 25)); // 45..70 (default)
      teams.push({
        id: nextTeamId++,
        name,
        strength,
        federationId: playerFederationId,
        arraigo: DEFAULT_ARRAIGO,
        divisionOrden: 1,
        youthStrength: Math.max(20, strength - 12),
      });
    }
  }

  // Rival federations and their external teams (negotiation targets, not yet
  // in any division of the player's league).
  let nextFederationId = 2;
  for (const rival of options.rivals ?? []) {
    const rivalId = nextFederationId++;
    federations.push({
      id: rivalId,
      name: rival.name,
      prestige: rival.prestige,
      isPlayer: false,
    });
    for (const rt of rival.teams) {
      teams.push({
        id: nextTeamId++,
        name: rt.name,
        strength: rt.strength,
        federationId: rivalId,
        arraigo: rt.arraigo,
        divisionOrden: null,
        youthStrength: Math.max(20, rt.strength - 12),
      });
    }
  }

  const divisions: Division[] = [{ orden: 1, name: divisionName(1) }];

  // A fresh game lands in pretemporada (§4.8): the commissioner sets up
  // competitions/contracts/prizes BEFORE calling startSeason, which builds the
  // calendar and switches the phase to temporada.
  return {
    seed: seed >>> 0,
    rng,
    year: 1,
    phase: 'pretemporada',
    prestige: startingPrestige,
    playerFederationId,
    leagueFormat: 'ida_vuelta',
    federations,
    divisions,
    teams,
    negotiations: [],
    nextNegotiationId: 1,
    players,
    awards: [],
    attributionRng: makeRng((seed ^ 0xcafebabe) >>> 0),
    nextPlayerId,
    events: [],
    eventsRng: makeRng((seed ^ 0xdeadbeef) >>> 0),
    nextEventId: 1,
    cups: [],
    cupsRng: makeRng((seed ^ 0xfeedface) >>> 0),
    nextCupId: 1,
    cupSchedule: [],
    transfersRng: makeRng((seed ^ 0xfade1eaf) >>> 0),
    transfers: [],
    competitionPrizes: [],
    nextPrizeId: 1,
    prizePayments: [],
    treasury: options.startingTreasury ?? STARTING_TREASURY,
    economy: { talentInvestment: 0 },
    commercialContracts: [],
    contractOffers: generateContractOffers(
      seed >>> 0,
      1,
      startingPrestige,
      teams.filter((t) => t.divisionOrden !== null).length,
    ),
    lastEconomy: null,
    nextContractId: 1,
    norms: [],
    sanctions: [],
    nextNormId: 1,
    nextSanctionId: 1,
    fixtures: [],
    results: [],
    currentMatchday: 0,
    totalMatchdays: 0,
    impulsesPerSeason,
    impulsesRemaining: impulsesPerSeason,
    pendingImpulses: [],
    history: [],
    seasonOver: false,
  };
}

// Build the season's calendar and switch to temporada. Called once per year
// after the pretemporada window (§4.8). Interleaves cup rounds with the league
// fixtures (Fase 6.2): each cup's R rounds land at (i-0.5)·T/R inside the
// season so advanceMatchday plays them in stride.
export function startSeason(prev: GameState): GameState {
  if (prev.phase !== 'pretemporada') return prev;
  const s = structuredClone(prev);
  const { fixtures, total } = buildDivisionFixtures(
    s.teams,
    s.divisions,
    s.rng,
    s.leagueFormat === 'ida' ? 1 : 2,
  );
  s.fixtures = fixtures;
  s.totalMatchdays = total;
  s.currentMatchday = total > 0 ? 1 : 0;
  s.results = [];
  s.pendingImpulses = [];
  s.cupSchedule = scheduleCups(s, total);
  s.seasonOver = total === 0; // no fixtures => trivially "over"
  s.phase = 'temporada';
  return s;
}

export function applyImpulse(
  prev: GameState,
  fixture: Fixture,
  favoredTeamId: number,
): GameState {
  if (prev.impulsesRemaining <= 0) return prev;
  if (fixture.matchday < prev.currentMatchday) return prev;
  const already = prev.pendingImpulses.some(
    (p) =>
      p.matchday === fixture.matchday &&
      p.homeId === fixture.homeId &&
      p.awayId === fixture.awayId,
  );
  if (already) return prev;

  const s = structuredClone(prev);
  s.pendingImpulses.push({
    matchday: fixture.matchday,
    homeId: fixture.homeId,
    awayId: fixture.awayId,
    favoredTeamId,
  });
  s.impulsesRemaining -= 1;
  return s;
}

// Build a club from scratch into the lowest division (§4.3). It starts weak
// and only competes from next season (this season's fixtures are already set).
// Costs money — can't build what you can't afford (§5).
export function createOwnTeam(
  prev: GameState,
  name: string,
  squad?: PlayerSeed[],
): GameState {
  if (prev.phase !== 'pretemporada') return prev;
  const trimmed = name.trim();
  if (trimmed.length === 0) return prev;
  if (prev.treasury < CREATE_TEAM_COST) return prev;

  const s = structuredClone(prev);
  const lowestOrden = s.divisions.reduce((m, d) => Math.max(m, d.orden), 1);
  const nextId = s.teams.reduce((m, t) => Math.max(m, t.id), 0) + 1;
  s.teams.push({
    id: nextId,
    name: trimmed,
    strength: CREATED_TEAM_STRENGTH,
    federationId: s.playerFederationId,
    arraigo: CREATED_TEAM_ARRAIGO,
    divisionOrden: lowestOrden,
    youthStrength: Math.max(20, CREATED_TEAM_STRENGTH - 12),
  });
  if (squad) {
    for (const p of squad) {
      s.players.push({
        id: s.nextPlayerId++,
        teamId: nextId,
        name: p.name,
        posicion: p.posicion,
        calidad: p.calidad,
        season: {
          goals: 0,
          assists: 0,
          cleanSheets: 0,
          yellowCards: 0,
          redCards: 0,
        },
        matchesSuspendedLeft: 0,
        injuredMatchesLeft: 0,
      });
    }
  }
  s.treasury -= CREATE_TEAM_COST;
  return s;
}

export function advanceMatchday(prev: GameState): GameState {
  if (prev.phase !== 'temporada') return prev;
  if (prev.seasonOver) return prev;
  const s = structuredClone(prev);
  const md = s.currentMatchday;
  const byId = new Map(s.teams.map((t) => [t.id, t]));
  const playingTeams = new Set<number>();
  for (const fx of s.fixtures) {
    if (fx.matchday === md) {
      playingTeams.add(fx.homeId);
      playingTeams.add(fx.awayId);
    }
  }
  // §7 tick: a suspension/injury of N matchdays counts down one for every
  // matchday the team plays. Done before the match so a 1-match ban exactly
  // means "miss the next match".
  tickAvailability(s, playingTeams);

  for (const fx of s.fixtures.filter((f) => f.matchday === md)) {
    const home = byId.get(fx.homeId);
    const away = byId.get(fx.awayId);
    if (!home || !away) continue;
    const imp = s.pendingImpulses.find(
      (p) => p.matchday === md && p.homeId === fx.homeId && p.awayId === fx.awayId,
    );
    const { homeGoals, awayGoals } = simulateMatch(home, away, s.rng, imp?.favoredTeamId);
    s.results.push({ ...fx, homeGoals, awayGoals });
    attributeMatchGoals(s, fx.homeId, fx.awayId, homeGoals, awayGoals);
  }

  s.pendingImpulses = s.pendingImpulses.filter((p) => p.matchday !== md);

  // Fase 6.2: play any cup rounds scheduled for this matchday. Uses the
  // independent cupsRng so the match engine stream stays golden-stable.
  for (const entry of s.cupSchedule.filter((e) => e.matchday === md)) {
    playCupRound(s, entry.cupId, entry.roundNumero);
  }

  // Independent-rng event spawn (§1, §2): rare polémicas to resolve.
  maybeSpawnEvent(s, md);
  s.currentMatchday = md + 1;
  if (s.currentMatchday > s.totalMatchdays) s.seasonOver = true;
  return s;
}

// Simulate matchdays until the season ends OR a polémica pops up that needs
// resolving (§1 "resuelve los conflictos puntuales").
export function advanceSeason(prev: GameState): GameState {
  if (prev.phase !== 'temporada') return prev;
  let s = prev;
  while (!s.seasonOver && pendingEvents(s).length === 0) s = advanceMatchday(s);
  return s;
}

// Change how the league is contested (§4.4). Structural decision — only valid
// in pretemporada; startSeason will use this flag when building the calendar.
export function setLeagueFormat(
  prev: GameState,
  format: GameState['leagueFormat'],
): GameState {
  if (prev.phase !== 'pretemporada') return prev;
  if (prev.leagueFormat === format) return prev;
  const s = structuredClone(prev);
  s.leagueFormat = format;
  return s;
}

// Closes the finished season: writes one history record per division, moves
// player prestige from top-flight performance, advances negotiations, applies
// promotion/relegation, then lands in pretemporada of the next year (the
// commissioner sets up competitions/contracts/prizes before the next startSeason).
export function closeSeason(prev: GameState): GameState {
  if (prev.phase !== 'temporada') return prev;
  if (!prev.seasonOver) return prev;
  const s = structuredClone(prev);

  // Final table per division (computed before any promotion changes).
  const penalties = pointPenaltiesForYear(s, s.year);
  const standingsByOrden = new Map<number, StandingRow[]>();
  for (const d of s.divisions) {
    standingsByOrden.set(
      d.orden,
      applyPointPenalties(
        computeStandings(
          teamsInDivision(s.teams, d.orden),
          s.results.filter((r) => r.divisionOrden === d.orden),
        ),
        penalties,
      ),
    );
  }

  // Player prestige is driven by the top flight (division 1).
  const top = standingsByOrden.get(1) ?? [];
  const topTeams = teamsInDivision(s.teams, 1);
  const titleRaceGap =
    top.length > 0 ? top[0].points - top[Math.min(2, top.length - 1)].points : 0;
  const meanStrength =
    topTeams.length > 0
      ? topTeams.reduce((acc, t) => acc + t.strength, 0) / topTeams.length
      : 55;

  let delta = Math.round((meanStrength - 55) / 4) - 1; // -1 base decay
  if (titleRaceGap <= 3) delta += 3;
  else if (titleRaceGap <= 6) delta += 2;
  else if (titleRaceGap <= 10) delta += 1;

  // Fase 6.5: pay the league prize from the final top-flight standings before
  // processEconomy so it sees the payment in s.prizePayments.
  payLeaguePrize(s);

  // Federation finances for the just-closed season (§4.5 + §5 tension). Pure,
  // no state.rng — keeps the match engine deterministic and golden-stable.
  const { econDelta, talentBump } = processEconomy(s);
  delta += econDelta;
  delta += governancePenalty(s); // §4.7: unchecked breaches erode credibility

  const prestigeBefore = s.prestige;
  s.prestige = Math.max(0, s.prestige + delta);
  const playerFed = s.federations.find((f) => f.id === s.playerFederationId);
  if (playerFed) playerFed.prestige = s.prestige;

  for (const d of s.divisions) {
    const st = standingsByOrden.get(d.orden) ?? [];
    if (st.length === 0) continue;
    const champion = st[0];
    s.history.push({
      year: s.year,
      divisionOrden: d.orden,
      championId: champion.teamId,
      championName: champion.name,
      points: champion.points,
      prestigeBefore,
      prestigeAfter: s.prestige,
      delta,
    });
  }

  // §6 awards from the just-closed year (no-op if no players are loaded).
  settleSeasonAwards(s);

  // Unresolved polémicas from the closed year expire and cost prestige (§1).
  expireStaleEvents(s, s.year);

  // Teams evolve on their own (commissioner doesn't manage squads). Drift keeps
  // seasons from being identical and makes "advance season" worth watching.
  for (const t of s.teams) {
    t.strength = Math.min(85, Math.max(35, t.strength + randInt(s.rng, -3, 3)));
  }
  // Talent formation lifts the league's quality (deterministic, post-drift).
  if (talentBump > 0) {
    for (const t of s.teams) {
      if (t.divisionOrden !== null) {
        t.strength = Math.min(85, t.strength + talentBump);
      }
    }
  }

  s.year += 1;
  progressNegotiations(s); // §4.2 timers compare against the new year

  // Fase 6.4: transfer window between seasons. Mutates s.players (teamId) and
  // recomputes team.strength from the squad when players are tracked. Uses an
  // independent rng, so player-less default games are byte-identical.
  runTransferWindow(s);

  // Promotion / relegation between adjacent divisions (§1).
  if (s.divisions.length >= 2) {
    const byId = new Map(s.teams.map((t) => [t.id, t]));
    for (let d = 1; d < s.divisions.length; d++) {
      const upper = standingsByOrden.get(d) ?? [];
      const lower = standingsByOrden.get(d + 1) ?? [];
      const pr = Math.min(
        PROMOTION_RELEGATION,
        Math.floor(Math.min(upper.length, lower.length) / 2),
      );
      for (const r of upper.slice(upper.length - pr)) {
        const t = byId.get(r.teamId);
        if (t) t.divisionOrden = d + 1;
      }
      for (const r of lower.slice(0, pr)) {
        const t = byId.get(r.teamId);
        if (t) t.divisionOrden = d;
      }
    }
  }

  // Land in pretemporada with no calendar — startSeason builds it once the
  // commissioner has staged the new year's competitions/contracts/prizes (§4.8).
  s.fixtures = [];
  s.totalMatchdays = 0;
  s.results = [];
  s.currentMatchday = 0;
  s.cupSchedule = [];
  s.impulsesRemaining = s.impulsesPerSeason;
  s.pendingImpulses = [];
  s.seasonOver = false;
  s.phase = 'pretemporada';
  return s;
}
