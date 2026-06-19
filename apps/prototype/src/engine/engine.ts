// Functional core: every function takes a GameState and returns a NEW one.
// No I/O, no React, no DB. structuredClone keeps it pure at the boundary while
// staying readable inside. This whole module graduates to packages/engine.

import { makeRng, randInt, type RngState } from './rng';
import { generateFixtures } from './fixtures';
import { simulateMatch } from './match';
import { computeStandings } from './standings';
import type { Fixture, GameState, SeasonRecord, Team } from './types';

// Modest real-ish clubs: the design doc starts every game with 10 teams the
// player picks, possibly from lower divisions.
const TEAM_NAMES = [
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

const IMPULSES_PER_SEASON = 3;
const STARTING_PRESTIGE = 20;

export function tierOf(prestige: number): number {
  if (prestige >= 80) return 5;
  if (prestige >= 60) return 4;
  if (prestige >= 40) return 3;
  if (prestige >= 20) return 2;
  return 1;
}

function newSeasonFixtures(teams: Team[], rng: RngState): { fixtures: Fixture[]; total: number } {
  const fixtures = generateFixtures(
    teams.map((t) => t.id),
    rng,
  );
  return { fixtures, total: Math.max(...fixtures.map((f) => f.matchday)) };
}

export function createGame(seed: number): GameState {
  const rng = makeRng(seed);
  const teams: Team[] = TEAM_NAMES.map((name, i) => ({
    id: i + 1,
    name,
    strength: 45 + Math.floor(randInt(rng, 0, 25)), // 45..70
  }));
  const { fixtures, total } = newSeasonFixtures(teams, rng);
  return {
    seed: seed >>> 0,
    rng,
    year: 1,
    prestige: STARTING_PRESTIGE,
    teams,
    fixtures,
    results: [],
    currentMatchday: 1,
    totalMatchdays: total,
    impulsesPerSeason: IMPULSES_PER_SEASON,
    impulsesRemaining: IMPULSES_PER_SEASON,
    pendingImpulses: [],
    history: [],
    seasonOver: false,
  };
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

export function advanceMatchday(prev: GameState): GameState {
  if (prev.seasonOver) return prev;
  const s = structuredClone(prev);
  const md = s.currentMatchday;
  const byId = new Map(s.teams.map((t) => [t.id, t]));

  for (const fx of s.fixtures.filter((f) => f.matchday === md)) {
    const home = byId.get(fx.homeId);
    const away = byId.get(fx.awayId);
    if (!home || !away) continue;
    const imp = s.pendingImpulses.find(
      (p) => p.matchday === md && p.homeId === fx.homeId && p.awayId === fx.awayId,
    );
    const { homeGoals, awayGoals } = simulateMatch(home, away, s.rng, imp?.favoredTeamId);
    s.results.push({ ...fx, homeGoals, awayGoals });
  }

  s.pendingImpulses = s.pendingImpulses.filter((p) => p.matchday !== md);
  s.currentMatchday = md + 1;
  if (s.currentMatchday > s.totalMatchdays) s.seasonOver = true;
  return s;
}

export function advanceSeason(prev: GameState): GameState {
  let s = prev;
  while (!s.seasonOver) s = advanceMatchday(s);
  return s;
}

// Closes the finished season (writes the history record, moves prestige) and
// rolls straight into the next one. Prestige rewards a strong, competitive
// league and decays slightly otherwise — that tension is the point of the loop.
export function closeAndStartNextSeason(prev: GameState): GameState {
  if (!prev.seasonOver) return prev;
  const s = structuredClone(prev);

  const table = computeStandings(s.teams, s.results);
  const champion = table[0];
  const titleRaceGap = table[0].points - table[Math.min(2, table.length - 1)].points;
  const meanStrength = s.teams.reduce((acc, t) => acc + t.strength, 0) / s.teams.length;

  let delta = Math.round((meanStrength - 55) / 4) - 1; // -1 base decay
  if (titleRaceGap <= 3) delta += 3;
  else if (titleRaceGap <= 6) delta += 2;
  else if (titleRaceGap <= 10) delta += 1;

  const prestigeBefore = s.prestige;
  s.prestige = Math.max(0, s.prestige + delta);

  const record: SeasonRecord = {
    year: s.year,
    championId: champion.teamId,
    championName: champion.name,
    points: champion.points,
    prestigeBefore,
    prestigeAfter: s.prestige,
    delta,
  };
  s.history.push(record);

  // Teams evolve on their own (commissioner doesn't manage squads). Drift keeps
  // seasons from being identical and makes "advance season" worth watching.
  for (const t of s.teams) {
    t.strength = Math.min(85, Math.max(35, t.strength + randInt(s.rng, -3, 3)));
  }

  s.year += 1;
  const { fixtures, total } = newSeasonFixtures(s.teams, s.rng);
  s.fixtures = fixtures;
  s.totalMatchdays = total;
  s.results = [];
  s.currentMatchday = 1;
  s.impulsesRemaining = s.impulsesPerSeason;
  s.pendingImpulses = [];
  s.seasonOver = false;
  return s;
}
