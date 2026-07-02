import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CreateCupRequest,
  CreateInterLeagueCupRequest,
  CreateOwnTeamRequest,
  EditCupParticipantsRequest,
  RunLevelingLeagueRequest,
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

  @Get(':id/random-team-name')
  randomTeamName(@Param('id', ParseIntPipe) id: number) {
    return this.games.randomTeamName(id);
  }

  @Post(':id/leveling-league')
  levelingLeague(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(RunLevelingLeagueRequest)) body: RunLevelingLeagueRequest,
  ) {
    return this.games.runLevelingLeague(id, body.plan);
  }

  @Post(':id/league-format')
  setLeagueFormat(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(SetLeagueFormatRequest)) body: SetLeagueFormatRequest,
  ) {
    return this.games.setLeagueFormat(id, body.format);
  }

  @Get(':id/teams')
  teams(
    @Param('id', ParseIntPipe) id: number,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.games.listTeams(id, limit ? parseInt(limit, 10) : undefined, offset ? parseInt(offset, 10) : undefined);
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

  @Post(':id/cups/inter-league')
  createInterLeagueCup(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(CreateInterLeagueCupRequest)) body: CreateInterLeagueCupRequest,
  ) {
    return this.games.createInterLeagueCup(id, body);
  }

  @Patch(':id/cups/:cupId')
  editCup(
    @Param('id', ParseIntPipe) id: number,
    @Param('cupId', ParseIntPipe) cupId: number,
    @Body(new ZodValidationPipe(EditCupParticipantsRequest)) body: EditCupParticipantsRequest,
  ) {
    return this.games.editCupParticipants(id, cupId, body.participantTeamIds);
  }

  @Delete(':id/cups/:cupId')
  deleteCup(
    @Param('id', ParseIntPipe) id: number,
    @Param('cupId', ParseIntPipe) cupId: number,
  ) {
    return this.games.deleteCup(id, cupId);
  }
}
