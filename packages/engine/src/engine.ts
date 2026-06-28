// Functional core: every function takes a GameState and returns a NEW one.
// No I/O, no React, no DB. structuredClone keeps it pure at the boundary while
// staying readable inside. The imperative shell (backend) owns persistence.

import { makeRng, randInt, rngNext } from './rng';
import { buildDivisionFixtures } from './fixtures';
import { simulateMatch } from './match';
import { computeStandings, type StandingRow } from './standings';
import { progressNegotiations, rivalPoachAttempt } from './negotiation';
import { divisionName, PROMOTION_RELEGATION } from './structure';
import {
  generateContractOffers,
  processEconomy,
  STARTING_TREASURY,
} from './economy';
import {
  applyPointPenalties,
  decayViolationHistory,
  governancePenalty,
  governanceBonus,
  pointPenaltiesForYear,
} from './norms';
import {
  attributeMatchGoals,
  settleSeasonAwards,
  tickAvailability,
} from './awards';
import { expireStaleEvents, maybeSpawnEvent, pendingEvents } from './events';
import { playCupRound, scheduleCups, saveRecurringCupTemplates, recreateRecurringCups } from './cups';
import { payLeaguePrize } from './prizes';
import { runTransferWindow } from './transfers';
import { simulateRivalLeagues, driftRivalStrengths, updateRivalPrestige } from './rival-sim';
import type {
  BoardMandate,
  CreateGameOptions,
  Division,
  Federation,
  Fixture,
  GameState,
  GlobalRanking,
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
const DEFAULT_STADIUM_CAPACITY = 25_000;
const DEFAULT_ACADEMIA = 40;

function teamsInDivision(teams: Team[], orden: number, federationId?: number): Team[] {
  return teams.filter((t) => {
    if (t.divisionOrden !== orden) return false;
    if (federationId !== undefined && t.federationId !== federationId) return false;
    return true;
  });
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
      confederationId: 0,
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
        wageCap: 0,
        stadiumCapacity: t.stadiumCapacity ?? DEFAULT_STADIUM_CAPACITY,
        academia: t.academia ?? DEFAULT_ACADEMIA,
      });
      if (t.squad) {
        for (const p of t.squad) {
          players.push({
            id: nextPlayerId++,
            teamId,
            name: p.name,
            posicion: p.posicion,
            calidad: p.calidad,
            age: 20 + Math.floor(randInt(rng, 0, 10)),
            season: {
              goals: 0,
              assists: 0,
              cleanSheets: 0,
              yellowCards: 0,
              redCards: 0,
            },
            matchesSuspendedLeft: 0,
            injuredMatchesLeft: 0,
            nationality: p.nationality ?? 'local',
            cantera: p.cantera ?? false,
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
        wageCap: 0,
        stadiumCapacity: DEFAULT_STADIUM_CAPACITY,
        academia: DEFAULT_ACADEMIA,
      });
    }
  }

  // Rival federations and their external teams (negotiation targets, not yet
  // in any division of the player's league). Each rival federation gets its
  // own divisions when seed data is provided (Fase 9).
  let nextFederationId = 2;
  const rivalDivisions: Division[] = [];
  for (const rival of options.rivals ?? []) {
    const rivalId = nextFederationId++;
    federations.push({
      id: rivalId,
      name: rival.name,
      prestige: rival.prestige,
      isPlayer: false,
      confederationId: rival.confederationId ?? 0,
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
        wageCap: 0,
        stadiumCapacity: DEFAULT_STADIUM_CAPACITY,
        academia: DEFAULT_ACADEMIA,
      });
    }
  }

  // Fase 9: if confederations are provided, create divisions for rival federations
  // and assign rival teams to their respective divisions.
  if (options.confederations && options.confederations.length > 0) {
    let rivalDivOrden = 1;
    for (const conf of options.confederations) {
      if (!conf.available) continue;
      // Each league in the confederation becomes a division for its federation
      for (const league of conf.leagues) {
        // Find the federation for this league's country
        const rivalFed = federations.find(f => f.name.includes(league.country) || f.name.includes(league.name) || f.name === league.name);
        if (!rivalFed) continue;
        // Find teams belonging to this league's country
        const leagueTeams = teams.filter(t => t.federationId === rivalFed.id && t.divisionOrden === null);
        if (leagueTeams.length === 0) continue;
        const divOrden = rivalDivOrden++;
        rivalDivisions.push({
          orden: divOrden,
          name: league.name,
          federationId: rivalFed.id,
        });
        // Assign teams to this division (by strength, top to bottom)
        const sorted = [...leagueTeams].sort((a, b) => b.strength - a.strength);
        for (const t of sorted) {
          t.divisionOrden = divOrden;
        }
      }
    }
  }

  const divisions: Division[] = [
    { orden: 1, name: divisionName(1), federationId: playerFederationId },
    ...rivalDivisions,
  ];

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
    cupTemplates: [],
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
    violationHistory: {},
    fixtures: [],
    results: [],
    matchReports: [],
    currentMatchday: 0,
    totalMatchdays: 0,
    impulsesPerSeason,
    impulsesRemaining: impulsesPerSeason,
    pendingImpulses: [],
    actionHistory: [],
    nextActionId: 1,
    rivalActions: [],
    globalRankings: [],
    history: [],
    seasonOver: false,
    eventStrengthPenalty: 0,
    eventCapacityPenaltyPct: 0,
    eventImpulseLoss: 0,
    eventTreasuryInjection: 0,
    poachCooldowns: {},
    confederations: [],
    rivalRng: makeRng((seed ^ 0xabcd1234) >>> 0),
    rivalStandings: {},
    rivalChampions: [],
    mandates: [],
    nextMandateId: 1,
    consecutiveMandateFails: 0,
    mandatesRng: makeRng((seed ^ 0xb4a4d3c2) >>> 0),
  };
}

// ─── Board mandates (Batch 4) ────────────────────────────────────────────────

function playerLeagueTeamCount(s: GameState): number {
  return s.teams.filter(
    (t) => t.federationId === s.playerFederationId && t.divisionOrden !== null,
  ).length;
}

function generateMandate(s: GameState): BoardMandate {
  const roll = randInt(s.mandatesRng, 0, 2);
  if (roll === 0) {
    const target = Math.max(1, s.prestige - 5);
    return {
      id: s.nextMandateId,
      type: 'prestige_min',
      description: `Mantener el prestigio por encima de ${target}`,
      target,
      year: s.year,
      met: null,
    };
  } else if (roll === 1) {
    const target = Math.max(2, playerLeagueTeamCount(s));
    return {
      id: s.nextMandateId,
      type: 'team_count',
      description: `Mantener al menos ${target} equipos en la liga`,
      target,
      year: s.year,
      met: null,
    };
  } else {
    return {
      id: s.nextMandateId,
      type: 'positive_balance',
      description: 'Cerrar la temporada con tesorería positiva',
      target: 0,
      year: s.year,
      met: null,
    };
  }
}

function checkMandate(mandate: BoardMandate, s: GameState): boolean {
  switch (mandate.type) {
    case 'prestige_min':
      return s.prestige >= mandate.target;
    case 'team_count':
      return playerLeagueTeamCount(s) >= mandate.target;
    case 'positive_balance':
      return s.treasury >= 0;
    default:
      return true;
  }
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
    s.playerFederationId,
  );
  s.fixtures = fixtures;
  s.totalMatchdays = total;
  s.currentMatchday = total > 0 ? 1 : 0;
  s.results = [];
  s.matchReports = [];
  s.pendingImpulses = [];
  s.cupSchedule = scheduleCups(s, total);
  s.seasonOver = total === 0; // no fixtures => trivially "over"
  s.phase = 'temporada';

  // Issue board mandate for this season (uses independent mandatesRng).
  const alreadyHasMandate = s.mandates.some((m) => m.year === s.year);
  if (!alreadyHasMandate) {
    s.mandates.push(generateMandate(s));
    s.nextMandateId++;
  }

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
  const playerDivisions = s.divisions.filter((d) => d.federationId === s.playerFederationId);
  const lowestOrden = playerDivisions.reduce((m, d) => Math.max(m, d.orden), 1);
  const nextId = s.teams.reduce((m, t) => Math.max(m, t.id), 0) + 1;
  s.teams.push({
    id: nextId,
    name: trimmed,
    strength: CREATED_TEAM_STRENGTH,
    federationId: s.playerFederationId,
    arraigo: CREATED_TEAM_ARRAIGO,
    divisionOrden: lowestOrden,
    youthStrength: Math.max(20, CREATED_TEAM_STRENGTH - 12),
    wageCap: 0,
    stadiumCapacity: DEFAULT_STADIUM_CAPACITY,
    academia: DEFAULT_ACADEMIA,
  });
  if (squad) {
    for (const p of squad) {
      s.players.push({
        id: s.nextPlayerId++,
        teamId: nextId,
        name: p.name,
        posicion: p.posicion,
        calidad: p.calidad,
        age: 18 + Math.floor(randInt(s.rng, 0, 5)),
        season: {
          goals: 0,
          assists: 0,
          cleanSheets: 0,
          yellowCards: 0,
          redCards: 0,
        },
        matchesSuspendedLeft: 0,
        injuredMatchesLeft: 0,
        nationality: p.nationality ?? 'local',
        cantera: p.cantera ?? false,
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
    const { homeGoals, awayGoals, goalscorers } = simulateMatch(home, away, s.rng, imp?.favoredTeamId);
    const goalMinutes = goalscorers.map((g) => g.minute);
    const attribution = attributeMatchGoals(s, fx.homeId, fx.awayId, homeGoals, awayGoals, goalMinutes);
    s.results.push({ ...fx, homeGoals, awayGoals });
    s.matchReports.push({
      matchday: md,
      divisionOrden: fx.divisionOrden,
      homeId: fx.homeId,
      awayId: fx.awayId,
      homeGoals,
      awayGoals,
      goalscorers: attribution.goalscorers,
      homeYellowCards: attribution.homeYellowCards,
      awayYellowCards: attribution.awayYellowCards,
      homeRedCards: attribution.homeRedCards,
      awayRedCards: attribution.awayRedCards,
    });
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

export function processRivalActions(s: GameState): void {
  s.rivalActions = [];

  for (const fed of s.federations) {
    if (fed.isPlayer) continue;

    // Defensive poaching: rivals with prestige > 30 try to steal player's teams
    if (fed.prestige > 30) {
      const playerTeams = s.teams.filter(t =>
        t.federationId === s.playerFederationId && t.divisionOrden !== null
      );
      for (const team of playerTeams) {
        if (rngNext(s.rng) < 0.2) {
          const success = rivalPoachAttempt(s, fed.id, team.id);
          if (success) {
            // Rival poaches the team
            const transfer = Math.min(8, Math.max(1, Math.round(team.strength / 8)));
            fed.prestige += transfer;
            const playerFed = s.federations.find(f => f.id === s.playerFederationId);
            if (playerFed) playerFed.prestige = Math.max(0, playerFed.prestige - transfer);
            s.prestige = Math.max(0, s.prestige - transfer);
            team.federationId = fed.id;
            team.arraigo = 30;
            s.rivalActions.push({
              federationId: fed.id,
              type: 'poach',
              targetTeamId: team.id,
              description: `${fed.name} ha fichado a ${team.name}`,
            });
          } else {
            s.rivalActions.push({
              federationId: fed.id,
              type: 'retaliate',
              targetTeamId: team.id,
              description: `${fed.name} intentó fichar a ${team.name} pero resistieron`,
            });
          }
          break; // max one attempt per rival per season
        }
      }
    }

    // Investment: weak rivals auto-invest
    if (fed.prestige < 15 && fed.prestige > 0) {
      s.rivalActions.push({
        federationId: fed.id,
        type: 'invest',
        amount: 2_000_000,
        description: `${fed.name} invierte en desarrollo de talento`,
      });
    }
  }

  // Retaliation: if player poached a team this window, rivals get +1 prestige
  const recentPoaches = s.negotiations.filter(
    n => n.state === 'effective' && n.effectiveYear === s.year
  );
  if (recentPoaches.length > 0) {
    for (const fed of s.federations) {
      if (fed.isPlayer) continue;
      fed.prestige = Math.min(100, fed.prestige + 1);
    }
  }
}

export function computeGlobalRanking(s: GameState): void {
  const rankings: GlobalRanking[] = [];

  for (const fed of s.federations) {
    const teams = s.teams.filter(t => t.federationId === fed.id && t.divisionOrden !== null);
    if (teams.length === 0) continue;

    const avgStrength = teams.reduce((a, t) => a + t.strength, 0) / teams.length;
    const score = avgStrength * 0.4 + fed.prestige * 0.6;

    rankings.push({
      federationId: fed.id,
      federationName: fed.name,
      rank: 0,
      avgStrength: Math.round(avgStrength),
      prestige: fed.prestige,
      teamCount: teams.length,
      score: Math.round(score * 10) / 10,
    });
  }

  rankings.sort((a, b) => b.score - a.score);
  rankings.forEach((r, i) => r.rank = i + 1);

  // Top federation gets +2 prestige bonus
  if (rankings.length > 0) {
    const top = s.federations.find(f => f.id === rankings[0].federationId);
    if (top) top.prestige += 2;
    if (rankings[0].federationId === s.playerFederationId) {
      s.prestige += 2;
    }
  }

  s.globalRankings = rankings;
}

// Closes the finished season: writes one history record per division, moves
// player prestige from top-flight performance, advances negotiations, applies
// promotion/relegation, then lands in pretemporada of the next year (the
// commissioner sets up competitions/contracts/prizes before the next startSeason).
export function closeSeason(prev: GameState): GameState {
  if (prev.phase !== 'temporada') return prev;
  if (!prev.seasonOver) return prev;
  const s = structuredClone(prev);

  // Final table per player-federation division (computed before any promotion changes).
  const penalties = pointPenaltiesForYear(s, s.year);
  const standingsByOrden = new Map<number, StandingRow[]>();
  for (const d of s.divisions.filter(d => d.federationId === s.playerFederationId)) {
    standingsByOrden.set(
      d.orden,
      applyPointPenalties(
        computeStandings(
          teamsInDivision(s.teams, d.orden, s.playerFederationId),
          s.results.filter((r) => r.divisionOrden === d.orden),
        ),
        penalties,
      ),
    );
  }

  // Player prestige is driven by the top flight (division 1).
  const top = standingsByOrden.get(1) ?? [];
  const topTeams = teamsInDivision(s.teams, 1, s.playerFederationId);
  const titleRaceGap =
    top.length > 0 ? top[0].points - top[Math.min(2, top.length - 1)].points : 0;
  const meanStrength =
    topTeams.length > 0
      ? topTeams.reduce((acc, t) => acc + t.strength, 0) / topTeams.length
      : 55;

  let delta = Math.round((meanStrength - 55) / 4) - 2; // -2 base decay
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
  delta += governanceBonus(s);   // §4.7: well-enforced norms boost credibility

  const prestigeBefore = s.prestige;
  s.prestige = Math.max(0, s.prestige + delta);
  const playerFed = s.federations.find((f) => f.id === s.playerFederationId);
  if (playerFed) playerFed.prestige = s.prestige;

  for (const d of s.divisions.filter(d => d.federationId === s.playerFederationId)) {
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

  // Decay violation history for teams not penalized this year.
  decayViolationHistory(s);

  // Player career arcs: growth, peak, decline
  for (const p of s.players) {
    p.age += 1;
    if (p.age < 27) {
      // Growth phase: young players improve
      p.calidad = Math.min(95, p.calidad + randInt(s.rng, 0, 2));
    } else if (p.age < 32) {
      // Peak phase: stable with small variation
      p.calidad = Math.min(95, Math.max(20, p.calidad + randInt(s.rng, -1, 1)));
    } else {
      // Decline phase: older players decline
      p.calidad = Math.max(20, p.calidad + randInt(s.rng, -3, -1));
    }
  }

  // Retire players who are too old or too weak
  s.players = s.players.filter(p => p.age <= 37 && p.calidad >= 25);

  // Youth academy investment: improve young players based on team's academia
  for (const t of s.teams) {
    if (t.divisionOrden === null || !t.academia) continue;
    const youngPlayers = s.players.filter(p => p.teamId === t.id && p.age <= 23);
    for (const p of youngPlayers) {
      const bonus = Math.round(t.academia / 20); // academia 20-100 → 1-5 bonus
      p.calidad = Math.min(95, p.calidad + bonus);
    }
  }

  // Team strength from squad (for teams with players)
  for (const t of s.teams) {
    if (t.divisionOrden === null) continue;
    const squadPlayers = s.players.filter(p => p.teamId === t.id);
    if (squadPlayers.length > 0) {
      const sorted = [...squadPlayers].sort((a, b) => b.calidad - a.calidad);
      const top = sorted.slice(0, Math.min(11, sorted.length));
      t.strength = Math.round(Math.max(35, Math.min(85, top.reduce((a, p) => a + p.calidad, 0) / top.length)));
    } else {
      // Teams without tracked players still get flat drift
      t.strength = Math.min(85, Math.max(35, t.strength + randInt(s.rng, -3, 3)));
    }
  }
  // Talent formation lifts the league's quality (deterministic, post-drift).
  if (talentBump > 0) {
    for (const t of s.teams) {
      if (t.divisionOrden !== null) {
        t.strength = Math.min(85, t.strength + talentBump);
      }
    }
  }

  // Arraigo decay: teams slowly lose loyalty if not maintained (-2/season).
  for (const t of s.teams) {
    if (t.federationId === s.playerFederationId) {
      t.arraigo = Math.max(0, t.arraigo - 2);
    }
  }

  // Fase 9: simulate rival leagues (independent RNG, doesn't affect player's matches).
  if (s.confederations.length > 0) {
    const rivalResult = simulateRivalLeagues(s);
    // Merge rival standings (keep previous years, overwrite current)
    for (const [key, rows] of Object.entries(rivalResult.standings)) {
      s.rivalStandings[key] = rows;
    }
    s.rivalChampions.push(...rivalResult.champions);
    driftRivalStrengths(s, rivalResult.standings);
    updateRivalPrestige(s);
  }

  // Evaluate board mandate for the just-closed season (after prestige + economy settled).
  const currentMandate = s.mandates.find((m) => m.year === s.year && m.met === null);
  if (currentMandate) {
    currentMandate.met = checkMandate(currentMandate, s);
    if (!currentMandate.met) {
      s.consecutiveMandateFails++;
      if (s.consecutiveMandateFails >= 2) {
        s.impulsesPerSeason = Math.max(1, s.impulsesPerSeason - 1);
        s.consecutiveMandateFails = 0;
      }
    } else {
      s.consecutiveMandateFails = 0;
    }
  }

  s.year += 1;
  progressNegotiations(s); // §4.2 timers compare against the new year
  processRivalActions(s);
  computeGlobalRanking(s);

  // Fase 6.4: transfer window between seasons. Mutates s.players (teamId) and
  // recomputes team.strength from the squad when players are tracked. Uses an
  // independent rng, so player-less default games are byte-identical.
  runTransferWindow(s);

  // Promotion / relegation between adjacent player-federation divisions (§1).
  const playerDivs = s.divisions
    .filter(d => d.federationId === s.playerFederationId)
    .sort((a, b) => a.orden - b.orden);
  if (playerDivs.length >= 2) {
    const byId = new Map(s.teams.map((t) => [t.id, t]));
    for (let i = 0; i < playerDivs.length - 1; i++) {
      const upperOrden = playerDivs[i].orden;
      const lowerOrden = playerDivs[i + 1].orden;
      const upper = standingsByOrden.get(upperOrden) ?? [];
      const lower = standingsByOrden.get(lowerOrden) ?? [];
      const pr = Math.min(
        PROMOTION_RELEGATION,
        Math.floor(Math.min(upper.length, lower.length) / 2),
      );
      for (const r of upper.slice(upper.length - pr)) {
        const t = byId.get(r.teamId);
        if (t) t.divisionOrden = lowerOrden;
      }
      for (const r of lower.slice(0, pr)) {
        const t = byId.get(r.teamId);
        if (t) t.divisionOrden = upperOrden;
      }
    }
  }

  // Land in pretemporada with no calendar — startSeason builds it once the
  // commissioner has staged the new year's competitions/contracts/prizes (§4.8).
  s.fixtures = [];
  s.totalMatchdays = 0;
  s.results = [];
  s.matchReports = [];
  s.currentMatchday = 0;
  s.cupSchedule = [];
  s.impulsesRemaining = s.impulsesPerSeason;
  s.pendingImpulses = [];
  s.seasonOver = false;
  // Reset event-driven temporary effects.
  s.eventStrengthPenalty = 0;
  s.eventCapacityPenaltyPct = 0;
  s.eventImpulseLoss = 0;
  s.eventTreasuryInjection = 0;
  // Save recurring cup templates for next season.
  saveRecurringCupTemplates(s);
  // Recreate recurring cups from templates for the new season.
  recreateRecurringCups(s);
  s.phase = 'pretemporada';
  return s;
}

// ─── Pretemporada: cultivate team loyalty (Fase 8 Batch 1) ──────────────────

const CULTIVATE_ARRAIGO_COST = 2_000_000;
const CULTIVATE_ARRAIGO_MIN = 5;
const CULTIVATE_ARRAIGO_MAX = 10;
const MAX_CULTIVATE_PER_SEASON = 2;

// Raise a team's arraigo (loyalty) during pretemporada. Limits: 2 teams/season,
// costs 2M€ per use, +5–10 arraigo (random).
export function cultivateArraigo(
  prev: GameState,
  teamId: number,
): GameState {
  if (prev.phase !== 'pretemporada') return prev;
  if (prev.treasury < CULTIVATE_ARRAIGO_COST) return prev;
  // Count how many times the player already cultivated this season.
  const used = prev.actionHistory.filter(
    (a) => a.year === prev.year && a.type === 'cultivate_arraigo',
  ).length;
  if (used >= MAX_CULTIVATE_PER_SEASON) return prev;

  const s = structuredClone(prev);
  const team = s.teams.find((t) => t.id === teamId);
  if (!team) return prev;
  if (team.federationId !== s.playerFederationId) return prev;

  s.treasury -= CULTIVATE_ARRAIGO_COST;
  const gain = CULTIVATE_ARRAIGO_MIN + Math.floor(rngNext(s.rng) * (CULTIVATE_ARRAIGO_MAX - CULTIVATE_ARRAIGO_MIN + 1));
  team.arraigo = Math.min(100, team.arraigo + gain);
  s.actionHistory.push({
    id: s.nextActionId++,
    year: s.year,
    type: 'cultivate_arraigo',
    matchday: 0,
    cost: CULTIVATE_ARRAIGO_COST,
    targetTeamId: teamId,
    result: `+${gain} arraigo`,
  });
  return s;
}

// ─── Pretemporada: veto outgoing transfer (Fase 8 Batch 3) ──────────────────

// ─── Mid-season commissioner actions (Proposal 1: Mid-Season Agency) ────────

const REVIEW_COST = 500_000;
const EMERGENCY_MEETING_COST = 200_000;
const REVIEW_SUCCESS_PROB = 0.7;

const REVIEWS_PER_SEASON = 2;

// Challenge a specific match result (referee mistake). 70% chance to replay.
// Limited to 2 uses per season to prevent re-rolling bad results freely.
export function callReview(
  prev: GameState,
  matchday: number,
  homeId: number,
  awayId: number,
): GameState {
  if (prev.phase !== 'temporada') return prev;
  if (prev.treasury < REVIEW_COST) return prev;
  const reviewsThisSeason = prev.actionHistory.filter(
    (a) => a.year === prev.year && a.type === 'call_review',
  ).length;
  if (reviewsThisSeason >= REVIEWS_PER_SEASON) return prev;
  const alreadyUsed = prev.actionHistory.some(
    (a) =>
      a.year === prev.year &&
      a.type === 'call_review' &&
      a.matchday === matchday &&
      a.targetTeamId === homeId,
  );
  if (alreadyUsed) return prev;

  const s = structuredClone(prev);
  s.treasury -= REVIEW_COST;
  // Each review costs 1 prestige point — political capital consumed.
  s.prestige = Math.max(0, s.prestige - 1);

  const success = rngNext(s.rng) < REVIEW_SUCCESS_PROB;
  const result = success ? 'replay_approved' : 'replay_denied';

  if (success) {
    // Remove the old result and re-simulate
    const oldResultIdx = s.results.findIndex(
      (r) => r.matchday === matchday && r.homeId === homeId && r.awayId === awayId,
    );
    if (oldResultIdx >= 0) {
      const oldResult = s.results[oldResultIdx];
      s.results.splice(oldResultIdx, 1);

      // Remove old match report
      const oldReportIdx = s.matchReports.findIndex(
        (r) => r.matchday === matchday && r.homeId === homeId && r.awayId === awayId,
      );
      if (oldReportIdx >= 0) s.matchReports.splice(oldReportIdx, 1);

      const byId = new Map(s.teams.map((t) => [t.id, t]));
      const home = byId.get(homeId);
      const away = byId.get(awayId);
      if (home && away) {
        const { homeGoals, awayGoals, goalscorers: newGoalscorers } = simulateMatch(
          home,
          away,
          s.rng,
        );
        const goalMinutes = newGoalscorers.map((g) => g.minute);
        const attribution = attributeMatchGoals(
          s,
          homeId,
          awayId,
          homeGoals,
          awayGoals,
          goalMinutes,
        );
        s.results.push({
          matchday,
          divisionOrden: oldResult.divisionOrden,
          homeId,
          awayId,
          homeGoals,
          awayGoals,
        });
        s.matchReports.push({
          matchday,
          divisionOrden: oldResult.divisionOrden,
          homeId,
          awayId,
          homeGoals,
          awayGoals,
          goalscorers: attribution.goalscorers,
          homeYellowCards: attribution.homeYellowCards,
          awayYellowCards: attribution.awayYellowCards,
          homeRedCards: attribution.homeRedCards,
          awayRedCards: attribution.awayRedCards,
        });
      }
    }
  }

  s.actionHistory.push({
    id: s.nextActionId++,
    year: s.year,
    matchday,
    type: 'call_review',
    cost: REVIEW_COST,
    targetTeamId: homeId,
    result,
  });

  return s;
}

// Emergency board meeting: force a team to change coach (random ±5 shift).
// Once per team per season.
export function emergencyMeeting(
  prev: GameState,
  teamId: number,
): GameState {
  if (prev.phase !== 'temporada') return prev;
  if (prev.treasury < EMERGENCY_MEETING_COST) return prev;

  const alreadyUsed = prev.actionHistory.some(
    (a) =>
      a.year === prev.year &&
      a.type === 'emergency_meeting' &&
      a.targetTeamId === teamId,
  );
  if (alreadyUsed) return prev;

  const s = structuredClone(prev);
  s.treasury -= EMERGENCY_MEETING_COST;

  const team = s.teams.find((t) => t.id === teamId);
  if (team) {
    const shift = randInt(s.rng, -5, 5);
    team.strength = Math.min(85, Math.max(35, team.strength + shift));
    s.actionHistory.push({
      id: s.nextActionId++,
      year: s.year,
      matchday: s.currentMatchday,
      type: 'emergency_meeting',
      cost: EMERGENCY_MEETING_COST,
      targetTeamId: teamId,
      result: `coach_change_strength_${shift >= 0 ? '+' : ''}${shift}`,
    });
  }

  return s;
}

// Postpone a matchday: skip it, allow injured players to recover, prestige -1.
export function postponeMatchday(prev: GameState): GameState {
  if (prev.phase !== 'temporada') return prev;
  if (prev.seasonOver) return prev;

  const s = structuredClone(prev);
  s.prestige = Math.max(0, s.prestige - 1);

  // Recover injured players for teams that would have played
  const md = s.currentMatchday;
  const playingTeams = new Set<number>();
  for (const fx of s.fixtures) {
    if (fx.matchday === md) {
      playingTeams.add(fx.homeId);
      playingTeams.add(fx.awayId);
    }
  }
  for (const p of s.players) {
    if (playingTeams.has(p.teamId) && p.injuredMatchesLeft > 0) {
      p.injuredMatchesLeft = Math.max(0, p.injuredMatchesLeft - 1);
    }
  }

  s.currentMatchday = md + 1;
  if (s.currentMatchday > s.totalMatchdays) s.seasonOver = true;

  s.actionHistory.push({
    id: s.nextActionId++,
    year: s.year,
    matchday: md,
    type: 'postpone_matchday',
    cost: 0,
    targetTeamId: null,
    result: 'matchday_postponed',
  });

  return s;
}
