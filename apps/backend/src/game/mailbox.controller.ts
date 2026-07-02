import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GameOwnerGuard } from './game-owner.guard';
import { GameService } from './game.service';

@Controller('games')
@UseGuards(JwtAuthGuard, GameOwnerGuard)
export class MailboxController {
  constructor(private readonly games: GameService) {}

  @Get(':id/mailbox')
  mailbox(@Param('id', ParseIntPipe) id: number) {
    return this.games.getMailbox(id);
  }

  @Post(':id/mailbox/:msgId/read')
  markRead(
    @Param('id', ParseIntPipe) id: number,
    @Param('msgId', ParseIntPipe) msgId: number,
  ) {
    return this.games.markMailRead(id, msgId);
  }

  @Post(':id/mailbox/read-all')
  markAllRead(@Param('id', ParseIntPipe) id: number) {
    return this.games.markAllMailRead(id);
  }
}
