import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { DrizzleModule } from './db/drizzle.module';
import { GameModule } from './game/game.module';
import { AuthModule } from './auth/auth.module';
import { AuthService } from './auth/auth.service';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Global rate limit: 100 requests per minute per IP.
    // Auth endpoints override with stricter limits via @Throttle().
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    DrizzleModule,
    AuthModule,
    AdminModule,
    GameModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements OnApplicationBootstrap {
  constructor(
    private readonly config: ConfigService,
    private readonly auth: AuthService,
  ) {}

  async onApplicationBootstrap() {
    const adminEmail = this.config.get<string>('ADMIN_EMAIL');
    const adminPassword = this.config.get<string>('ADMIN_PASSWORD');
    if (adminEmail && adminPassword) {
      await this.auth.ensureAdminExists(adminEmail, adminPassword);
    }
  }
}
