import { Module } from '@nestjs/common';
import { GameController } from './game.controller';
import { SeasonController } from './season.controller';
import { CompetitionController } from './competition.controller';
import { GovernanceController } from './governance.controller';
import { EconomyController } from './economy.controller';
import { NegotiationController } from './negotiation.controller';
import { HistoryController } from './history.controller';
import { IoController } from './io.controller';
import { GameService } from './game.service';
import { GameOwnerGuard } from './game-owner.guard';
import { GameStateRepository } from './game-state.repository';

@Module({
  controllers: [
    GameController,
    SeasonController,
    CompetitionController,
    GovernanceController,
    EconomyController,
    NegotiationController,
    HistoryController,
    IoController,
  ],
  providers: [GameService, GameOwnerGuard, GameStateRepository],
})
export class GameModule {}
