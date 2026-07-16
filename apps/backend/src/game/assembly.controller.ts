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
  BuyVoteRequest,
  PledgeForVoteRequest,
  ProposalActionRequest,
  ProposeMeasureRequest,
  RevealIntentionRequest,
} from '@football-gm/contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GameOwnerGuard } from './game-owner.guard';
import { GameService } from './game.service';

// Fase 17C: the Assembly. Structural/governance decisions that used to be
// unilateral (norms, reparto, recurring cups, division expansion, league
// format, accelerated admission) now go through a club vote.
@Controller('games')
@UseGuards(JwtAuthGuard, GameOwnerGuard)
export class AssemblyController {
  constructor(private readonly games: GameService) {}

  @Get(':id/assembly')
  assembly(@Param('id', ParseIntPipe) id: number) {
    return this.games.getAssembly(id);
  }

  @Post(':id/assembly/proposals')
  propose(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(ProposeMeasureRequest)) body: ProposeMeasureRequest,
  ) {
    return this.games.proposeMeasure(id, body);
  }

  @Post(':id/assembly/proposals/withdraw')
  withdraw(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(ProposalActionRequest)) body: ProposalActionRequest,
  ) {
    return this.games.withdrawProposal(id, body.proposalId);
  }

  @Post(':id/assembly/proposals/reveal')
  reveal(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(RevealIntentionRequest)) body: RevealIntentionRequest,
  ) {
    return this.games.revealIntention(id, body.proposalId, body.teamId);
  }

  @Post(':id/assembly/proposals/buy-vote')
  buyVote(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(BuyVoteRequest)) body: BuyVoteRequest,
  ) {
    return this.games.buyVote(id, body.proposalId, body.teamId);
  }

  @Post(':id/assembly/proposals/pledge')
  pledge(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(PledgeForVoteRequest)) body: PledgeForVoteRequest,
  ) {
    return this.games.pledgeForVote(id, body.proposalId, body.teamId, body.kind, body.refId, body.amount);
  }
}
