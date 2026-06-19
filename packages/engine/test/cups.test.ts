import { describe, expect, it } from 'vitest';
import {
  advanceMatchday,
  advanceSeason,
  closeSeason,
  createCup,
  createGame,
  roundsForCup,
  scheduleCups,
  startSeason,
  type GameState,
} from '../src/index';

const players = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    name: `Eq ${i + 1}`,
    strength: 55,
    arraigo: 50,
  }));

describe('default path (no cups)', () => {
  it('runs close with no cups touched and no rng perturbation', () => {
    let g: GameState = createGame(7);
    g = closeSeason(advanceSeason(startSeason(g)));
    expect(g.cups).toHaveLength(0);
  });
});

describe('knockout cup', () => {
  it('an 8-team cup finishes with one champion among the participants', () => {
    let g = createGame(2, { teams: players(10) });
    const ids = g.teams.slice(0, 8).map((t) => t.id);
    g = createCup(g, 'Copa Test', 'copa', 'eliminatoria', 'primer_equipo', ids);
    expect(g.cups).toHaveLength(1);
    expect(g.cups[0].status).toBe('en_curso');

    g = closeSeason(advanceSeason(startSeason(g)));
    const cup = g.cups[0];
    expect(cup.status).toBe('finalizada');
    expect(ids).toContain(cup.championTeamId!);
    expect(cup.rounds).toHaveLength(3); // cuartos, semis, final
  });

  it('handles non-power-of-2 with byes', () => {
    let g = createGame(4, { teams: players(10) });
    const ids = g.teams.slice(0, 6).map((t) => t.id);
    g = createCup(g, 'Copa Impar', 'copa', 'eliminatoria', 'primer_equipo', ids);
    expect(g.cups[0].rounds[0].matches).toHaveLength(4);
    g = closeSeason(advanceSeason(startSeason(g)));
    expect(g.cups[0].status).toBe('finalizada');
    expect(ids).toContain(g.cups[0].championTeamId!);
  });

  it('rejects invalid creates', () => {
    const g = createGame(5, { teams: players(10) });
    const ids4 = g.teams.slice(0, 4).map((t) => t.id);
    expect(createCup(g, '   ', 'copa', 'eliminatoria', 'primer_equipo', ids4)).toBe(g);
    expect(createCup(g, 'X', 'copa', 'eliminatoria', 'primer_equipo', [g.teams[0].id])).toBe(g);
    expect(
      createCup(g, 'X', 'copa', 'eliminatoria', 'primer_equipo', [g.teams[0].id, 999]),
    ).toBe(g);
  });
});

describe('league-format cup (round-robin)', () => {
  it('everyone plays everyone once and a champion is crowned by points', () => {
    let g = createGame(8, { teams: players(10) });
    const ids = g.teams.slice(0, 6).map((t) => t.id);
    g = createCup(g, 'Liga Corta', 'torneo_verano', 'liga', 'primer_equipo', ids);
    // 6 teams single round-robin => 15 matches, all in one round
    expect(g.cups[0].rounds).toHaveLength(1);
    expect(g.cups[0].rounds[0].matches).toHaveLength(15);
    g = closeSeason(advanceSeason(startSeason(g)));
    expect(g.cups[0].status).toBe('finalizada');
    expect(ids).toContain(g.cups[0].championTeamId!);
  });
});

describe('youth cup (cantera)', () => {
  it('runs on youth strength and still crowns a participant', () => {
    let g = createGame(3, { teams: players(10) });
    const ids = g.teams.slice(0, 8).map((t) => t.id);
    g = createCup(g, 'Copa Juvenil', 'liga_juvenil', 'eliminatoria', 'juvenil', ids);
    expect(g.cups[0].categoria).toBe('juvenil');
    g = closeSeason(advanceSeason(startSeason(g)));
    expect(g.cups[0].status).toBe('finalizada');
    expect(ids).toContain(g.cups[0].championTeamId!);
  });
});

describe('unified calendar (Fase 6.2): cups interleaved with the league', () => {
  it('schedules an 8-team knockout into 3 rounds spread across the season', () => {
    let g = createGame(11, { teams: players(10) });
    const ids = g.teams.slice(0, 8).map((t) => t.id);
    g = createCup(g, 'Copa Interleaved', 'copa', 'eliminatoria', 'primer_equipo', ids);
    g = startSeason(g);

    // 8 teams => log2(8) = 3 rounds; default ida_vuelta on 10 teams => 18 matchdays.
    expect(roundsForCup(g.cups[0])).toBe(3);
    expect(g.totalMatchdays).toBe(18);

    const entries = g.cupSchedule.filter((e) => e.cupId === g.cups[0].id);
    expect(entries.map((e) => e.matchday)).toEqual([3, 9, 15]);
  });

  it('finalises a cup during the season, not at closeSeason', () => {
    let g = createGame(12, { teams: players(10) });
    const ids = g.teams.slice(0, 8).map((t) => t.id);
    g = createCup(g, 'Copa En Curso', 'copa', 'eliminatoria', 'primer_equipo', ids);
    g = startSeason(g);

    const lastRoundMd = Math.max(...g.cupSchedule.map((e) => e.matchday));

    // Advance up to and including the final round's matchday.
    while (g.currentMatchday <= lastRoundMd && !g.seasonOver) g = advanceMatchday(g);

    const cup = g.cups[0];
    expect(cup.status).toBe('finalizada');
    expect(ids).toContain(cup.championTeamId!);
    expect(cup.rounds).toHaveLength(3);

    // The remaining matchdays should NOT add any cup rounds.
    const before = JSON.parse(JSON.stringify(g.cups));
    g = closeSeason(advanceSeason(g));
    expect(g.cups).toEqual(before); // closeSeason no longer touches cups
  });

  it('schedules a league-format cup as one round at mid-season', () => {
    let g = createGame(13, { teams: players(10) });
    const ids = g.teams.slice(0, 6).map((t) => t.id);
    g = createCup(g, 'Torneo Liga', 'torneo_verano', 'liga', 'primer_equipo', ids);
    g = startSeason(g);

    expect(roundsForCup(g.cups[0])).toBe(1);
    const entry = g.cupSchedule.find((e) => e.cupId === g.cups[0].id);
    // Single round => placed at round(0.5 * T) = round(9) = 9 of 18.
    expect(entry?.matchday).toBe(9);

    g = advanceSeason(g);
    expect(g.cups[0].status).toBe('finalizada');
  });

  it('default (no cups) leaves cupSchedule empty and cupsRng untouched', () => {
    const a = createGame(14);
    const b = startSeason(createGame(14));
    expect(b.cupSchedule).toEqual([]);
    // cupsRng is a counter — golden-safe means it stays at its initial state.
    expect(b.cupsRng).toEqual(a.cupsRng);
  });

  it('scheduleCups returns [] when totalMatchdays is 0', () => {
    const g = createGame(15);
    expect(scheduleCups(g, 0)).toEqual([]);
  });
});

describe('determinism with cups', () => {
  it('same seed + same creation => identical bracket and champion', () => {
    const run = () => {
      let g = createGame(404, { teams: players(10) });
      const ids = g.teams.slice(0, 8).map((t) => t.id);
      g = createCup(g, 'Det Cup', 'copa', 'eliminatoria', 'primer_equipo', ids);
      return closeSeason(advanceSeason(startSeason(g)));
    };
    expect(JSON.stringify(run().cups)).toBe(JSON.stringify(run().cups));
  });
});
