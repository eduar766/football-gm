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
  RescueTeamRequest,
  SetCupPrizeRequest,
  SetEconomyPolicyRequest,
  SetLeaguePrizeRequest,
  SignContractRequest,
} from '@football-gm/contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GameOwnerGuard } from './game-owner.guard';
import { GameService } from './game.service';

@Controller('games')
@UseGuards(JwtAuthGuard, GameOwnerGuard)
export class EconomyController {
  constructor(private readonly games: GameService) {}

  @Get(':id/economy')
  economy(@Param('id', ParseIntPipe) id: number) {
    return this.games.getEconomy(id);
  }

  @Post(':id/economy/policy')
  setEconomyPolicy(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(SetEconomyPolicyRequest)) body: SetEconomyPolicyRequest,
  ) {
    return this.games.setEconomyPolicy(id, body);
  }

  @Post(':id/economy/contracts')
  signContract(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(SignContractRequest)) body: SignContractRequest,
  ) {
    return this.games.signContract(id, body.offerId);
  }

  @Post(':id/economy/contracts/:contractId/cancel')
  cancelContract(
    @Param('id', ParseIntPipe) id: number,
    @Param('contractId', ParseIntPipe) contractId: number,
  ) {
    return this.games.cancelContract(id, contractId);
  }

  @Get(':id/economy/teams')
  teamEconomies(@Param('id', ParseIntPipe) id: number) {
    return this.games.getTeamEconomies(id);
  }

  @Post(':id/economy/rescue')
  rescueTeam(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(RescueTeamRequest)) body: RescueTeamRequest,
  ) {
    return this.games.rescueTeam(id, body.teamId, body.amount, body.withholdPrizes);
  }

  @Get(':id/economy/compliance')
  compliance(@Param('id', ParseIntPipe) id: number) {
    return this.games.getCompliance(id);
  }

  @Get(':id/transfers')
  transfers(@Param('id', ParseIntPipe) id: number) {
    return this.games.getTransfers(id);
  }

  @Get(':id/prizes')
  prizes(@Param('id', ParseIntPipe) id: number) {
    return this.games.getPrizes(id);
  }

  @Post(':id/prizes/league')
  setLeaguePrize(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(SetLeaguePrizeRequest)) body: SetLeaguePrizeRequest,
  ) {
    return this.games.setLeaguePrize(id, body.pool, body.shares);
  }

  @Post(':id/prizes/cup')
  setCupPrize(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(SetCupPrizeRequest)) body: SetCupPrizeRequest,
  ) {
    return this.games.setCupPrize(id, body.cupId, body.pool, body.shares);
  }

  @Post(':id/prizes/:prizeId/remove')
  removePrize(
    @Param('id', ParseIntPipe) id: number,
    @Param('prizeId', ParseIntPipe) prizeId: number,
  ) {
    return this.games.removePrize(id, prizeId);
  }
}
