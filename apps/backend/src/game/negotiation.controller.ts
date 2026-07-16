import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AccelerateNegotiationRequest, SetOfferValueRequest, StartNegotiationRequest } from '@football-gm/contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GameOwnerGuard } from './game-owner.guard';
import { GameService } from './game.service';

@Controller('games')
@UseGuards(JwtAuthGuard, GameOwnerGuard)
export class NegotiationController {
  constructor(private readonly games: GameService) {}

  @Get(':id/market')
  market(@Param('id', ParseIntPipe) id: number) {
    return this.games.getMarket(id);
  }

  @Get(':id/negotiations')
  negotiations(@Param('id', ParseIntPipe) id: number) {
    return this.games.getNegotiations(id);
  }

  @Post(':id/negotiations')
  startNegotiation(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(StartNegotiationRequest)) body: StartNegotiationRequest,
  ) {
    return this.games.startNegotiation(id, body.targetTeamId);
  }

  @Patch(':id/negotiations/offer-value')
  setOfferValue(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(SetOfferValueRequest)) body: SetOfferValueRequest,
  ) {
    return this.games.setOfferValue(id, body.negId, body.offerValue);
  }

  @Post(':id/negotiations/accelerate')
  accelerateNegotiation(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(AccelerateNegotiationRequest)) body: AccelerateNegotiationRequest,
  ) {
    return this.games.accelerateNegotiation(id, body.negId);
  }
}
