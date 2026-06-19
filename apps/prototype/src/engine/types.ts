import type { RngState } from './rng';

export interface Team {
  id: number;
  name: string;
  // Average squad quality (0-100). The prototype has no Player entities yet —
  // strength is the proxy the design doc allows for the minimum loop.
  strength: number;
}

export interface Fixture {
  matchday: number;
  homeId: number;
  awayId: number;
}

export interface MatchResult extends Fixture {
  homeGoals: number;
  awayGoals: number;
}

export interface PendingImpulse {
  matchday: number;
  homeId: number;
  awayId: number;
  favoredTeamId: number;
}

export interface SeasonRecord {
  year: number;
  championId: number;
  championName: string;
  points: number;
  prestigeBefore: number;
  prestigeAfter: number;
  delta: number;
}

export interface GameState {
  seed: number;
  rng: RngState;
  year: number;
  prestige: number;
  teams: Team[];
  fixtures: Fixture[];
  results: MatchResult[];
  currentMatchday: number;
  totalMatchdays: number;
  impulsesPerSeason: number;
  impulsesRemaining: number;
  pendingImpulses: PendingImpulse[];
  history: SeasonRecord[];
  seasonOver: boolean;
}
