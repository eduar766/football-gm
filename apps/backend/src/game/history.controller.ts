import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GameOwnerGuard } from './game-owner.guard';
import { GameService } from './game.service';

@Controller('games')
@UseGuards(JwtAuthGuard, GameOwnerGuard)
export class HistoryController {
  constructor(private readonly games: GameService) {}

  @Get(':id/history')
  history(@Param('id', ParseIntPipe) id: number) {
    return this.games.getHistory(id);
  }

  @Get(':id/world-ranking')
  worldRanking(@Param('id', ParseIntPipe) id: number) {
    return this.games.getWorldRanking(id);
  }

  @Get(':id/world-standings')
  worldStandings(@Param('id', ParseIntPipe) id: number) {
    return this.games.getWorldStandings(id);
  }

  @Get(':id/commissioner-reports')
  commissionerReports(@Param('id', ParseIntPipe) id: number) {
    return this.games.getCommissionerReports(id);
  }
}
