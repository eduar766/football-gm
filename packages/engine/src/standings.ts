import type { MatchResult, Team } from './types';

export interface StandingRow {
  teamId: number;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
}

export function computeStandings(teams: Team[], results: MatchResult[]): StandingRow[] {
  const table = new Map<number, StandingRow>();
  for (const t of teams) {
    table.set(t.id, {
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
    const home = table.get(r.homeId);
    const away = table.get(r.awayId);
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

  for (const row of table.values()) {
    row.goalDiff = row.goalsFor - row.goalsAgainst;
  }

  return [...table.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDiff - a.goalDiff ||
      b.goalsFor - a.goalsFor ||
      a.name.localeCompare(b.name),
  );
}

// Fase 15B: 0 = league totally unequal, 100 = maximum parity. Based on the
// standard deviation of points-per-matchday (comparable across season
// lengths) across the division. stdDev is bounded [0, 1.5] since points-per-
// matchday itself is bounded [0, 3] — the 66.7 factor maps that range to
// [0, 100] exactly, clamped defensively at the edges.
export function competitiveBalanceIndex(rows: StandingRow[], matchdaysPlayed: number): number {
  if (rows.length < 2 || matchdaysPlayed <= 0) return 50; // not enough signal yet
  const ppm = rows.map((r) => r.points / matchdaysPlayed);
  const mean = ppm.reduce((a, b) => a + b, 0) / ppm.length;
  const variance = ppm.reduce((a, v) => a + (v - mean) ** 2, 0) / ppm.length;
  const stdDev = Math.sqrt(variance);
  return Math.round(Math.max(0, Math.min(100, 100 - stdDev * 66.7)));
}
