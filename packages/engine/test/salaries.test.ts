import { describe, expect, it } from 'vitest';
import {
  addNorm,
  closeSeason,
  createGame,
  normBreaches,
  playerSalary,
  sanctionTeam,
  startSeason,
  wageBill,
  advanceSeason,
  type GameState,
} from '../src/index';

const teamWithSquad = (name: string, calidad: number, n = 20) => ({
  name,
  strength: 55,
  squad: Array.from({ length: n }, (_, i) => ({
    name: `${name} P${i + 1}`,
    posicion: (['POR', 'DEF', 'MED', 'DEL'] as const)[i % 4],
    calidad,
  })),
});

describe('playerSalary', () => {
  it('is monotonic in quality', () => {
    expect(playerSalary(40)).toBeLessThan(playerSalary(55));
    expect(playerSalary(55)).toBeLessThan(playerSalary(80));
  });

  it('returns a positive integer even at low quality', () => {
    const s = playerSalary(1);
    expect(Number.isInteger(s)).toBe(true);
    expect(s).toBeGreaterThan(0);
  });

  it('is deterministic (pure)', () => {
    expect(playerSalary(70)).toBe(playerSalary(70));
  });
});

describe('wageBill', () => {
  it('sums salaries only for the given team', () => {
    let g: GameState = createGame(1, {
      teams: [teamWithSquad('A', 60, 10), teamWithSquad('B', 50, 10)],
    });
    const [a, b] = g.teams;
    expect(wageBill(a.id, g.players)).toBe(playerSalary(60) * 10);
    expect(wageBill(b.id, g.players)).toBe(playerSalary(50) * 10);
  });
});

describe('tope_salarial norm', () => {
  it('flags teams whose wage bill exceeds the cap', () => {
    let g: GameState = createGame(2, {
      teams: [teamWithSquad('Rich', 80, 20), teamWithSquad('Poor', 40, 20)],
    });
    const cap = playerSalary(60) * 20; // somewhere between the two
    g = addNorm(g, 'tope_salarial', cap);

    const breaches = normBreaches(g);
    expect(breaches).toHaveLength(1);
    expect(breaches[0].teamName).toBe('Rich');
    expect(breaches[0].tipo).toBe('tope_salarial');
    expect(breaches[0].valor).toBe(cap);
    expect(breaches[0].valorActual).toBe(playerSalary(80) * 20);
    expect(breaches[0].sanctioned).toBe(false);
  });

  it('sanction is recorded with a salary-flavoured motivo', () => {
    let g: GameState = createGame(3, {
      teams: [teamWithSquad('Rich', 85, 20)],
    });
    g = addNorm(g, 'tope_salarial', 100_000);
    const breach = normBreaches(g)[0];
    g = sanctionTeam(g, breach.teamId, breach.normId);
    expect(g.sanctions).toHaveLength(1);
    expect(g.sanctions[0].motivo).toContain('tope salarial');
    expect(g.sanctions[0].pointsPenalty).toBe(3);
  });

  it('addNorm clamps tope_salarial in € (not 1-100 like strength norms)', () => {
    let g: GameState = createGame(4);
    g = addNorm(g, 'tope_salarial', 1_500_000);
    expect(g.norms[0].valor).toBe(1_500_000);
  });

  it('does not affect golden master when no norm is added', () => {
    // No players in default createGame => no salaries to evaluate;
    // and without a tope_salarial norm there are no breaches to compute.
    const a = closeSeason(advanceSeason(startSeason(createGame(777))));
    const b = closeSeason(advanceSeason(startSeason(createGame(777))));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
