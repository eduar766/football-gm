import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ImportGameRequest } from '@football-gm/contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GameOwnerGuard } from './game-owner.guard';
import type { AuthUser } from '../auth/jwt.strategy';
import { GameService } from './game.service';

@Controller('games')
@UseGuards(JwtAuthGuard, GameOwnerGuard)
export class IoController {
  constructor(private readonly games: GameService) {}

  @Get(':id/export')
  exportGame(@Param('id', ParseIntPipe) id: number) {
    return this.games.exportGame(id);
  }

  @Post('import')
  importGame(
    @Body(new ZodValidationPipe(ImportGameRequest)) body: ImportGameRequest,
    @Req() req: { user: AuthUser },
  ) {
    return this.games.importGame(body.name, body.state, req.user);
  }
}
