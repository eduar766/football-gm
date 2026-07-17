import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { SetDeskDecisionsRequest } from '@football-gm/contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GameOwnerGuard } from './game-owner.guard';
import { GameService } from './game.service';

// Fase 17E: el despacho semanal — prime time, árbitros, prensa. Entirely
// optional; auto-resolves deterministically for a commissioner who never
// calls POST, and never blocks POST /games/:id/advance-matchday.
@Controller('games')
@UseGuards(JwtAuthGuard, GameOwnerGuard)
export class DeskController {
  constructor(private readonly games: GameService) {}

  @Get(':id/desk')
  desk(@Param('id', ParseIntPipe) id: number) {
    return this.games.getDesk(id);
  }

  @Post(':id/desk')
  setDesk(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(SetDeskDecisionsRequest)) body: SetDeskDecisionsRequest,
  ) {
    return this.games.setDesk(id, body);
  }
}
