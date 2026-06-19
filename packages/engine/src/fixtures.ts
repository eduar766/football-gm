import { rngNext, type RngState } from './rng';
import type { Division, Fixture, Team } from './types';

// Double round-robin via the circle method. 10 teams => 18 matchdays, 5 per day.
// Initial Fisher-Yates shuffle so each game/season has a different calendar.
export function generateFixtures(
  teamIds: number[],
  rng: RngState,
  divisionOrden = 1,
  legs: 1 | 2 = 2,
): Fixture[] {
  const ids = [...teamIds];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rngNext(rng) * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  if (ids.length % 2 !== 0) ids.push(-1); // odd => bye placeholder

  const n = ids.length;
  const rounds = n - 1;
  const half = n / 2;
  const fixtures: Fixture[] = [];
  let arr = [...ids];

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < half; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a !== -1 && b !== -1) {
        const homeFirst = (r + i) % 2 === 0;
        const homeId = homeFirst ? a : b;
        const awayId = homeFirst ? b : a;
        fixtures.push({ matchday: r + 1, divisionOrden, homeId, awayId });
        if (legs === 2) {
          // Reverse fixture in the second half of the season, venue swapped.
          fixtures.push({
            matchday: rounds + r + 1,
            divisionOrden,
            homeId: awayId,
            awayId: homeId,
          });
        }
      }
    }
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)]; // rotate, keep first fixed
  }

  return fixtures.sort((x, y) => x.matchday - y.matchday);
}

// One round-robin per division, concatenated. A "matchday" advances every
// division by a round; the season length is the longest division's schedule.
export function buildDivisionFixtures(
  teams: Team[],
  divisions: Division[],
  rng: RngState,
  legs: 1 | 2 = 2,
): { fixtures: Fixture[]; total: number } {
  const fixtures: Fixture[] = [];
  for (const d of divisions) {
    const ids = teams.filter((t) => t.divisionOrden === d.orden).map((t) => t.id);
    if (ids.length >= 2) fixtures.push(...generateFixtures(ids, rng, d.orden, legs));
  }
  const total = fixtures.length
    ? Math.max(...fixtures.map((f) => f.matchday))
    : 0;
  return { fixtures, total };
}
