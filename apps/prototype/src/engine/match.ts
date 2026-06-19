import { poisson, type RngState } from './rng';
import type { Team } from './types';

const HOME_ADVANTAGE = 6;
const IMPULSE_BOOST = 12; // the commissioner's "thumb on the scale" for one match

// Weighted random by relative strength (design doc: minimum loop = aleatorio
// ponderado por la calidad media). Realism is the last polish layer, not this one.
export function simulateMatch(
  home: Team,
  away: Team,
  rng: RngState,
  favoredTeamId?: number,
): { homeGoals: number; awayGoals: number } {
  let homeRating = home.strength + HOME_ADVANTAGE;
  let awayRating = away.strength;
  if (favoredTeamId === home.id) homeRating += IMPULSE_BOOST;
  if (favoredTeamId === away.id) awayRating += IMPULSE_BOOST;

  const total = homeRating + awayRating;
  const homeXg = 0.35 + 2.9 * (homeRating / total);
  const awayXg = 0.35 + 2.9 * (awayRating / total);

  return {
    homeGoals: poisson(rng, homeXg),
    awayGoals: poisson(rng, awayXg),
  };
}
