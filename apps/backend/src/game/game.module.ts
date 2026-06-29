import { Module } from '@nestjs/common';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { GameOwnerGuard } from './game-owner.guard';

@Module({
  controllers: [GameController],
  providers: [GameService, GameOwnerGuard],
})
export class GameModule {}
