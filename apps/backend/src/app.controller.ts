import { Controller, Get, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Database } from './db/drizzle';
import { DRIZZLE } from './db/drizzle.module';

@Controller()
export class AppController {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  @Get('health')
  health() {
    return { status: 'ok', service: 'football-gm-backend' };
  }

  @Get('health/db')
  async healthDb() {
    await this.db.execute(sql`select 1`);
    return { status: 'ok', db: 'reachable' };
  }
}
