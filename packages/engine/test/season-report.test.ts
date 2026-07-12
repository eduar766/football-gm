import { describe, expect, it } from 'vitest';
import {
  advanceSeason,
  closeSeason,
  createCup,
  createGame,
  pendingEvents,
  resolveEvent,
  startSeason,
  type GameState,
} from '../src/index';

const SQUAD = [
  { name: 'Delantero', posicion: 'DEL' as const, calidad: 65 },
  { name: 'Medio', posicion: 'MED' as const, calidad: 60 },
  { name: 'Defensa', posicion: 'DEF' as const, calidad: 58 },
  { name: 'Portero', posicion: 'POR' as const, calidad: 55 },
];

function playableGame(seed: number, teamCount = 6): GameState {
  return createGame(seed, {
    startingTreasury: 100_000_000,
    teams: Array.from({ length: teamCount }, (_, i) => ({
      name: `Equipo ${i + 1}`,
      strength: 55,
      squad: SQUAD,
    })),
  });
}

// Reliable quality-gap setup (mirrors transfers.test.ts's `game()`) — a big
// enough calidad spread between clubs guarantees at least one transfer window
// move, unlike the flat-55-strength playableGame() above.
const gapSquad = (n: number, calidad: number, prefix: string) =>
  Array.from({ length: n }, (_, i) => ({
    name: `${prefix} P${i + 1}`,
    posicion: (['POR', 'DEF', 'MED', 'DEL'] as const)[i % 4],
    calidad,
  }));

function qualityGapGame(seed: number): GameState {
  return createGame(seed, {
    teams: [
      { name: 'Strong FC', strength: 80, squad: gapSquad(20, 78, 'S') },
      { name: 'Mid FC', strength: 60, squad: gapSquad(20, 58, 'M') },
      { name: 'Weak FC', strength: 45, squad: gapSquad(20, 42, 'W') },
    ],
  });
}

// advanceSeason stops early on a pending event (§1) — squads mean events can
// actually spawn, unlike the player-less golden path. Ignore anything pending
// and keep going until the season genuinely finishes (same pattern as
// formats.test.ts's "resolving lets the season continue to its end").
function runFullSeason(g: GameState): GameState {
  let s = g;
  for (let guard = 0; guard < 40 && !s.seasonOver; guard++) {
    s = advanceSeason(s);
    for (const e of pendingEvents(s)) s = resolveEvent(s, e.id, 'ignorar');
  }
  return s;
}

describe('season report — assembly', () => {
  it('pushes exactly one report per close, stamped with the closed year (not the post-bump s.year)', () => {
    let g = playableGame(101);
    g = runFullSeason(startSeason(g));
    expect(g.seasonReports).toHaveLength(0);
    const closedYear = g.year;

    g = closeSeason(g);
    expect(g.seasonReports).toHaveLength(1);
    expect(g.seasonReports[0].year).toBe(closedYear);
    expect(g.year).toBe(closedYear + 1);
  });

  it('has no rival world news and does not crash when there are no confederations', () => {
    let g = playableGame(102);
    g = closeSeason(runFullSeason(startSeason(g)));
    expect(g.seasonReports[0].worldNews).toEqual([]);
  });
});

describe('season report — notableTransfers year alignment', () => {
  // Regression test: transfer-window (270) runs AFTER year-bump (260), so its
  // entries are stamped with the year AFTER the one this report describes —
  // confirmed by transfers.test.ts and the backend's own getTransfers comment
  // ("year is la pretemporada de ese año"). A naive `t.year === reportYear`
  // filter would silently find nothing, forever.
  it('captures the transfer window that just ran as part of this close, despite its post-bump year stamp', () => {
    let g = qualityGapGame(6);
    g = closeSeason(advanceSeason(startSeason(g)));

    expect(g.year).toBe(2); // year-bump already ran
    const report = g.seasonReports.at(-1)!;
    expect(report.year).toBe(1); // report describes the season that just closed
    expect(report.notableTransfers.length).toBeGreaterThan(0);
    expect(report.notableTransfers.every((t) => t.year === 2)).toBe(true);
  });
});

describe('season report — biggestWinThisSeason vs. all-time record', () => {
  it("reflects THIS season's largest margin even when a bigger one is already the all-time record", () => {
    let g = playableGame(103);
    g = runFullSeason(startSeason(g));
    const [a, b] = g.teams;
    // Replace (not append) results with a single controlled 6-0 — organic
    // simulation noise would otherwise make the exact margin non-deterministic.
    g.results = [{ matchday: 1, divisionOrden: 1, homeId: a.id, awayId: b.id, homeGoals: 6, awayGoals: 0 }];
    g = closeSeason(g);
    expect(g.recordBook?.biggestWin?.margin).toBe(6);
    const recordYear = g.seasonReports[0].year;
    expect(g.recordBook?.biggestWin?.year).toBe(recordYear);

    // Season 2: a smaller win (3-0) — must show as this season's biggest win
    // without falsely claiming a new all-time record (6-0 still stands).
    g = runFullSeason(startSeason(g));
    const [c, d] = g.teams;
    g.results = [{ matchday: 1, divisionOrden: 1, homeId: c.id, awayId: d.id, homeGoals: 3, awayGoals: 0 }];
    g = closeSeason(g);

    const report2 = g.seasonReports[1];
    expect(report2.biggestWinThisSeason?.margin).toBe(3);
    expect(report2.allTimeRecordBrokenThisSeason).toHaveLength(0);
    expect(g.recordBook?.biggestWin?.margin).toBe(6); // unchanged
  });
});

describe('season report — featured match selection', () => {
  it('picks the highest tag-priority candidate (derbi over goleada) among the season\'s matches', () => {
    let g = playableGame(104);
    g = runFullSeason(startSeason(g));
    const [t1, t2, t3, t4] = g.teams;

    // Rivalry between t1/t2 (adjacent positions over 2 seasons) tags their
    // matchup as 'derbi' (priority 3) — higher than a plain 'goleada' (2).
    g.teamSeasonHistory = [
      { teamId: t1.id, year: 1, divisionOrden: 1, position: 1, points: 50, won: 15, lost: 2 },
      { teamId: t2.id, year: 1, divisionOrden: 1, position: 2, points: 48, won: 14, lost: 3 },
      { teamId: t1.id, year: 2, divisionOrden: 1, position: 2, points: 45, won: 13, lost: 4 },
      { teamId: t2.id, year: 2, divisionOrden: 1, position: 1, points: 47, won: 14, lost: 3 },
    ];
    g.matchReports = [
      {
        matchday: 1, divisionOrden: 1, homeId: t1.id, awayId: t2.id, homeGoals: 1, awayGoals: 1,
        goalscorers: [], homeYellowCards: 0, awayYellowCards: 0, homeRedCards: 0, awayRedCards: 0,
      },
      {
        matchday: 1, divisionOrden: 1, homeId: t3.id, awayId: t4.id, homeGoals: 5, awayGoals: 0,
        goalscorers: [], homeYellowCards: 0, awayYellowCards: 0, homeRedCards: 0, awayRedCards: 0,
      },
    ];

    g = closeSeason(g);
    const featured = g.seasonReports.at(-1)?.featuredMatch;
    expect(featured).not.toBeNull();
    expect(featured!.tags).toContain('derbi');
  });
});

describe('season report — structuralNotes (promotion/relegation)', () => {
  it('reports both directions correctly: ascends to a lower orden, descends to a higher orden', () => {
    let g = playableGame(107, 12);
    // CreateGameOptions has no multi-division seeding — direct state surgery,
    // same pattern already used for seasonOver/matchReports above: split the
    // 12 teams into two divisions of 6 right after startSeason.
    g.divisions.push({ orden: 2, name: 'Segunda División', federationId: g.playerFederationId, format: 'ida_vuelta' });
    g.teams.forEach((t, i) => { t.divisionOrden = i < 6 ? 1 : 2; });

    g = runFullSeason(startSeason(g));
    g = closeSeason(g);

    const notes = g.seasonReports.at(-1)!.structuralNotes;
    expect(notes.some((n) => n.includes('asciende'))).toBe(true);
    expect(notes.some((n) => n.includes('desciende'))).toBe(true);

    // Cross-check against the actual post-close divisionOrden: every team
    // reported as "asciende" must now be in division 1 (lower orden = higher
    // division), every "desciende" team must now be in division 2.
    for (const t of g.teams) {
      const ascended = notes.some((n) => n.startsWith(t.name) && n.includes('asciende'));
      const descended = notes.some((n) => n.startsWith(t.name) && n.includes('desciende'));
      if (ascended) expect(t.divisionOrden).toBe(1);
      if (descended) expect(t.divisionOrden).toBe(2);
    }
  });
});

describe('season report — force-completed cups (Fase 16 ordering constraint)', () => {
  // forceCompleteIncompleteCups runs at priority 300, AFTER reset-for-pretemporada
  // (290, which wipes results/matchReports) and BEFORE season-report-assemble
  // (305). These tests exist specifically to catch a regression if the assemble
  // step is ever moved to run before cup force-completion.

  it('a liga-format cup left entirely unplayed is force-completed, and its runner-up is 2nd in standings', () => {
    let g = playableGame(105, 8);
    const ids = g.teams.slice(0, 6).map((t) => t.id);
    g = createCup(g, 'Liga Forzada', 'torneo_verano', 'liga', 'primer_equipo', ids);
    g = startSeason(g);
    g.seasonOver = true; // close immediately — the cup never gets a chance to play naturally

    g = closeSeason(g);
    const report = g.seasonReports.at(-1)!;
    const cupResult = report.cupResults.find((c) => c.name === 'Liga Forzada');
    expect(cupResult).toBeDefined();
    expect(cupResult!.championTeamName).not.toBe('—');
    expect(cupResult!.runnerUpTeamName).not.toBeNull();
    expect(cupResult!.runnerUpTeamName).not.toBe(cupResult!.championTeamName);
  });

  it('an eliminatoria cup left entirely unplayed is force-completed and appears in cupResults', () => {
    let g = playableGame(106, 8);
    const ids = g.teams.slice(0, 8).map((t) => t.id);
    g = createCup(g, 'Copa Forzada', 'copa', 'eliminatoria', 'primer_equipo', ids);
    g = startSeason(g);
    g.seasonOver = true;

    g = closeSeason(g);
    const report = g.seasonReports.at(-1)!;
    const cupResult = report.cupResults.find((c) => c.name === 'Copa Forzada');
    expect(cupResult).toBeDefined();
    expect(cupResult!.championTeamName).not.toBe('—');
  });
});

describe('season report — golden safety', () => {
  it('is produced for the default player-less game too, without perturbing state.history', () => {
    let g = createGame(777);
    for (let i = 0; i < 3; i++) g = closeSeason(advanceSeason(startSeason(g)));
    expect(g.seasonReports.length).toBe(3);
    expect(g.history.length).toBeGreaterThan(0);
  });
});
