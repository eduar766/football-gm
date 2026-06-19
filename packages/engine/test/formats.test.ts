import { describe, expect, it } from 'vitest';
import {
  advanceSeason,
  createGame,
  pendingEvents,
  resolveEvent,
  setLeagueFormat,
  startSeason,
  type GameState,
  type PlayerSeed,
} from '../src/index';

const POSITIONS = ['POR', 'DEF', 'MED', 'DEL'] as const;
const SIZES = [2, 6, 7, 5] as const;
function squad(i: number): PlayerSeed[] {
  const out: PlayerSeed[] = [];
  let n = 1;
  for (let k = 0; k < POSITIONS.length; k++)
    for (let j = 0; j < SIZES[k]; j++)
      out.push({ name: `T${i}-${n++}`, posicion: POSITIONS[k], calidad: 55 });
  return out;
}
const squaded = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    name: `Eq ${i + 1}`,
    strength: 55,
    arraigo: 50,
    squad: squad(i + 1),
  }));

describe('league format (§4.4)', () => {
  it('defaults to ida_vuelta (double round-robin)', () => {
    const g = startSeason(createGame(1));
    expect(g.leagueFormat).toBe('ida_vuelta');
    expect(g.totalMatchdays).toBe(18);
    expect(advanceSeason(g).results).toHaveLength(90);
  });

  it('switching to ida halves the schedule', () => {
    const g = startSeason(setLeagueFormat(createGame(1), 'ida'));
    expect(g.leagueFormat).toBe('ida');
    expect(g.totalMatchdays).toBe(9);
    expect(advanceSeason(g).results).toHaveLength(45); // 10 teams single RR
  });

  it('setting the same format is a no-op', () => {
    const g = createGame(1);
    expect(setLeagueFormat(g, 'ida_vuelta')).toBe(g);
  });

  it('league format can only be changed in pretemporada', () => {
    const g = startSeason(createGame(1));
    expect(setLeagueFormat(g, 'ida')).toBe(g); // guard: same instance returned
  });

  it('every team carries a youth strength below the first team', () => {
    const g = createGame(1);
    expect(g.teams.every((t) => t.youthStrength < t.strength)).toBe(true);
    expect(g.teams.every((t) => t.youthStrength >= 20)).toBe(true);
  });
});

describe('advancing stops on a pending polémica (§1)', () => {
  it('never leaves the season unfinished with an unresolved event', () => {
    const s = advanceSeason(startSeason(createGame(11, { teams: squaded(10) })));
    expect(s.seasonOver || pendingEvents(s).length > 0).toBe(true);
  });

  it('resolving lets the season continue to its end', () => {
    let s: GameState = startSeason(createGame(11, { teams: squaded(10) }));
    for (let guard = 0; guard < 40 && !s.seasonOver; guard++) {
      s = advanceSeason(s);
      for (const e of pendingEvents(s)) s = resolveEvent(s, e.id, 'ignorar');
    }
    expect(s.seasonOver).toBe(true);
  });
});
