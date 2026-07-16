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
