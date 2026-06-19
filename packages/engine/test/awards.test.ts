import { describe, expect, it } from 'vitest';
import {
  advanceSeason,
  closeSeason,
  createGame,
  startSeason,
  type GameState,
  type PlayerSeed,
} from '../src/index';

const POSITIONS = ['POR', 'DEF', 'MED', 'DEL'] as const;
const SIZES = [2, 6, 7, 5] as const;

function squadFor(idx: number, baseQuality: number): PlayerSeed[] {
  const out: PlayerSeed[] = [];
  let n = 1;
  for (let i = 0; i < POSITIONS.length; i++) {
    const pos = POSITIONS[i];
    for (let k = 0; k < SIZES[i]; k++) {
      out.push({
        name: `T${idx}-${pos}-${n++}`,
        posicion: pos,
        calidad: Math.min(99, Math.max(30, baseQuality + (k - 2))),
      });
    }
  }
  return out;
}

function squadedTeams(n: number, baseQuality = 55) {
  return Array.from({ length: n }, (_, i) => ({
    name: `Eq ${i + 1}`,
    strength: baseQuality,
    arraigo: 50,
    squad: squadFor(i + 1, baseQuality),
  }));
}

describe('default path (no players)', () => {
  it('creates no players and never emits awards', () => {
    let g: GameState = createGame(7);
    g = closeSeason(advanceSeason(startSeason(g)));
    expect(g.players).toHaveLength(0);
    expect(g.awards).toHaveLength(0);
  });
});

describe('awards from squads (§6)', () => {
  it('writes max_goleador / max_asistente / mejor_portero at season close', () => {
    let g = createGame(11, { teams: squadedTeams(10) });
    expect(g.players.length).toBeGreaterThan(0);
    g = closeSeason(advanceSeason(startSeason(g)));
    const types = new Set(g.awards.map((a) => a.tipo));
    expect(types.has('max_goleador')).toBe(true);
    expect(types.has('mejor_portero')).toBe(true);
    // The top scorer actually scored
    const top = g.awards.find((a) => a.tipo === 'max_goleador')!;
    expect(top.valor).toBeGreaterThan(0);
    // The keeper is a POR
    const keeperId = g.awards.find((a) => a.tipo === 'mejor_portero')!.playerId;
    const keeper = g.players.find((p) => p.id === keeperId)!;
    expect(keeper.posicion).toBe('POR');
  });

  it('resets season stats at close so each year starts fresh', () => {
    let g = createGame(13, { teams: squadedTeams(10) });
    g = closeSeason(advanceSeason(startSeason(g)));
    expect(g.players.every((p) => p.season.goals === 0)).toBe(true);
    expect(g.players.every((p) => p.season.assists === 0)).toBe(true);
    expect(g.players.every((p) => p.season.cleanSheets === 0)).toBe(true);
  });
});

describe('determinism with awards', () => {
  it('same seed + same squads => identical awards across runs', () => {
    const run = () => {
      let g = createGame(404, { teams: squadedTeams(10) });
      for (let i = 0; i < 3; i++) g = closeSeason(advanceSeason(startSeason(g)));
      return g.awards;
    };
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });
});
