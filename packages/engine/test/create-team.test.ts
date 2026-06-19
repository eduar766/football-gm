import { describe, expect, it } from 'vitest';
import {
  advanceSeason,
  closeSeason,
  createGame,
  createOwnTeam,
  CREATE_TEAM_COST,
  runLevelingLeague,
  startSeason,
  type GameState,
} from '../src/index';

const players = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    name: `Eq ${i + 1}`,
    strength: 55,
    arraigo: 50,
  }));

describe('create own team (§4.3)', () => {
  it('adds a weak, highly-rooted club to the lowest division and charges it', () => {
    const g = createGame(1, { teams: players(10), startingTreasury: 50_000_000 });
    const before = g.teams.length;
    const s = createOwnTeam(g, '  CD Cantera  ');
    expect(s.teams).toHaveLength(before + 1);
    const t = s.teams[s.teams.length - 1];
    expect(t.name).toBe('CD Cantera'); // trimmed
    expect(t.federationId).toBe(s.playerFederationId);
    expect(t.divisionOrden).toBe(1); // only division = lowest
    expect(t.strength).toBeLessThan(45); // starts weak
    expect(t.arraigo).toBeGreaterThanOrEqual(70); // your own club
    expect(s.treasury).toBe(g.treasury - CREATE_TEAM_COST);
  });

  it('lands in the lowest division when there are several', () => {
    const leveled = runLevelingLeague(
      createGame(2, { teams: players(16), startingTreasury: 50_000_000 }),
    );
    const lowest = leveled.divisions.reduce(
      (m, d) => Math.max(m, d.orden),
      1,
    );
    expect(lowest).toBe(2);
    const s = createOwnTeam(leveled, 'Filial FC');
    expect(s.teams[s.teams.length - 1].divisionOrden).toBe(lowest);
  });

  it('cannot build what you cannot afford', () => {
    const g = createGame(3, { teams: players(10), startingTreasury: 1_000_000 });
    expect(createOwnTeam(g, 'Sin Fondos')).toBe(g); // no-op
  });

  it('rejects an empty name', () => {
    const g = createGame(4, { teams: players(10), startingTreasury: 50_000_000 });
    expect(createOwnTeam(g, '   ')).toBe(g);
  });

  it('the new club joins the calendar built right after pretemporada', () => {
    let s: GameState = createGame(5, {
      teams: players(10),
      startingTreasury: 50_000_000,
    });
    // In pretemporada the calendar does not exist yet (§4.8).
    expect(s.fixtures).toHaveLength(0);
    s = createOwnTeam(s, 'CD Nuevo');
    const newId = s.teams[s.teams.length - 1].id;
    s = startSeason(s);
    expect(s.fixtures.some((f) => f.homeId === newId || f.awayId === newId)).toBe(
      true,
    );
  });

  it('refuses to be created once temporada has begun', () => {
    let s: GameState = startSeason(
      createGame(6, { teams: players(10), startingTreasury: 50_000_000 }),
    );
    expect(s.phase).toBe('temporada');
    expect(createOwnTeam(s, 'Tarde FC')).toBe(s);
  });

  it('is deterministic', () => {
    const run = () => {
      let s = createGame(9, { teams: players(10), startingTreasury: 50_000_000 });
      s = createOwnTeam(s, 'Det FC');
      return closeSeason(advanceSeason(startSeason(s)));
    };
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });
});
