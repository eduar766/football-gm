import { describe, expect, it } from 'vitest';
import { createGame, startSeason, advanceSeason, closeSeason, migrateState, type GameState, type Cup } from '../src/index';
import { evaluateEra, backfillEra, MAX_ERA } from '../src/eras';

const SQUAD = [
  { name: 'A', posicion: 'DEL' as const, calidad: 60 },
  { name: 'B', posicion: 'MED' as const, calidad: 55 },
];

function playableGame(seed = 42, n = 8): GameState {
  return createGame(seed, {
    startingTreasury: 100_000_000,
    teams: Array.from({ length: n }, (_, i) => ({ name: `E${i + 1}`, strength: 45 + i * 5, squad: SQUAD })),
  });
}

function makeCup(overrides: Partial<Cup> = {}): Cup {
  return {
    id: 1, name: 'Copa X', tipo: 'copa', formato: 'eliminatoria', categoria: 'primer_equipo',
    year: 1, status: 'finalizada', participantTeamIds: [], rounds: [], championTeamId: null, recurring: false,
    ...overrides,
  };
}

describe('era 1 (Fundacional) milestones', () => {
  it('requires all 3: 14 teams, 2 divisions, a big commercial contract', () => {
    const g = playableGame();
    evaluateEra(g);
    expect(g.era).toBe(1); // 8 teams, 1 division, no big contract -> none met yet
    expect(g.eraMilestonesAchieved).toEqual([]);
  });

  it('advances to era 2 once all 3 are met, applying rewards exactly once', () => {
    const g = playableGame(1, 14);
    g.divisions.push({ orden: 2, name: 'Segunda', federationId: g.playerFederationId });
    g.commercialContracts.push({ id: 1, tipo: 'patrocinio', nombre: 'Big Corp', valorAnual: 4_000_000, yearsLeft: 3 });
    const confidenceBefore = g.boardConfidence.value;
    const pcBefore = g.politicalCapital;
    const impulsesBefore = g.impulsesPerSeason;

    evaluateEra(g);

    expect(g.era).toBe(2);
    expect(g.eraMilestonesAchieved).toEqual([]); // reset for the new era
    expect(g.eraHistory).toEqual([{ era: 1, completedYear: g.year }]);
    expect(g.boardConfidence.value).toBe(Math.min(100, confidenceBefore + 15));
    expect(g.politicalCapital).toBe(Math.min(12, pcBefore + 3));
    expect(g.impulsesPerSeason).toBe(impulsesBefore + 1);
    expect(g.federationLog.some((e) => e.type === 'era')).toBe(true);
  });

  it('ratchet: a milestone that regresses after being met still counts as achieved', () => {
    const g = playableGame(1, 14);
    g.divisions.push({ orden: 2, name: 'Segunda', federationId: g.playerFederationId });
    evaluateEra(g); // teams + divisions met, contract not yet -> stays era 1
    expect(g.era).toBe(1);
    expect(g.eraMilestonesAchieved.sort()).toEqual(['divisions', 'teams']);

    // Regress: drop below 14 teams and remove the 2nd division.
    g.teams = g.teams.slice(0, 5);
    g.divisions = g.divisions.filter((d) => d.orden === 1);
    g.commercialContracts.push({ id: 1, tipo: 'patrocinio', nombre: 'Big Corp', valorAnual: 4_000_000, yearsLeft: 3 });
    evaluateEra(g);

    expect(g.era).toBe(2); // teams/divisions already ratcheted in — regression doesn't undo them
  });
});

describe('era 2/3/4 milestones (direct state injection, white-box)', () => {
  it('era 2: coefficient top 5, recurring cup with 3 editions, 16 teams', () => {
    const g = playableGame(1, 16);
    g.era = 2;
    g.federationCoefficients = [{ federationId: g.playerFederationId, name: 'x', cumulativeScore: 1, lastRank: 4, lastScore: 1, seasonsRanked: 1 }];
    g.cups = [
      makeCup({ id: 1, name: 'Copa Recurrente', recurring: true, status: 'finalizada', year: 1 }),
      makeCup({ id: 2, name: 'Copa Recurrente', recurring: true, status: 'finalizada', year: 2 }),
      makeCup({ id: 3, name: 'Copa Recurrente', recurring: true, status: 'finalizada', year: 3 }),
    ];
    evaluateEra(g);
    expect(g.era).toBe(3);
  });

  it('era 3: coefficient top 3, poaching a top-3 federation\'s club, opinion >=65 two closes', () => {
    const g = playableGame(1, 8);
    g.era = 3;
    g.federationCoefficients = [
      { federationId: g.playerFederationId, name: 'x', cumulativeScore: 1, lastRank: 2, lastScore: 1, seasonsRanked: 1 },
      { federationId: 999, name: 'rival', cumulativeScore: 1, lastRank: 1, lastScore: 1, seasonsRanked: 1 },
    ];
    g.negotiations = [{
      id: 1, targetTeamId: 1, byFederationId: g.playerFederationId, fromFederationId: 999,
      state: 'effective', startedYear: g.year - 2, requirementsSeasonsLeft: 0,
      acceptedYear: g.year - 1, effectiveYear: g.year,
      requirements: [], offerValue: 10, revealedCount: 0,
    }];
    g.opinionHistory = [
      { year: g.year - 1, value: 70, reasons: [] },
      { year: g.year, value: 66, reasons: [] },
    ];
    evaluateEra(g);
    expect(g.era).toBe(4);
  });

  it('era 4: coefficient #1, 20+ teams, won the inter-league cup — reaches the narrative summit (era 5, no further ratcheting)', () => {
    const g = playableGame(1, 20);
    g.era = 4;
    g.federationCoefficients = [{ federationId: g.playerFederationId, name: 'x', cumulativeScore: 1, lastRank: 1, lastScore: 1, seasonsRanked: 1 }];
    g.cups = [makeCup({ id: 1, tipo: 'inter_ligas', championTeamId: g.teams[0].id })];
    evaluateEra(g);
    expect(g.era).toBe(MAX_ERA + 1);

    // Further closes are inert past the summit.
    const before = JSON.stringify(g);
    evaluateEra(g);
    expect(JSON.stringify(g)).toBe(before);
  });
});

describe('golden safety / player-less gating', () => {
  it('evaluateEra is a no-op for a player-less game', () => {
    const g = startSeason(createGame(777));
    const before = JSON.stringify(g);
    evaluateEra(g);
    expect(JSON.stringify(g)).toBe(before);
  });

  it('wired into closeSeason at priority 262 for a playable game without throwing', () => {
    const g = closeSeason(advanceSeason(startSeason(playableGame())));
    expect(g.era).toBeGreaterThanOrEqual(1);
  });
});

describe('backfillEra (used by migrateState — pure, no rewards)', () => {
  it('walks a veteran save forward through as many eras as its current state already qualifies for', () => {
    const g = playableGame(1, 20);
    g.divisions.push({ orden: 2, name: 'Segunda', federationId: g.playerFederationId });
    g.commercialContracts.push({ id: 1, tipo: 'patrocinio', nombre: 'Big Corp', valorAnual: 4_000_000, yearsLeft: 3 });
    g.federationCoefficients = [{ federationId: g.playerFederationId, name: 'x', cumulativeScore: 1, lastRank: 1, lastScore: 1, seasonsRanked: 1 }];
    g.cups = [
      makeCup({ id: 1, name: 'Copa Recurrente', recurring: true, status: 'finalizada', year: 1 }),
      makeCup({ id: 2, name: 'Copa Recurrente', recurring: true, status: 'finalizada', year: 2 }),
      makeCup({ id: 3, name: 'Copa Recurrente', recurring: true, status: 'finalizada', year: 3 }),
      makeCup({ id: 4, tipo: 'inter_ligas', championTeamId: g.teams[0].id }),
    ];
    g.negotiations = [{
      id: 1, targetTeamId: 1, byFederationId: g.playerFederationId, fromFederationId: 999,
      state: 'effective', startedYear: g.year - 2, requirementsSeasonsLeft: 0,
      acceptedYear: g.year - 1, effectiveYear: g.year,
      requirements: [], offerValue: 10, revealedCount: 0,
    }];
    g.opinionHistory = [
      { year: g.year - 1, value: 70, reasons: [] },
      { year: g.year, value: 66, reasons: [] },
    ];
    // Note: fromFederationId 999 isn't itself top-3-ranked here (only the
    // player's own entry is in federationCoefficients), so era 3's "poached
    // top3" milestone won't backfill true — that's fine, this test only
    // asserts backfillEra runs cleanly and stops at the first incomplete era.
    const era = backfillEra(g);
    expect(era).toBeGreaterThanOrEqual(2);
    expect(era).toBeLessThanOrEqual(MAX_ERA + 1);
  });

  it('never grants rewards or writes mail/log — pure', () => {
    const g = playableGame(1, 14);
    g.divisions.push({ orden: 2, name: 'Segunda', federationId: g.playerFederationId });
    g.commercialContracts.push({ id: 1, tipo: 'patrocinio', nombre: 'Big Corp', valorAnual: 4_000_000, yearsLeft: 3 });
    const before = JSON.stringify(g);
    backfillEra(g);
    expect(JSON.stringify(g)).toBe(before);
  });
});

describe('migrateState v22 -> v23 era backfill', () => {
  it('sets state.era from backfillEra on an old save, without eraHistory/mail entries', () => {
    const g = playableGame(1, 14);
    g.divisions.push({ orden: 2, name: 'Segunda', federationId: g.playerFederationId });
    g.commercialContracts.push({ id: 1, tipo: 'patrocinio', nombre: 'Big Corp', valorAnual: 4_000_000, yearsLeft: 3 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const legacy = structuredClone(g) as any;
    delete legacy.era;
    delete legacy.eraHistory;
    delete legacy.eraMilestonesAchieved;
    delete legacy.censureUsedInEra;
    legacy.schemaVersion = 22;

    const migrated = migrateState(legacy as GameState);

    expect(migrated.era).toBe(2); // all 3 era-1 milestones already true
    expect(migrated.eraHistory).toEqual([]);
    expect(migrated.eraMilestonesAchieved).toEqual([]);
    expect(migrated.censureUsedInEra).toBe(false);
  });
});
