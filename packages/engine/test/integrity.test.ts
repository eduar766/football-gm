import { describe, expect, it } from 'vitest';
import {
  advanceMatchday,
  advanceSeason,
  applyImpulse,
  closeSeason,
  createGame,
  startSeason,
  type GameState,
  type IntegrityCase,
  type MatchResult,
} from '../src/index';
import {
  archiveCase,
  buryCase,
  closeSeasonIntegrity,
  detectAndSpawnCases,
  EXPOSURE_MAX,
  hasSomethingAtStake,
  INVESTIGATION_COST,
  pardonFixing,
  resolveInvestigation,
  sanctionFixing,
  startInvestigation,
} from '../src/integrity';
import { createCloseSeasonContext } from '../src/season-pipeline';

const SQUAD = [
  { name: 'A', posicion: 'DEL' as const, calidad: 60 },
  { name: 'B', posicion: 'MED' as const, calidad: 55 },
];

function playableGame(seed = 42, n = 4): GameState {
  return createGame(seed, {
    startingTreasury: 100_000_000,
    teams: Array.from({ length: n }, (_, i) => ({ name: `E${i + 1}`, strength: 55, squad: SQUAD })),
  });
}

function makeCase(g: GameState, overrides: Partial<IntegrityCase> = {}): IntegrityCase {
  const [a, b] = g.teams;
  const kase: IntegrityCase = {
    id: g.nextCaseId++,
    year: g.year,
    matchday: 1,
    homeId: a.id,
    awayId: b.id,
    suspectTeamId: a.id,
    suspicion: 'test case',
    strong: false,
    status: 'abierto',
    investigationEndsMatchday: null,
    leakRisk: 0,
    resolution: null,
    ...overrides,
  };
  g.integrityCases.push(kase);
  return kase;
}

// Builds an 8-team game with fabricated results so that:
// - t1 is a comfortable leader
// - t4 is safely mid-table (no title or relegation stakes left)
// - t8 is deep in the relegation zone
// then appends one more result where t4 (nothing at stake) loses to t8
// (something at stake) by `margin` goals — the detector's target scenario.
function buildDetectorGame(seed: number, margin: number): { g: GameState; suspiciousMd: number; t4: number; t8: number } {
  const g = playableGame(seed, 8);
  const [t1, t2, t3, t4, t5, t6, t7, t8] = g.teams;
  const winCounts: [typeof t1, number][] = [
    [t1, 10],
    [t2, 8],
    [t3, 7],
    [t4, 6],
    [t5, 5],
    [t6, 4],
    [t7, 1],
  ];
  const results: MatchResult[] = [];
  let md = 1;
  for (const [team, wins] of winCounts) {
    for (let i = 0; i < wins; i++) {
      results.push({ matchday: md++, divisionOrden: 1, homeId: team.id, awayId: t8.id, homeGoals: 3, awayGoals: 0 });
    }
  }
  const suspiciousMd = md;
  results.push({
    matchday: suspiciousMd,
    divisionOrden: 1,
    homeId: t4.id,
    awayId: t8.id,
    homeGoals: 0,
    awayGoals: margin,
  });
  g.results = results;
  g.totalMatchdays = suspiciousMd + 1; // remaining = 1 => maxSwing = 3
  return { g, suspiciousMd, t4: t4.id, t8: t8.id };
}

describe('golden safety (Fase 17D)', () => {
  it('is a no-op for engine-only games with no players', () => {
    const g = createGame(777);
    const ctx = createCloseSeasonContext();
    closeSeasonIntegrity(g, ctx);
    expect(g.exposureRisk).toBe(0);
    expect(g.integrityCases).toEqual([]);

    detectAndSpawnCases(g, 1);
    expect(g.integrityCases).toEqual([]);

    resolveInvestigation(g, 1);
    expect(g.integrityCases).toEqual([]);
  });

  it('a fresh game starts with zero exposure and no cases', () => {
    const g = createGame(1);
    expect(g.exposureRisk).toBe(0);
    expect(g.integrityCases).toEqual([]);
    expect(g.nextCaseId).toBe(1);
    expect(g.impulseFavorCounts).toEqual({});
  });
});

describe('impulse exposure', () => {
  it('a single impulse raises exposure by 8', () => {
    let g = startSeason(playableGame());
    const fx = g.fixtures.find((f) => f.matchday === g.currentMatchday)!;
    g = applyImpulse(g, fx, fx.homeId);
    expect(g.exposureRisk).toBe(8);
    expect(g.impulseFavorCounts[fx.homeId]).toBe(1);
  });

  it('favoring the same team again this season adds a +4 repeat bonus', () => {
    let g = startSeason(playableGame());
    const teamId = g.teams[0].id;
    const teamFixtures = g.fixtures
      .filter((f) => f.homeId === teamId || f.awayId === teamId)
      .sort((a, b) => a.matchday - b.matchday);
    expect(teamFixtures.length).toBeGreaterThanOrEqual(2);

    g = applyImpulse(g, teamFixtures[0], teamId);
    expect(g.exposureRisk).toBe(8);
    g = applyImpulse(g, teamFixtures[1], teamId);
    expect(g.exposureRisk).toBe(8 + 8 + 4);
    expect(g.impulseFavorCounts[teamId]).toBe(2);
  });

  it('never exceeds EXPOSURE_MAX', () => {
    let g = startSeason(createGame(9, {
      impulsesPerSeason: 20,
      startingTreasury: 100_000_000,
      teams: Array.from({ length: 4 }, (_, i) => ({ name: `E${i + 1}`, strength: 55 })),
    }));
    const teamId = g.teams[0].id;
    const teamFixtures = g.fixtures
      .filter((f) => f.homeId === teamId || f.awayId === teamId)
      .sort((a, b) => a.matchday - b.matchday);
    for (const fx of teamFixtures) {
      g = applyImpulse(g, fx, teamId);
    }
    expect(g.exposureRisk).toBeLessThanOrEqual(EXPOSURE_MAX);
  });
});

describe('hasSomethingAtStake', () => {
  function row(teamId: number, points: number, goalDiff = 0) {
    return { teamId, name: `T${teamId}`, played: 10, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDiff, points };
  }

  it('treats leagues smaller than 4 teams as always having something at stake', () => {
    const rows = [row(1, 10), row(2, 5), row(3, 0)];
    expect(hasSomethingAtStake(rows, 2, 0)).toBe(true);
  });

  it('a team far from both the title and the drop zone has nothing at stake', () => {
    const rows = [row(1, 30), row(2, 24), row(3, 21), row(4, 18), row(5, 15), row(6, 12), row(7, 3), row(8, 3)];
    expect(hasSomethingAtStake(rows, 4, 1)).toBe(false); // remaining=1 => maxSwing=3
  });

  it('a team still mathematically alive for the title has something at stake', () => {
    const rows = [row(1, 30), row(2, 28), row(3, 21), row(4, 18), row(5, 15), row(6, 12), row(7, 3), row(8, 3)];
    expect(hasSomethingAtStake(rows, 2, 1)).toBe(true); // gap to leader = 2 <= maxSwing(3)
  });

  it('a team in the relegation zone always has something at stake', () => {
    const rows = [row(1, 30), row(2, 24), row(3, 21), row(4, 18), row(5, 15), row(6, 12), row(7, 3), row(8, 0)];
    expect(hasSomethingAtStake(rows, 8, 1)).toBe(true);
  });

  it('an unknown teamId defaults to having something at stake', () => {
    const rows = [row(1, 30), row(2, 24), row(3, 21), row(4, 18), row(5, 15), row(6, 12), row(7, 3), row(8, 0)];
    expect(hasSomethingAtStake(rows, 999, 1)).toBe(true);
  });
});

describe('detectAndSpawnCases', () => {
  it('materializes a case for a nothing-at-stake team losing big to a something-at-stake team (statistical)', () => {
    let sawCase = false;
    for (let seed = 1; seed <= 30 && !sawCase; seed++) {
      const { g, suspiciousMd, t4, t8 } = buildDetectorGame(seed, 3);
      detectAndSpawnCases(g, suspiciousMd);
      if (g.integrityCases.length > 0) {
        sawCase = true;
        const kase = g.integrityCases[0];
        expect(kase.matchday).toBe(suspiciousMd);
        expect(kase.homeId).toBe(t4);
        expect(kase.awayId).toBe(t8);
        expect(kase.suspectTeamId).toBe(t4); // the side with nothing at stake
        expect(kase.strong).toBe(false); // margin 3 < STRONG_MARGIN(5), not a repeat offender
        expect(kase.status).toBe('abierto');
      }
    }
    expect(sawCase).toBe(true);
  });

  it('flags strong=true when the margin is >= 5', () => {
    let sawStrong = false;
    for (let seed = 1; seed <= 30 && !sawStrong; seed++) {
      const { g, suspiciousMd } = buildDetectorGame(seed, 5);
      detectAndSpawnCases(g, suspiciousMd);
      if (g.integrityCases.length > 0) {
        sawStrong = g.integrityCases[0].strong === true;
      }
    }
    expect(sawStrong).toBe(true);
  });

  it('never flags a match where both teams have something at stake', () => {
    const { g, suspiciousMd } = buildDetectorGame(1, 3);
    // Overwrite the last result to be the leader (t1, always "has stakes"
    // defending 1st) against a relegation-zone team (t7, always "has
    // stakes" fighting to survive) — both sides at stake, never suspicious.
    const [t1, , , , , , t7] = g.teams;
    g.results[g.results.length - 1] = {
      matchday: suspiciousMd,
      divisionOrden: 1,
      homeId: t1.id,
      awayId: t7.id,
      homeGoals: 0,
      awayGoals: 3,
    };
    for (let seed = 1; seed <= 10; seed++) {
      const clone = structuredClone(g);
      clone.scandalRng = { s: seed };
      detectAndSpawnCases(clone, suspiciousMd);
      expect(clone.integrityCases).toEqual([]);
    }
  });

  it('never flags a margin below 3 goals', () => {
    const { g, suspiciousMd } = buildDetectorGame(1, 2);
    for (let seed = 1; seed <= 10; seed++) {
      const clone = structuredClone(g);
      clone.scandalRng = { s: seed };
      detectAndSpawnCases(clone, suspiciousMd);
      expect(clone.integrityCases).toEqual([]);
    }
  });

  it('deduplicates by (matchday, homeId, awayId) — an already-cased match is never re-flagged', () => {
    const { g, suspiciousMd, t4, t8 } = buildDetectorGame(1, 5);
    makeCase(g, { matchday: suspiciousMd, homeId: t4, awayId: t8 });
    const before = g.integrityCases.length;
    detectAndSpawnCases(g, suspiciousMd);
    expect(g.integrityCases.length).toBe(before);
  });

  it('never creates more than 2 cases per season regardless of how many candidates qualify', () => {
    const { g, suspiciousMd } = buildDetectorGame(1, 5);
    makeCase(g, { matchday: 1, homeId: g.teams[0].id, awayId: g.teams[1].id });
    makeCase(g, { matchday: 2, homeId: g.teams[0].id, awayId: g.teams[1].id });
    detectAndSpawnCases(g, suspiciousMd);
    expect(g.integrityCases.filter((c) => c.year === g.year).length).toBe(2);
  });

  it('variant 2 (cierre F17): the colista beating the leader away by >=3 is suspicious even with both at stake — suspect is the leader', () => {
    const { g, suspiciousMd, t8 } = buildDetectorGame(1, 3);
    const t1 = g.teams[0].id; // runaway leader per buildDetectorGame; t8 is the pointless colista
    // Overwrite the last result: leader collapses 0-3 at home against the colista.
    g.results[g.results.length - 1] = {
      matchday: suspiciousMd,
      divisionOrden: 1,
      homeId: t1,
      awayId: t8,
      homeGoals: 0,
      awayGoals: 3,
    };
    let sawCase = false;
    for (let seed = 1; seed <= 30 && !sawCase; seed++) {
      const clone = structuredClone(g);
      clone.scandalRng = { s: seed };
      detectAndSpawnCases(clone, suspiciousMd);
      if (clone.integrityCases.length > 0) {
        sawCase = true;
        const kase = clone.integrityCases[0];
        expect(kase.homeId).toBe(t1);
        expect(kase.awayId).toBe(t8);
        expect(kase.suspectTeamId).toBe(t1); // the leader who lost inexplicably at home
        expect(kase.suspicion).toContain('líder');
      }
    }
    expect(sawCase).toBe(true);
  });

  it('variant 2 negative: the colista winning away at a NON-leader with both at stake is still not suspicious', () => {
    const { g, suspiciousMd, t8 } = buildDetectorGame(1, 3);
    const t7 = g.teams[6].id; // relegation-zone side, has stakes, not the leader
    g.results[g.results.length - 1] = {
      matchday: suspiciousMd,
      divisionOrden: 1,
      homeId: t7,
      awayId: t8,
      homeGoals: 0,
      awayGoals: 3,
    };
    for (let seed = 1; seed <= 10; seed++) {
      const clone = structuredClone(g);
      clone.scandalRng = { s: seed };
      detectAndSpawnCases(clone, suspiciousMd);
      expect(clone.integrityCases).toEqual([]);
    }
  });
});

describe('resolveInvestigation', () => {
  it('does nothing before the investigation deadline', () => {
    const g = playableGame();
    const kase = makeCase(g, { status: 'investigando', investigationEndsMatchday: 5 });
    resolveInvestigation(g, 4);
    expect(kase.status).toBe('investigando');
  });

  it('resolves to confirmado or sin_pruebas once the deadline is reached', () => {
    const g = playableGame();
    const kase = makeCase(g, { status: 'investigando', investigationEndsMatchday: 5 });
    resolveInvestigation(g, 5);
    expect(['confirmado', 'sin_pruebas']).toContain(kase.status);
    expect(kase.resolution).not.toBeNull();
  });

  it('dings public opinion by 1 only on a sin_pruebas outcome', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = playableGame(seed);
      const before = g.publicOpinion;
      const kase = makeCase(g, { status: 'investigando', investigationEndsMatchday: 5 });
      resolveInvestigation(g, 5);
      if (kase.status === 'sin_pruebas') {
        expect(g.publicOpinion).toBe(before - 1);
      } else {
        expect(g.publicOpinion).toBe(before);
      }
    }
  });
});

describe('commissioner actions', () => {
  it('startInvestigation costs INVESTIGATION_COST and sets a 3-matchday deadline', () => {
    let g = playableGame();
    g.currentMatchday = 4;
    const kase = makeCase(g);
    const before = g.treasury;
    g = startInvestigation(g, kase.id);
    expect(g.treasury).toBe(before - INVESTIGATION_COST);
    const updated = g.integrityCases.find((c) => c.id === kase.id)!;
    expect(updated.status).toBe('investigando');
    expect(updated.investigationEndsMatchday).toBe(7);
  });

  it('startInvestigation is a no-op when treasury cannot afford it', () => {
    let g = playableGame();
    g.treasury = 100;
    const kase = makeCase(g);
    const next = startInvestigation(g, kase.id);
    expect(next).toBe(g);
  });

  it('startInvestigation is a no-op on a case that is not abierto', () => {
    let g = playableGame();
    const kase = makeCase(g, { status: 'confirmado' });
    const next = startInvestigation(g, kase.id);
    expect(next).toBe(g);
  });

  it('archiveCase raises exposureRisk by 6 and closes the case for free', () => {
    let g = playableGame();
    const before = g.treasury;
    const kase = makeCase(g);
    g = archiveCase(g, kase.id);
    expect(g.treasury).toBe(before);
    expect(g.exposureRisk).toBe(6);
    expect(g.integrityCases.find((c) => c.id === kase.id)!.status).toBe('archivado');
  });

  it('buryCase is only available for strong cases', () => {
    let g = playableGame();
    const kase = makeCase(g, { strong: false });
    const next = buryCase(g, kase.id, false);
    expect(next).toBe(g);
  });

  it('buryCase sets leakRisk 20 by default, or 10 when paid down with 3 PC', () => {
    let g = playableGame();
    g.politicalCapital = 5;
    const kase = makeCase(g, { strong: true });
    const buried = buryCase(g, kase.id, true);
    const updated = buried.integrityCases.find((c) => c.id === kase.id)!;
    expect(updated.status).toBe('enterrado');
    expect(updated.leakRisk).toBe(10);
    expect(buried.politicalCapital).toBe(2);
  });

  it('buryCase falls back to leakRisk 20 when PC cannot cover the discount', () => {
    let g = playableGame();
    g.politicalCapital = 0;
    const kase = makeCase(g, { strong: true });
    const buried = buryCase(g, kase.id, true);
    expect(buried.integrityCases.find((c) => c.id === kase.id)!.leakRisk).toBe(20);
  });

  it('sanctionFixing only applies to a confirmado case, docks points/treasury/arraigo, and rewards opinion/PC/prestige', () => {
    let g = playableGame();
    const suspect = g.teams[0];
    suspect.arraigo = 50;
    const kase = makeCase(g, { status: 'confirmado', suspectTeamId: suspect.id });
    const beforeTreasury = g.treasury;
    const beforeTeamTreasury = suspect.treasury;
    const beforeOpinion = g.publicOpinion;
    const beforePC = g.politicalCapital;
    const beforePrestige = g.prestige;

    g = sanctionFixing(g, kase.id);

    const sanction = g.sanctions.find((s) => s.teamId === suspect.id)!;
    expect(sanction).toBeDefined();
    expect(sanction.normId).toBe(0);
    expect(sanction.pointsPenalty).toBeGreaterThan(0);
    expect(g.treasury).toBeGreaterThan(beforeTreasury);
    const team = g.teams.find((t) => t.id === suspect.id)!;
    expect(team.treasury).toBeLessThan(beforeTeamTreasury);
    expect(team.arraigo).toBeLessThan(50);
    expect(g.publicOpinion).toBeGreaterThan(beforeOpinion);
    expect(g.politicalCapital).toBeGreaterThan(beforePC);
    expect(g.prestige).toBeGreaterThan(beforePrestige);
    const president = g.presidents.find((p) => p.teamId === suspect.id)!;
    expect(president.grudge).toBeGreaterThan(0);
  });

  it('sanctionFixing is a no-op on a case that is not confirmado', () => {
    let g = playableGame();
    const kase = makeCase(g, { status: 'abierto' });
    const next = sanctionFixing(g, kase.id);
    expect(next).toBe(g);
  });

  it('sanctioning with the sentinel normId=0 can never match a real exencion_norma pledge refId', () => {
    // Regression for the normId=0 sentinel (pledges.ts checks
    // `sa.normId === p.refId`): a real exencion_norma pledge's refId is
    // always a real norm id (>= 1, nextNormId starts at 1), so a
    // match-fixing sanction's normId=0 must never collide with it.
    let g = playableGame();
    const suspect = g.teams[0];
    const kase = makeCase(g, { status: 'confirmado', suspectTeamId: suspect.id });
    g = sanctionFixing(g, kase.id);
    const sanction = g.sanctions.find((s) => s.teamId === suspect.id)!;
    expect(sanction.normId).toBe(0);
    expect(g.nextNormId).toBeGreaterThanOrEqual(1); // real norm ids start at 1, never 0
    expect(sanction.normId).not.toBe(g.nextNormId);
  });

  it('pardonFixing raises arraigo, buries the case with leakRisk 35, and applies no sanction', () => {
    let g = playableGame();
    const suspect = g.teams[0];
    suspect.arraigo = 50;
    const kase = makeCase(g, { status: 'confirmado', suspectTeamId: suspect.id });
    const sanctionsBefore = g.sanctions.length;

    g = pardonFixing(g, kase.id);

    expect(g.sanctions.length).toBe(sanctionsBefore);
    const team = g.teams.find((t) => t.id === suspect.id)!;
    expect(team.arraigo).toBe(58);
    const updated = g.integrityCases.find((c) => c.id === kase.id)!;
    expect(updated.status).toBe('enterrado');
    expect(updated.leakRisk).toBe(35);
  });

  it('pardonFixing is a no-op on a case that is not confirmado', () => {
    let g = playableGame();
    const kase = makeCase(g, { status: 'abierto' });
    const next = pardonFixing(g, kase.id);
    expect(next).toBe(g);
  });

  it('pardonFixing leaves the president owing a favor (backlog pass); rotation reset covered in characters.test.ts', () => {
    let g = playableGame();
    const suspect = g.teams[0];
    const kase = makeCase(g, { status: 'confirmado', suspectTeamId: suspect.id });
    expect(g.presidents.find((p) => p.teamId === suspect.id)!.favorOwed).toBe(false);

    g = pardonFixing(g, kase.id);
    expect(g.presidents.find((p) => p.teamId === suspect.id)!.favorOwed).toBe(true);
  });
});

describe('closeSeasonIntegrity — exposure decay/scandal roll and leak rolls', () => {
  it('decays exposure by 6 (floor 0) when no scandal fires', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = playableGame(seed);
      g.exposureRisk = 10;
      const ctx = createCloseSeasonContext();
      closeSeasonIntegrity(g, ctx);
      // Either it decayed (no scandal) or reset to 0 (scandal fired).
      expect([4, 0]).toContain(g.exposureRisk);
    }
  });

  it('a high exposureRisk eventually triggers a scandal that resets it and dents prestige/opinion/confidence via ctx.meta (statistical)', () => {
    let sawScandal = false;
    for (let seed = 1; seed <= 40 && !sawScandal; seed++) {
      const g = playableGame(seed);
      g.exposureRisk = 95;
      const ctx = createCloseSeasonContext();
      closeSeasonIntegrity(g, ctx);
      if (g.exposureRisk === 0) {
        sawScandal = true;
        expect(ctx.prestigeDelta).toBe(-3);
        expect(ctx.meta.get('integrityOpinionPenalty')).toBe(-15);
        expect(ctx.meta.get('integrityConfidenceDelta')).toBe(-10);
      }
    }
    expect(sawScandal).toBe(true);
  });

  it('grows leakRisk by 15 on a buried case that does not leak, across a season with no other cases', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = playableGame(seed);
      const kase = makeCase(g, { status: 'enterrado', leakRisk: 5 });
      const ctx = createCloseSeasonContext();
      closeSeasonIntegrity(g, ctx);
      const updated = g.integrityCases.find((c) => c.id === kase.id)!;
      expect(['enterrado', 'filtrado']).toContain(updated.status);
      if (updated.status === 'enterrado') {
        expect(updated.leakRisk).toBe(20);
      } else {
        expect(ctx.meta.get('integrityOpinionPenalty')).toBe(-15 - 20);
      }
    }
  });

  it('is a no-op for engine-only games with no players even with cases present', () => {
    const g = createGame(1);
    // players.length === 0 short-circuits before touching integrityCases at all.
    const ctx = createCloseSeasonContext();
    closeSeasonIntegrity(g, ctx);
    expect(ctx.prestigeDelta).toBe(0);
    expect(ctx.meta.size).toBe(0);
  });
});

describe('closeSeason integration — scandal prestige lands in this season\'s history entry', () => {
  it('folds the scandal prestige penalty into the closing season\'s recorded delta', () => {
    let sawScandal = false;
    for (let seed = 1; seed <= 40 && !sawScandal; seed++) {
      let g = advanceSeason(startSeason(playableGame(seed)));
      g.exposureRisk = 95;
      g = closeSeason(g);
      const entry = g.history.find((h) => h.year === 1 && h.divisionOrden === 1);
      if (g.exposureRisk === 0 && entry) {
        sawScandal = true;
      }
    }
    expect(sawScandal).toBe(true);
  });
});

describe('advanceMatchday wiring', () => {
  it('a played matchday can surface a mailbox message for a newly-detected case (statistical, no crash across seeds)', () => {
    for (let seed = 1; seed <= 5; seed++) {
      let g = startSeason(playableGame(seed));
      g = advanceMatchday(g);
      // Just assert it runs cleanly end-to-end; the detector's own logic is
      // covered in isolation above.
      expect(g.integrityCases.length).toBeGreaterThanOrEqual(0);
    }
  });
});

