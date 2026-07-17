import { describe, expect, it } from 'vitest';
import { createGame, migrateState, type GameState } from '../src/index';

describe('migrateState v12 -> v13 (Fase 15A: potencial + talentRng)', () => {
  it('backfills potencial for every player and adds talentRng on an old save', () => {
    const g = createGame(99, {
      teams: [
        {
          name: 'Legacy FC',
          strength: 60,
          squad: [
            { name: 'Old Timer', posicion: 'DEF', calidad: 70 },
            { name: 'Kid', posicion: 'DEL', calidad: 40 },
          ],
        },
      ],
    });

    // Simulate a save persisted before Fase 15: strip potencial + talentRng,
    // roll schemaVersion back to what a pre-v13 save would carry.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const legacy = structuredClone(g) as any;
    for (const p of legacy.players) delete p.potencial;
    delete legacy.talentRng;
    legacy.schemaVersion = 12;

    const migrated = migrateState(legacy as GameState);

    expect(migrated.schemaVersion).toBeGreaterThanOrEqual(13);
    expect(migrated.talentRng).toBeDefined();
    for (const p of migrated.players) {
      expect(p.potencial).toBeGreaterThanOrEqual(p.calidad);
      expect(p.potencial).toBeLessThanOrEqual(95);
    }
  });

  it('is a no-op on an already-current save', () => {
    const g = createGame(100, {
      teams: [{ name: 'X FC', strength: 50, squad: [{ name: 'A', posicion: 'MED', calidad: 55 }] }],
    });
    const before = JSON.stringify(g);
    const migrated = migrateState(structuredClone(g));
    expect(JSON.stringify(migrated)).toBe(before);
  });
});

describe('migrateState v13 -> v14 (Fase 15C: governanceStreak)', () => {
  it('backfills governanceStreak at 0 on an old save', () => {
    const g = createGame(101, { teams: [{ name: 'X FC', strength: 50 }] });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const legacy = structuredClone(g) as any;
    delete legacy.governanceStreak;
    legacy.schemaVersion = 13;

    const migrated = migrateState(legacy as GameState);
    expect(migrated.schemaVersion).toBeGreaterThanOrEqual(14);
    expect(migrated.governanceStreak).toBe(0);
  });
});

describe('migrateState v16 -> v17 (Fase 17A: presidents + rival commissioners)', () => {
  it('backfills a president per player team, a commissioner per rival federation, and the three new streams', () => {
    const g = createGame(202, {
      teams: [{ name: 'Legacy FC', strength: 50 }, { name: 'Legacy FC 2', strength: 55 }],
      rivals: [
        {
          name: 'Rival FC',
          prestige: 40,
          divisions: [{ orden: 1, name: 'Liga', teams: [{ name: 'R1', strength: 50, arraigo: 50 }] }],
        },
      ],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const legacy = structuredClone(g) as any;
    delete legacy.presidents;
    delete legacy.nextPresidentId;
    delete legacy.rivalCommissioners;
    delete legacy.politicsRng;
    delete legacy.scandalRng;
    delete legacy.deskRng;
    legacy.schemaVersion = 16;

    const migrated = migrateState(legacy as GameState);

    expect(migrated.schemaVersion).toBeGreaterThanOrEqual(17);
    const playerTeamIds = migrated.teams
      .filter((t) => t.federationId === migrated.playerFederationId)
      .map((t) => t.id);
    expect(migrated.presidents.map((p) => p.teamId).sort()).toEqual([...playerTeamIds].sort());
    expect(migrated.rivalCommissioners).toHaveLength(1);
    expect(migrated.politicsRng).toBeDefined();
    expect(migrated.scandalRng).toBeDefined();
    expect(migrated.deskRng).toBeDefined();
  });

  it('is a no-op on an already-current save', () => {
    const g = createGame(203, { teams: [{ name: 'X FC', strength: 50 }] });
    const before = JSON.stringify(g);
    const migrated = migrateState(structuredClone(g));
    expect(JSON.stringify(migrated)).toBe(before);
  });
});

describe('migrateState v17 -> v18 (Fase 17B: public opinion + political capital)', () => {
  it('backfills neutral opinion, empty history, and starting PC on an old save', () => {
    const g = createGame(204, { teams: [{ name: 'Legacy FC', strength: 50 }] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const legacy = structuredClone(g) as any;
    delete legacy.publicOpinion;
    delete legacy.opinionHistory;
    delete legacy.politicalCapital;
    legacy.schemaVersion = 17;

    const migrated = migrateState(legacy as GameState);

    expect(migrated.schemaVersion).toBeGreaterThanOrEqual(18);
    expect(migrated.publicOpinion).toBe(50);
    expect(migrated.opinionHistory).toEqual([]);
    expect(migrated.politicalCapital).toBe(3);
  });

  it('is a no-op on an already-current save', () => {
    const g = createGame(205, { teams: [{ name: 'X FC', strength: 50 }] });
    const before = JSON.stringify(g);
    const migrated = migrateState(structuredClone(g));
    expect(JSON.stringify(migrated)).toBe(before);
  });
});

describe('migrateState v18 -> v19 (Fase 17C: assembly + pledges)', () => {
  it('backfills empty proposals/pledges arrays and id counters on an old save', () => {
    const g = createGame(206, { teams: [{ name: 'Legacy FC', strength: 50 }] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const legacy = structuredClone(g) as any;
    delete legacy.proposals;
    delete legacy.nextProposalId;
    delete legacy.pledges;
    delete legacy.nextPledgeId;
    legacy.schemaVersion = 18;

    const migrated = migrateState(legacy as GameState);

    expect(migrated.schemaVersion).toBeGreaterThanOrEqual(19);
    expect(migrated.proposals).toEqual([]);
    expect(migrated.nextProposalId).toBe(1);
    expect(migrated.pledges).toEqual([]);
    expect(migrated.nextPledgeId).toBe(1);
  });

  it('is a no-op on an already-current save', () => {
    const g = createGame(207, { teams: [{ name: 'X FC', strength: 50 }] });
    const before = JSON.stringify(g);
    const migrated = migrateState(structuredClone(g));
    expect(JSON.stringify(migrated)).toBe(before);
  });
});

describe('migrateState v19 -> v20 (Fase 17D: escándalos e integridad)', () => {
  it('backfills zero exposure, empty case ledger, and empty favor counts on an old save', () => {
    const g = createGame(208, { teams: [{ name: 'Legacy FC', strength: 50 }] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const legacy = structuredClone(g) as any;
    delete legacy.exposureRisk;
    delete legacy.integrityCases;
    delete legacy.nextCaseId;
    delete legacy.impulseFavorCounts;
    legacy.schemaVersion = 19;

    const migrated = migrateState(legacy as GameState);

    expect(migrated.schemaVersion).toBeGreaterThanOrEqual(20);
    expect(migrated.exposureRisk).toBe(0);
    expect(migrated.integrityCases).toEqual([]);
    expect(migrated.nextCaseId).toBe(1);
    expect(migrated.impulseFavorCounts).toEqual({});
  });

  it('is a no-op on an already-current save', () => {
    const g = createGame(209, { teams: [{ name: 'X FC', strength: 50 }] });
    const before = JSON.stringify(g);
    const migrated = migrateState(structuredClone(g));
    expect(JSON.stringify(migrated)).toBe(before);
  });
});

describe('migrateState v20 -> v21 (Fase 17E: el despacho semanal)', () => {
  it('backfills an 8-referee pool and neutral desk counters on an old save', () => {
    const g = createGame(210, { teams: [{ name: 'Legacy FC', strength: 50 }] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const legacy = structuredClone(g) as any;
    delete legacy.referees;
    delete legacy.nextRefereeId;
    delete legacy.deskPending;
    delete legacy.primetimeDrought;
    delete legacy.primetimeSeasonBonus;
    delete legacy.consecutiveEvasions;
    legacy.schemaVersion = 20;

    const migrated = migrateState(legacy as GameState);

    expect(migrated.schemaVersion).toBeGreaterThanOrEqual(21);
    expect(migrated.referees).toHaveLength(8);
    expect(migrated.nextRefereeId).toBe(9);
    expect(migrated.deskPending).toBeNull();
    expect(migrated.primetimeDrought).toEqual({});
    expect(migrated.primetimeSeasonBonus).toBe(0);
    expect(migrated.consecutiveEvasions).toBe(0);
  });

  it('is a no-op on an already-current save', () => {
    const g = createGame(211, { teams: [{ name: 'X FC', strength: 50 }] });
    const before = JSON.stringify(g);
    const migrated = migrateState(structuredClone(g));
    expect(JSON.stringify(migrated)).toBe(before);
  });
});

describe('migrateState v21 -> v22 (Fase 17F: la conspiración de la Superliga)', () => {
  it('backfills a null conspiracy and empty history on an old save', () => {
    const g = createGame(212, { teams: [{ name: 'Legacy FC', strength: 50 }] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const legacy = structuredClone(g) as any;
    delete legacy.conspiracy;
    delete legacy.conspiracyHistory;
    legacy.schemaVersion = 21;

    const migrated = migrateState(legacy as GameState);

    expect(migrated.schemaVersion).toBeGreaterThanOrEqual(22);
    expect(migrated.conspiracy).toBeNull();
    expect(migrated.conspiracyHistory).toEqual([]);
  });

  it('is a no-op on an already-current save', () => {
    const g = createGame(213, { teams: [{ name: 'X FC', strength: 50 }] });
    const before = JSON.stringify(g);
    const migrated = migrateState(structuredClone(g));
    expect(JSON.stringify(migrated)).toBe(before);
  });
});

describe('migrateState v22 -> v23 (Fase 17G: mandatos negociables)', () => {
  it('backfills difficulty="medio" on historical mandates and mandateChosen=true when one already exists for the current year', () => {
    const g = createGame(214, { teams: [{ name: 'Legacy FC', strength: 50 }] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const legacy = structuredClone(g) as any;
    legacy.mandates = [{ id: 1, type: 'positive_balance', description: 'x', target: 0, year: legacy.year, met: null }];
    delete legacy.mandates[0].difficulty;
    delete legacy.mandateOptions;
    delete legacy.mandateChosen;
    delete legacy.mandateBonusImpulses;
    legacy.schemaVersion = 22;

    const migrated = migrateState(legacy as GameState);

    expect(migrated.schemaVersion).toBeGreaterThanOrEqual(23);
    expect(migrated.mandates[0].difficulty).toBe('medio');
    expect(migrated.mandateOptions).toEqual([]);
    expect(migrated.mandateChosen).toBe(true); // a mandate already exists for the current year
    expect(migrated.mandateBonusImpulses).toBe(0);
    expect(migrated.censureMotion).toBeNull();
  });

  it('backfills year/opposedTeamIds on pre-17G norms', () => {
    const g = createGame(217, { teams: [{ name: 'Legacy FC', strength: 50 }] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const legacy = structuredClone(g) as any;
    legacy.norms = [{ id: 1, tipo: 'tope_plantilla', valor: 60 }];
    legacy.schemaVersion = 22;

    const migrated = migrateState(legacy as GameState);

    expect(migrated.norms[0].year).toBe(0);
    expect(migrated.norms[0].opposedTeamIds).toEqual([]);
  });

  it('sets mandateChosen=false when no mandate exists yet for the current year (pretemporada gap)', () => {
    const g = createGame(215, { teams: [{ name: 'Legacy FC', strength: 50 }] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const legacy = structuredClone(g) as any;
    legacy.mandates = [];
    delete legacy.mandateOptions;
    delete legacy.mandateChosen;
    delete legacy.mandateBonusImpulses;
    legacy.schemaVersion = 22;

    const migrated = migrateState(legacy as GameState);

    expect(migrated.mandateOptions).toEqual([]);
    expect(migrated.mandateChosen).toBe(false);
  });

  it('is a no-op on an already-current save', () => {
    const g = createGame(216, { teams: [{ name: 'X FC', strength: 50 }] });
    const before = JSON.stringify(g);
    const migrated = migrateState(structuredClone(g));
    expect(JSON.stringify(migrated)).toBe(before);
  });
});

describe('migrateState v23 -> v24 (Fase 17 backlog: favor del perdón)', () => {
  it('backfills favorOwed=false on every president of an old save', () => {
    const g = createGame(218, { teams: [{ name: 'Legacy FC', strength: 50 }] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const legacy = structuredClone(g) as any;
    for (const p of legacy.presidents) delete p.favorOwed;
    legacy.schemaVersion = 23;

    const migrated = migrateState(legacy as GameState);

    expect(migrated.schemaVersion).toBeGreaterThanOrEqual(24);
    expect(migrated.presidents.every((p) => p.favorOwed === false)).toBe(true);
  });

  it('is a no-op on an already-current save', () => {
    const g = createGame(219, { teams: [{ name: 'X FC', strength: 50 }] });
    const before = JSON.stringify(g);
    const migrated = migrateState(structuredClone(g));
    expect(JSON.stringify(migrated)).toBe(before);
  });
});
