import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;

export function createDatabase(
  connectionString: string,
  options: Partial<PoolConfig> = {},
): { db: Database; pool: Pool } {
  const pool = new Pool({ connectionString, ...options });
  const db = drizzle(pool, { schema });
  return { db, pool };
}
