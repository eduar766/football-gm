import { Global, Module, type OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Pool } from 'pg';
import { createDatabase, type Database } from './drizzle';

export const DRIZZLE = Symbol('DRIZZLE');
const PG_POOL = Symbol('PG_POOL');

const DEFAULT_URL = 'postgresql://postgres:postgres@localhost:5544/football_gm';

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('DATABASE_URL') ?? DEFAULT_URL;
        return createDatabase(url);
      },
    },
    {
      provide: DRIZZLE,
      inject: [PG_POOL],
      useFactory: (h: { db: Database }) => h.db,
    },
  ],
  exports: [DRIZZLE],
})
export class DrizzleModule implements OnModuleDestroy {
  constructor(@Inject(PG_POOL) private readonly handle: { pool: Pool }) {}

  async onModuleDestroy() {
    await this.handle.pool.end();
  }
}
