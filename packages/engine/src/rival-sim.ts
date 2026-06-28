// Fase 9: Rival league simulation. Simulates entire rival seasons at
// closeSeason time using an independent RNG (rivalRng) so the player's
// match engine stream stays golden-stable.

import { randInt, type RngState } from './rng';
import { generateFixtures } from './fixtures';
import { simulateMatch } from './match';
import type { GameState, RivalStandingRow, SeasonRecord, Team } from './types';

// Simulate a full round-robin season for one rival division.
function simulateRivalDivision(
  teams: Team[],
  divisionOrden: number,
  _federationId: number,
  rng: RngState,
): RivalStandingRow[] {
  if (teams.length < 2) return [];

  const teamIds = teams.map(t => t.id);
  const fixtures = generateFixtures(teamIds, rng, divisionOrden, 2);

  const results: Array<{ homeId: number; awayId: number; homeGoals: number; awayGoals: number }> = [];
  const byId = new Map(teams.map(t => [t.id, t]));

  for (const fx of fixtures) {
    const home = byId.get(fx.homeId);
    const away = byId.get(fx.awayId);
    if (!home || !away) continue;
    const { homeGoals, awayGoals } = simulateMatch(home, away, rng);
    results.push({ homeId: fx.homeId, awayId: fx.awayId, homeGoals, awayGoals });
  }

  // Compute standings from results
  const standingMap = new Map<number, RivalStandingRow>();
  for (const t of teams) {
    standingMap.set(t.id, {
      teamId: t.id,
      name: t.name,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
      points: 0,
    });
  }

  for (const r of results) {
    const home = standingMap.get(r.homeId);
    const away = standingMap.get(r.awayId);
    if (!home || !away) continue;
    home.played++;
    away.played++;
    home.goalsFor += r.homeGoals;
    home.goalsAgainst += r.awayGoals;
    away.goalsFor += r.awayGoals;
    away.goalsAgainst += r.homeGoals;
    if (r.homeGoals > r.awayGoals) {
      home.won++;
      home.points += 3;
      away.lost++;
    } else if (r.homeGoals < r.awayGoals) {
      away.won++;
      away.points += 3;
      home.lost++;
    } else {
      home.drawn++;
      away.drawn++;
      home.points++;
      away.points++;
    }
  }

  for (const row of standingMap.values()) {
    row.goalDiff = row.goalsFor - row.goalsAgainst;
  }

  return [...standingMap.values()].sort(
    (a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor,
  );
}

// Simulate all rival leagues and return standings + champions.
export function simulateRivalLeagues(
  s: GameState,
): { standings: Record<string, RivalStandingRow[]>; champions: SeasonRecord[] } {
  const rng = s.rivalRng;
  const standings: Record<string, RivalStandingRow[]> = {};
  const champions: SeasonRecord[] = [];

  // Group rival divisions by federationId
  const rivalDivs = s.divisions.filter(d => d.federationId !== s.playerFederationId);

  for (const div of rivalDivs) {
    const divTeams = s.teams.filter(
      t => t.federationId === div.federationId && t.divisionOrden === div.orden,
    );
    if (divTeams.length < 2) continue;

    const rows = simulateRivalDivision(divTeams, div.orden, div.federationId, rng);
    const key = `${div.federationId}:${div.orden}`;
    standings[key] = rows;

    if (rows.length > 0) {
      const champion = rows[0];
      champions.push({
        year: s.year,
        divisionOrden: div.orden,
        championId: champion.teamId,
        championName: champion.name,
        points: champion.points,
        prestigeBefore: 0,
        prestigeAfter: 0,
        delta: 0,
      });
    }
  }

  return { standings, champions };
}

// Apply strength drift to rival teams based on their performance.
// Teams that finished high get a small boost; teams at the bottom decline.
export function driftRivalStrengths(s: GameState, standings: Record<string, RivalStandingRow[]>): void {
  const byId = new Map(s.teams.map(t => [t.id, t]));

  for (const rows of Object.values(standings)) {
    const n = rows.length;
    if (n === 0) continue;
    for (let i = 0; i < n; i++) {
      const team = byId.get(rows[i].teamId);
      if (!team) continue;
      // Top 3: +1 to +2; Bottom 3: -1 to -2; Middle: -1 to +1
      let drift: number;
      if (i < 3) {
        drift = randInt(s.rivalRng, 1, 2);
      } else if (i >= n - 3) {
        drift = randInt(s.rivalRng, -2, -1);
      } else {
        drift = randInt(s.rivalRng, -1, 1);
      }
      team.strength = Math.max(25, Math.min(95, team.strength + drift));
    }
  }
}

// Update rival federation prestige based on their average team strength.
export function updateRivalPrestige(s: GameState): void {
  for (const fed of s.federations) {
    if (fed.isPlayer) continue;
    const teams = s.teams.filter(t => t.federationId === fed.id && t.divisionOrden !== null);
    if (teams.length === 0) continue;
    const avgStrength = teams.reduce((a, t) => a + t.strength, 0) / teams.length;
    // Prestige drifts slowly toward the avg strength (capped 0-100)
    const target = Math.round(avgStrength * 0.9);
    const diff = target - fed.prestige;
    fed.prestige = Math.max(0, Math.min(100, fed.prestige + Math.round(diff * 0.1)));
  }
}
