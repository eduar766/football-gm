import { describe, expect, it } from 'vitest';
import {
  advanceSeason,
  closeSeason,
  createGame,
  pendingEvents,
  resolveEvent,
  startSeason,
  type GameState,
  type PlayerSeed,
} from '../src/index';

const POSITIONS = ['POR', 'DEF', 'MED', 'DEL'] as const;
const SIZES = [2, 6, 7, 5] as const;

function squad(idx: number): PlayerSeed[] {
  const out: PlayerSeed[] = [];
  let n = 1;
  for (let i = 0; i < POSITIONS.length; i++) {
    for (let k = 0; k < SIZES[i]; k++) {
      out.push({
        name: `T${idx}-${POSITIONS[i]}-${n++}`,
        posicion: POSITIONS[i],
        calidad: 55,
      });
    }
  }
  return out;
}

const squadedTeams = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    name: `Eq ${i + 1}`,
    strength: 55,
    arraigo: 50,
    squad: squad(i + 1),
  }));

describe('default path (no players)', () => {
  it('spawns no events and keeps history bytewise stable', () => {
    let g: GameState = createGame(7);
    g = closeSeason(advanceSeason(startSeason(g)));
    expect(g.events).toHaveLength(0);
  });
});

describe('events spawn during the season', () => {
  it('produces some events across a few seasons (rare but real)', () => {
    let g: GameState = createGame(11, { teams: squadedTeams(10) });
    for (let i = 0; i < 3; i++) {
      g = closeSeason(advanceSeason(startSeason(g)));
    }
    expect(g.events.length).toBeGreaterThan(0);
  });
});

describe('resolve actuar vs ignorar', () => {
  it('actuar drains treasury and lowers team arraigo', () => {
    let g = startSeason(createGame(13, { teams: squadedTeams(10) }));
    g = advanceSeason(g);
    const pending = pendingEvents(g);
    const ev = pending.find((e) => e.teamId !== null);
    if (!ev) return; // rare seed: no team-attached event
    const team = g.teams.find((t) => t.id === ev.teamId)!;
    const arraigoBefore = team.arraigo;
    const treasuryBefore = g.treasury;
    g = resolveEvent(g, ev.id, 'actuar');
    const e2 = g.events.find((e) => e.id === ev.id)!;
    expect(e2.status).toBe('resuelto_actuar');
    expect(g.treasury).toBeLessThan(treasuryBefore);
    expect(g.teams.find((t) => t.id === ev.teamId)!.arraigo).toBeLessThan(
      arraigoBefore,
    );
  });

  it('ignorar lowers prestige', () => {
    let g = startSeason(createGame(17, { teams: squadedTeams(10) }));
    g = advanceSeason(g);
    const ev = pendingEvents(g)[0];
    if (!ev) return;
    const before = g.prestige;
    g = resolveEvent(g, ev.id, 'ignorar');
    expect(g.events.find((e) => e.id === ev.id)!.status).toBe(
      'resuelto_ignorar',
    );
    expect(g.prestige).toBeLessThanOrEqual(before);
  });
});

describe('actuar vs ignorar over several seasons', () => {
  it('ignoring everything ends with no more prestige than acting', () => {
    const opts = {
      teams: squadedTeams(10),
      startingTreasury: 800_000_000,
    };
    // advanceSeason now stops on a pending event, so each season is played by
    // resolving every polémica before continuing.
    const play = (action: 'actuar' | 'ignorar') => {
      let s: GameState = createGame(23, opts);
      for (let year = 0; year < 4; year++) {
        s = startSeason(s);
        for (let guard = 0; guard < 40 && !s.seasonOver; guard++) {
          s = advanceSeason(s);
          for (const e of pendingEvents(s)) s = resolveEvent(s, e.id, action);
        }
        s = closeSeason(s);
      }
      return s;
    };
    expect(play('actuar').prestige).toBeGreaterThanOrEqual(play('ignorar').prestige);
  });
});

describe('determinism with events', () => {
  it('same seed + same resolutions => identical state', () => {
    const run = () => {
      let g = startSeason(createGame(404, { teams: squadedTeams(10) }));
      g = advanceSeason(g);
      const ids = pendingEvents(g).map((e) => e.id);
      for (const id of ids) g = resolveEvent(g, id, 'actuar');
      return closeSeason(g);
    };
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });
});

describe('public-component events move opinion (Fase 17B §3.2, cierre F17)', () => {
  function withSyntheticEvent(tipo: 'arbitraje_dudoso' | 'crisis_economica_club'): GameState {
    const g = startSeason(createGame(505, { startingTreasury: 100_000_000, teams: squadedTeams(6) }));
    g.events.push({
      id: g.nextEventId++, year: g.year, matchday: 1, tipo,
      status: 'pendiente', teamId: g.teams[0].id, message: 'x',
      resolvedAction: null, severity: 'media', chainedFromId: null,
    });
    return g;
  }

  it('acting on a public event raises opinion; ignoring lowers it', () => {
    const base = withSyntheticEvent('arbitraje_dudoso');
    const before = base.publicOpinion;
    const acted = resolveEvent(base, base.events.at(-1)!.id, 'actuar');
    expect(acted.publicOpinion).toBe(Math.min(100, before + 3));
    const ignored = resolveEvent(base, base.events.at(-1)!.id, 'ignorar');
    expect(ignored.publicOpinion).toBe(Math.max(0, before - 4));
  });

  it('non-public events leave opinion untouched either way', () => {
    const base = withSyntheticEvent('crisis_economica_club');
    const before = base.publicOpinion;
    expect(resolveEvent(base, base.events.at(-1)!.id, 'actuar').publicOpinion).toBe(before);
    expect(resolveEvent(base, base.events.at(-1)!.id, 'ignorar').publicOpinion).toBe(before);
  });
});
