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
