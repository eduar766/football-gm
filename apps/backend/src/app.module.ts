import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { DrizzleModule } from './db/drizzle.module';
import { GameModule } from './game/game.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DrizzleModule, GameModule],
  controllers: [AppController],
})
export class AppModule {}
