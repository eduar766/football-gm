import { poisson, randInt, type RngState } from './rng';
import type { Goalscorer, Player, Team } from './types';

// Commissioner impulse: favours one team by boosting their effective rating.
const IMPULSE_BOOST = 12;

// Home advantage: base pts + stadium-size bonus (bigger grounds → louder crowd).
const HOME_ADV_BASE = 4;
const HOME_ADV_MAX_BONUS = 3;      // extra points at max stadium
const HOME_STADIUM_CAP = 40_000;   // capacity that earns the full bonus

// √-compression parameters: the sqrt of each team's adjusted rating is used
// instead of the raw value. This dampens extreme mismatches — a team twice as
// strong doesn't score twice as often, just somewhat more. Prevents 6-0 results
// that the old linear formula allowed when quality gap > 40 points.
const XG_FLOOR = 0.45;   // minimum expected-goals per team per match
const XG_SCALE = 2.1;    // total xG above floor across both teams

// Form: weight each recent result and centre on neutral.
function formBonus(form: ('W' | 'D' | 'L')[]): number {
  if (form.length === 0) return 0;
  const pts = form.reduce((a, r) => a + (r === 'W' ? 3 : r === 'D' ? 1 : 0), 0);
  const max = form.length * 3;
  // maps [0..max] → [−4..+4]
  return Math.round(((pts / max) - 0.5) * 8);
}

// Fatigue: long fixture lists degrade performance slightly late in the campaign.
function fatiguePenalty(matchesPlayed: number): number {
  return -Math.min(3, Math.floor(matchesPlayed / 12));
}

// Availability: missing quality due to suspensions/injuries reduces effective rating.
// Uses read-only player data — no RNG consumption.
function availabilityPenalty(players: Player[], teamId: number): number {
  const squad = players.filter((p) => p.teamId === teamId);
  if (squad.length === 0) return 0;
  const totalQ = squad.reduce((a, p) => a + p.calidad, 0);
  if (totalQ === 0) return 0;
  const missingQ = squad
    .filter((p) => p.matchesSuspendedLeft > 0 || p.injuredMatchesLeft > 0)
    .reduce((a, p) => a + p.calidad, 0);
  // cap at −8: even if all starters are out, you still have reserves
  return -Math.round((missingQ / totalQ) * 8);
}

// Main match simulator. `players` is optional — when empty (default), availability
// modifier is skipped but all other realism factors (form, fatigue, stadium) apply.
export function simulateMatch(
  home: Team,
  away: Team,
  rng: RngState,
  favoredTeamId?: number,
  players: Player[] = [],
): {
  homeGoals: number;
  awayGoals: number;
  goalscorers: Goalscorer[];
} {
  const homeAdv =
    HOME_ADV_BASE +
    Math.min(HOME_ADV_MAX_BONUS, Math.floor((home.stadiumCapacity / HOME_STADIUM_CAP) * HOME_ADV_MAX_BONUS));

  const homeForm = formBonus(home.recentForm);
  const awayForm = formBonus(away.recentForm);
  const homeFatigue = fatiguePenalty(home.matchesPlayedThisSeason);
  const awayFatigue = fatiguePenalty(away.matchesPlayedThisSeason);
  const homeAvail = players.length > 0 ? availabilityPenalty(players, home.id) : 0;
  const awayAvail = players.length > 0 ? availabilityPenalty(players, away.id) : 0;

  let homeRating = home.strength + homeAdv + homeForm + homeFatigue + homeAvail;
  let awayRating = away.strength + awayForm + awayFatigue + awayAvail;
  if (favoredTeamId === home.id) homeRating += IMPULSE_BOOST;
  if (favoredTeamId === away.id) awayRating += IMPULSE_BOOST;

  homeRating = Math.max(1, homeRating);
  awayRating = Math.max(1, awayRating);

  // √-compression: sqrt of rating is used to compute each team's share of XG.
  const sqrtHome = Math.sqrt(homeRating);
  const sqrtAway = Math.sqrt(awayRating);
  const sqrtTotal = sqrtHome + sqrtAway;

  const homeXg = XG_FLOOR + XG_SCALE * (sqrtHome / sqrtTotal);
  const awayXg = XG_FLOOR + XG_SCALE * (sqrtAway / sqrtTotal);

  const homeGoals = poisson(rng, homeXg);
  const awayGoals = poisson(rng, awayXg);

  // Placeholder goalscorer entries (minutes only). attributeMatchGoals in
  // awards.ts replaces playerId: -1 with real player IDs via attributionRng.
  const goalscorers: Goalscorer[] = [];
  for (let i = 0; i < homeGoals; i++) {
    goalscorers.push({ playerId: -1, minute: randInt(rng, 1, 90) });
  }
  for (let i = 0; i < awayGoals; i++) {
    goalscorers.push({ playerId: -1, minute: randInt(rng, 1, 90) });
  }

  return { homeGoals, awayGoals, goalscorers };
}
