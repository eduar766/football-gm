import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CreateGameRequest } from '@football-gm/contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GameOwnerGuard } from './game-owner.guard';
import type { AuthUser } from '../auth/jwt.strategy';
import { GameService } from './game.service';

@Controller('games')
@UseGuards(JwtAuthGuard, GameOwnerGuard)
export class GameController {
  constructor(private readonly games: GameService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(CreateGameRequest)) body: CreateGameRequest,
    @Req() req: { user: AuthUser },
  ) {
    return this.games.createGame(body, req.user);
  }

  @Get()
  list(@Req() req: { user: AuthUser }) {
    return this.games.list(req.user);
  }

  @Get(':id')
  summary(@Param('id', ParseIntPipe) id: number, @Req() req: { user: AuthUser }) {
    return this.games.getSummary(id, req.user);
  }

  @Delete(':id')
  deleteGame(@Param('id', ParseIntPipe) id: number, @Req() req: { user: AuthUser }) {
    return this.games.deleteGame(id, req.user);
  }
}
