import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApplyImpulseRequest } from '@football-gm/contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GameOwnerGuard } from './game-owner.guard';
import { GameService } from './game.service';

@Controller('games')
@UseGuards(JwtAuthGuard, GameOwnerGuard)
export class SeasonController {
  constructor(private readonly games: GameService) {}

  @Get(':id/preseason-checklist')
  preseasonChecklist(@Param('id', ParseIntPipe) id: number) {
    return this.games.getPreseasonChecklist(id);
  }

  @Post(':id/start-season')
  startSeason(@Param('id', ParseIntPipe) id: number) {
    return this.games.startSeason(id);
  }

  @Post(':id/advance-matchday')
  advanceMatchday(@Param('id', ParseIntPipe) id: number) {
    return this.games.advanceMatchday(id);
  }

  @Post(':id/advance-season')
  advanceSeason(@Param('id', ParseIntPipe) id: number) {
    return this.games.advanceSeason(id);
  }

  @Post(':id/close-season')
  closeSeason(@Param('id', ParseIntPipe) id: number) {
    return this.games.closeSeason(id);
  }

  @Get(':id/standings')
  standings(
    @Param('id', ParseIntPipe) id: number,
    @Query('division') division?: string,
  ) {
    return this.games.getStandings(id, division ? Number(division) : 1);
  }

  @Get(':id/next-fixtures')
  nextFixtures(@Param('id', ParseIntPipe) id: number) {
    return this.games.getNextFixtures(id);
  }

  @Post(':id/impulses')
  applyImpulse(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(ApplyImpulseRequest)) body: ApplyImpulseRequest,
  ) {
    return this.games.applyImpulse(id, body.homeTeamId, body.awayTeamId, body.favoredTeamId);
  }

  @Post(':id/call-review')
  callReview(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { matchday: number; homeTeamId: number; awayTeamId: number },
  ) {
    return this.games.callReview(id, body.matchday, body.homeTeamId, body.awayTeamId);
  }

  @Post(':id/emergency-meeting')
  emergencyMeeting(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { teamId: number },
  ) {
    return this.games.emergencyMeeting(id, body.teamId);
  }

  @Post(':id/postpone-matchday')
  postponeMatchday(@Param('id', ParseIntPipe) id: number) {
    return this.games.postponeMatchday(id);
  }

  @Post(':id/cultivate-arraigo')
  cultivateArraigo(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { teamId: number },
  ) {
    return this.games.cultivateArraigo(id, body.teamId);
  }

  @Post(':id/veto-transfer')
  vetoTransfer(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { playerId: number },
  ) {
    return this.games.vetoTransfer(id, body.playerId);
  }

  @Delete(':id/veto-transfer/:playerId')
  cancelTransferVeto(
    @Param('id', ParseIntPipe) id: number,
    @Param('playerId', ParseIntPipe) playerId: number,
  ) {
    return this.games.cancelTransferVeto(id, playerId);
  }
}
