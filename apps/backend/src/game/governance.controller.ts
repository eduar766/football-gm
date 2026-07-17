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
  AddNormRequest,
  ResolveEventRequest,
  ResolveCaseRequest,
  SanctionRequest,
  ResolveConspiracyActionRequest,
} from '@football-gm/contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GameOwnerGuard } from './game-owner.guard';
import { GameService } from './game.service';

@Controller('games')
@UseGuards(JwtAuthGuard, GameOwnerGuard)
export class GovernanceController {
  constructor(private readonly games: GameService) {}

  @Get(':id/norms')
  norms(@Param('id', ParseIntPipe) id: number) {
    return this.games.getNorms(id);
  }

  @Post(':id/norms')
  addNorm(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(AddNormRequest)) body: AddNormRequest,
  ) {
    return this.games.addNorm(id, body.tipo, body.valor);
  }

  @Post(':id/norms/:normId/remove')
  removeNorm(
    @Param('id', ParseIntPipe) id: number,
    @Param('normId', ParseIntPipe) normId: number,
  ) {
    return this.games.removeNorm(id, normId);
  }

  @Post(':id/sanctions')
  sanction(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(SanctionRequest)) body: SanctionRequest,
  ) {
    return this.games.sanctionTeam(id, body.teamId, body.normId);
  }

  @Get(':id/events')
  events(@Param('id', ParseIntPipe) id: number) {
    return this.games.getEvents(id);
  }

  @Post(':id/events/:eventId/resolve')
  resolveEvent(
    @Param('id', ParseIntPipe) id: number,
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body(new ZodValidationPipe(ResolveEventRequest)) body: ResolveEventRequest,
  ) {
    return this.games.resolveEvent(id, eventId, body.action);
  }

  @Get(':id/integrity')
  integrity(@Param('id', ParseIntPipe) id: number) {
    return this.games.getIntegrity(id);
  }

  @Post(':id/integrity/cases/:caseId/resolve')
  resolveCase(
    @Param('id', ParseIntPipe) id: number,
    @Param('caseId', ParseIntPipe) caseId: number,
    @Body(new ZodValidationPipe(ResolveCaseRequest)) body: ResolveCaseRequest,
  ) {
    return this.games.resolveCase(id, caseId, body);
  }

  @Get(':id/conspiracy')
  conspiracy(@Param('id', ParseIntPipe) id: number) {
    return this.games.getConspiracy(id);
  }

  @Post(':id/conspiracy/resolve')
  resolveConspiracy(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(ResolveConspiracyActionRequest)) body: ResolveConspiracyActionRequest,
  ) {
    return this.games.resolveConspiracyAction(id, body);
  }
}
