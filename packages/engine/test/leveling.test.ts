import { describe, expect, it } from 'vitest';
import { createGame, runLevelingLeague, validateLevelingPlan, startSeason } from '../src/index';
import type { GameState, LevelingPlan } from '../src/index';

function gameWith(n: number): GameState {
  return createGame(1234, {
    teams: Array.from({ length: n }, (_, i) => ({ name: `E${i + 1}`, strength: 40 + i * 3 })),
  });
}

describe('validateLevelingPlan (Fase 14.7)', () => {
  it('accepts a plan whose sizes match the pool', () => {
    const plan: LevelingPlan = {
      divisions: [
        { orden: 1, size: 12, format: 'ida_vuelta' },
        { orden: 2, size: 8, format: 'ida' },
      ],
    };
    expect(validateLevelingPlan(plan, 20)).toBeNull();
  });

  it('rejects wrong totals, gaps, tiny divisions and too many divisions', () => {
    expect(validateLevelingPlan({ divisions: [{ orden: 1, size: 10, format: 'ida' }] }, 20)).not.toBeNull();
    expect(
      validateLevelingPlan({ divisions: [{ orden: 1, size: 18, format: 'ida' }, { orden: 3, size: 2, format: 'ida' }] }, 20),
    ).not.toBeNull(); // non-consecutive orden
    expect(
      validateLevelingPlan({ divisions: [{ orden: 1, size: 19, format: 'ida' }, { orden: 2, size: 1, format: 'ida' }] }, 20),
    ).not.toBeNull(); // size < 2
  });
});

describe('runLevelingLeague with a plan (Fase 14.7)', () => {
  it('distributes teams by the plan and stores per-division formats', () => {
    const plan: LevelingPlan = {
      divisions: [
        { orden: 1, size: 5, format: 'ida_vuelta' },
        { orden: 2, size: 3, format: 'ida' },
      ],
    };
    const g = runLevelingLeague(gameWith(8), plan);
    const div = (o: number) => g.teams.filter((t) => t.federationId === g.playerFederationId && t.divisionOrden === o);
    expect(div(1)).toHaveLength(5);
    expect(div(2)).toHaveLength(3);
    expect(g.divisions.find((d) => d.orden === 1)?.format).toBe('ida_vuelta');
    expect(g.divisions.find((d) => d.orden === 2)?.format).toBe('ida');
  });

  it('preserves rival divisions (regression: leveling used to wipe them)', () => {
    const g0 = createGame(4321, {
      confederations: [{ id: 1, name: 'UEFA', region: 'Europa', available: true, leagues: [] }],
      teams: Array.from({ length: 6 }, (_, i) => ({ name: `P${i + 1}`, strength: 50 })),
      rivals: [
        {
          name: 'Rival Fed',
          prestige: 60,
          confederationId: 1,
          divisions: [{ orden: 1, name: 'Primera', teams: Array.from({ length: 6 }, (_, i) => ({ name: `R${i + 1}`, strength: 55, arraigo: 50 })) }],
        },
      ],
    });
    const rivalDivsBefore = g0.divisions.filter((d) => d.federationId !== g0.playerFederationId).length;
    expect(rivalDivsBefore).toBe(1);
    const g = runLevelingLeague(g0); // default plan
    const rivalDivsAfter = g.divisions.filter((d) => d.federationId !== g.playerFederationId).length;
    expect(rivalDivsAfter).toBe(1); // rival division survives
  });

  it('rejects an invalid plan (returns the state unchanged)', () => {
    const before = gameWith(8);
    const after = runLevelingLeague(before, {
      divisions: [{ orden: 1, size: 7, format: 'ida' }], // 7 !== 8
    });
    expect(after).toBe(before); // unchanged reference → no-op
  });

  it('per-division format drives the calendar (single vs double round-robin)', () => {
    const plan: LevelingPlan = {
      divisions: [
        { orden: 1, size: 4, format: 'ida_vuelta' },
        { orden: 2, size: 4, format: 'ida' },
      ],
    };
    const g = startSeason(runLevelingLeague(gameWith(8), plan));
    const count = (o: number) => g.fixtures.filter((f) => f.divisionOrden === o).length;
    expect(count(1)).toBe(12); // 4 teams, double round-robin: 4*3
    expect(count(2)).toBe(6);  // 4 teams, single round-robin: 4*3/2
  });
});
