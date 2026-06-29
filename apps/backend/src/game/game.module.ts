import { Module } from '@nestjs/common';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { GameOwnerGuard } from './game-owner.guard';
import { GameStateRepository } from './game-state.repository';

@Module({
  controllers: [GameController],
  providers: [GameService, GameOwnerGuard, GameStateRepository],
})
export class GameModule {}
