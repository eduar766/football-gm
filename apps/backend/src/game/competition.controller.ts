import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  CreateCupRequest,
  CreateOwnTeamRequest,
  SetLeagueFormatRequest,
} from '@football-gm/contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GameOwnerGuard } from './game-owner.guard';
import { GameService } from './game.service';

@Controller('games')
@UseGuards(JwtAuthGuard, GameOwnerGuard)
export class CompetitionController {
  constructor(private readonly games: GameService) {}

  @Get(':id/structure')
  structure(@Param('id', ParseIntPipe) id: number) {
    return this.games.getStructure(id);
  }

  @Post(':id/teams')
  createOwnTeam(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(CreateOwnTeamRequest)) body: CreateOwnTeamRequest,
  ) {
    return this.games.createOwnTeam(id, body.name);
  }

  @Post(':id/leveling-league')
  levelingLeague(@Param('id', ParseIntPipe) id: number) {
    return this.games.runLevelingLeague(id);
  }

  @Post(':id/league-format')
  setLeagueFormat(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(SetLeagueFormatRequest)) body: SetLeagueFormatRequest,
  ) {
    return this.games.setLeagueFormat(id, body.format);
  }

  @Get(':id/teams')
  teams(@Param('id', ParseIntPipe) id: number) {
    return this.games.listTeams(id);
  }

  @Get(':id/teams/:teamId')
  team(
    @Param('id', ParseIntPipe) id: number,
    @Param('teamId', ParseIntPipe) teamId: number,
  ) {
    return this.games.getTeam(id, teamId);
  }

  @Get(':id/federation')
  federation(@Param('id', ParseIntPipe) id: number) {
    return this.games.getFederation(id);
  }

  @Get(':id/federations')
  federations(@Param('id', ParseIntPipe) id: number) {
    return this.games.getFederations(id);
  }

  @Get(':id/federations/:fedId')
  federationById(
    @Param('id', ParseIntPipe) id: number,
    @Param('fedId', ParseIntPipe) fedId: number,
  ) {
    return this.games.getFederationById(id, fedId);
  }

  @Get(':id/cups')
  cups(@Param('id', ParseIntPipe) id: number) {
    return this.games.getCups(id);
  }

  @Post(':id/cups')
  createCup(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(CreateCupRequest)) body: CreateCupRequest,
  ) {
    return this.games.createCup(id, body);
  }
}
