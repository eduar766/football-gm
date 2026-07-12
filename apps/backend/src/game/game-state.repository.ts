import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { CURRENT_SCHEMA_VERSION, migrateState, type GameState, type Player } from '@football-gm/engine';
import type { Database } from '../db/drizzle';
import { DRIZZLE } from '../db/drizzle.module';
import * as s from '../db/schema';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

// Per-transaction memoization: the WeakMap is GC'd automatically when the tx
// object is collected at transaction end, so there is no memory leak.
interface TxCache {
  teams?: Map<number, number>;
  federations?: Map<number, number>;
  cups?: Map<number, number>;
  players?: Map<number, number>;
}

@Injectable()
export class GameStateRepository {
  private readonly txCache = new WeakMap<object, TxCache>();

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async loadState(gameId: number, tx?: Tx): Promise<GameState> {
    const db = tx ?? this.db;
    const selectQuery = db
      .select({ state: s.gameEngineStates.state })
      .from(s.gameEngineStates)
      .where(eq(s.gameEngineStates.gameId, gameId));
    // FOR UPDATE only inside a mutating transaction — prevents lost updates
    // when two tabs advance the same matchday concurrently.
    const [row] = await (tx ? selectQuery.for('update') : selectQuery);
    if (!row) throw new NotFoundException(`Game ${gameId} not found`);

    const state = row.state as unknown as GameState;

    if ((state.schemaVersion ?? 0) < CURRENT_SCHEMA_VERSION) {
      migrateState(state);
      // Persist immediately if we have a write tx so subsequent loads skip
      // migration. On read-only calls (no tx) the in-memory state is correct;
      // the first mutating call will persist the bumped schemaVersion.
      if (tx) await this.saveState(tx, gameId, state);
    }

    return state;
  }

  async saveState(tx: Tx, gameId: number, state: GameState): Promise<void> {
    await tx
      .update(s.gameEngineStates)
      .set({ state: state as unknown as Record<string, unknown>, updatedAt: new Date() })
      .where(eq(s.gameEngineStates.gameId, gameId));
  }

  // engine team id → db team id
  async engineToDbTeam(gameId: number, tx?: Tx): Promise<Map<number, number>> {
    if (tx) {
      const cache = this.getCache(tx);
      if (cache.teams) return cache.teams;
    }
    const db = tx ?? this.db;
    const rows = await db
      .select({ id: s.teams.id, engineTeamId: s.teams.engineTeamId })
      .from(s.teams)
      .where(eq(s.teams.gameId, gameId));
    const map = new Map<number, number>();
    for (const r of rows) if (r.engineTeamId != null) map.set(r.engineTeamId, r.id);
    if (tx) this.getCache(tx).teams = map;
    return map;
  }

  // engine federation id → db federation id
  async engineToDbFederation(gameId: number, tx?: Tx): Promise<Map<number, number>> {
    if (tx) {
      const cache = this.getCache(tx);
      if (cache.federations) return cache.federations;
    }
    const db = tx ?? this.db;
    const rows = await db
      .select({ id: s.federations.id, eng: s.federations.engineFederationId })
      .from(s.federations)
      .where(eq(s.federations.gameId, gameId));
    const map = new Map<number, number>();
    for (const r of rows) if (r.eng != null) map.set(r.eng, r.id);
    if (tx) this.getCache(tx).federations = map;
    return map;
  }

  // engine cup id → db cup id
  async engineToDbCup(gameId: number, tx?: Tx): Promise<Map<number, number>> {
    if (tx) {
      const cache = this.getCache(tx);
      if (cache.cups) return cache.cups;
    }
    const db = tx ?? this.db;
    const rows = await db
      .select({ id: s.cups.id, eng: s.cups.engineCupId })
      .from(s.cups)
      .where(eq(s.cups.gameId, gameId));
    const map = new Map<number, number>();
    for (const r of rows) if (r.eng != null) map.set(r.eng, r.id);
    if (tx) this.getCache(tx).cups = map;
    return map;
  }

  // engine player id → db player id
  async engineToDbPlayer(gameId: number, tx?: Tx): Promise<Map<number, number>> {
    if (tx) {
      const cache = this.getCache(tx);
      if (cache.players) return cache.players;
    }
    const db = tx ?? this.db;
    const rows = await db
      .select({ id: s.players.id, eng: s.players.enginePlayerId })
      .from(s.players)
      .where(eq(s.players.gameId, gameId));
    const map = new Map<number, number>();
    for (const r of rows) if (r.eng != null) map.set(r.eng, r.id);
    if (tx) this.getCache(tx).players = map;
    return map;
  }

  // Mirrors engine players that don't have a DB row yet (e.g. a youth-intake
  // player created earlier in the same closeSeason call) into the `players`
  // projection, so a subsequent engineToDbPlayer() lookup — awards, in
  // particular — can resolve them instead of crashing on a NOT NULL insert.
  // Updates the tx-scoped cache in place so callers don't need to know this
  // ran.
  async syncNewPlayers(
    gameId: number,
    tx: Tx,
    players: Player[],
    teamMap: Map<number, number>,
  ): Promise<Map<number, number>> {
    const known = await this.engineToDbPlayer(gameId, tx);
    const missing = players.filter((p) => !known.has(p.id) && teamMap.has(p.teamId));
    if (missing.length === 0) return known;

    const rows = await tx
      .insert(s.players)
      .values(
        missing.map((p) => ({
          gameId,
          teamId: teamMap.get(p.teamId)!,
          enginePlayerId: p.id,
          name: p.name,
          posicion: p.posicion,
          calidad: p.calidad,
          nationality: p.nationality,
          cantera: p.cantera,
        })),
      )
      .returning({ id: s.players.id, eng: s.players.enginePlayerId });

    for (const r of rows) if (r.eng != null) known.set(r.eng, r.id);
    this.getCache(tx).players = known;
    return known;
  }

  private getCache(tx: object): TxCache {
    if (!this.txCache.has(tx)) this.txCache.set(tx, {});
    return this.txCache.get(tx)!;
  }
}
