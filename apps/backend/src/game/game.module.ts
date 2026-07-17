import { Module } from '@nestjs/common';
import { GameController } from './game.controller';
import { SeasonController } from './season.controller';
import { CompetitionController } from './competition.controller';
import { GovernanceController } from './governance.controller';
import { EconomyController } from './economy.controller';
import { NegotiationController } from './negotiation.controller';
import { HistoryController } from './history.controller';
import { MailboxController } from './mailbox.controller';
import { IoController } from './io.controller';
import { AssemblyController } from './assembly.controller';
import { DeskController } from './desk.controller';
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
    MailboxController,
    IoController,
    AssemblyController,
    DeskController,
  ],
  providers: [GameService, GameOwnerGuard, GameStateRepository],
})
export class GameModule {}
