import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  AddNormRequest,
  ApplyImpulseRequest,
  CreateCupRequest,
  CreateGameRequest,
  CreateOwnTeamRequest,
  ImportGameRequest,
  ResolveEventRequest,
  SanctionRequest,
  SetCupPrizeRequest,
  SetLeagueFormatRequest,
  SetEconomyPolicyRequest,
  SetLeaguePrizeRequest,
  SignContractRequest,
  StartNegotiationRequest,
  SetOfferValueRequest,
} from '@football-gm/contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { GameService } from './game.service';

@Controller('games')
export class GameController {
  constructor(private readonly games: GameService) {}

  @Post()
  create(@Body(new ZodValidationPipe(CreateGameRequest)) body: CreateGameRequest) {
    return this.games.createGame(body);
  }

  @Get()
  list() {
    return this.games.list();
  }

  @Get(':id')
  summary(@Param('id', ParseIntPipe) id: number) {
    return this.games.getSummary(id);
  }

  @Post(':id/start-season')
  startSeason(@Param('id', ParseIntPipe) id: number) {
    return this.games.startSeason(id);
  }

  @Post(':id/advance-matchday')
  advanceMatchday(@Param('id', ParseIntPipe) id: number) {
    return this.games.advanceMatchday(id);
  }

  @Post(':id/advance-season')
  advanceSeason(@Param('id', ParseIntPipe) id: number) {
    return this.games.advanceSeason(id);
  }

  @Post(':id/close-season')
  closeSeason(@Param('id', ParseIntPipe) id: number) {
    return this.games.closeSeason(id);
  }

  @Get(':id/standings')
  standings(
    @Param('id', ParseIntPipe) id: number,
    @Query('division') division?: string,
  ) {
    return this.games.getStandings(id, division ? Number(division) : 1);
  }

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
    @Body(new ZodValidationPipe(SetLeagueFormatRequest))
    body: SetLeagueFormatRequest,
  ) {
    return this.games.setLeagueFormat(id, body.format);
  }

  @Get(':id/economy')
  economy(@Param('id', ParseIntPipe) id: number) {
    return this.games.getEconomy(id);
  }

  @Post(':id/economy/policy')
  setEconomyPolicy(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(SetEconomyPolicyRequest))
    body: SetEconomyPolicyRequest,
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

  @Get(':id/next-fixtures')
  nextFixtures(@Param('id', ParseIntPipe) id: number) {
    return this.games.getNextFixtures(id);
  }

  @Post(':id/impulses')
  applyImpulse(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(ApplyImpulseRequest)) body: ApplyImpulseRequest,
  ) {
    return this.games.applyImpulse(
      id,
      body.homeTeamId,
      body.awayTeamId,
      body.favoredTeamId,
    );
  }

  /* ---------------------------------- mid-season commissioner actions */

  @Post(':id/call-review')
  callReview(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { matchday: number; homeTeamId: number; awayTeamId: number },
  ) {
    return this.games.callReview(id, body.matchday, body.homeTeamId, body.awayTeamId);
  }

  @Post(':id/emergency-meeting')
  emergencyMeeting(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { teamId: number },
  ) {
    return this.games.emergencyMeeting(id, body.teamId);
  }

  @Post(':id/postpone-matchday')
  postponeMatchday(@Param('id', ParseIntPipe) id: number) {
    return this.games.postponeMatchday(id);
  }

  @Post(':id/cultivate-arraigo')
  cultivateArraigo(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { teamId: number },
  ) {
    return this.games.cultivateArraigo(id, body.teamId);
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

  @Get(':id/history')
  history(@Param('id', ParseIntPipe) id: number) {
    return this.games.getHistory(id);
  }

  @Get(':id/world-ranking')
  worldRanking(@Param('id', ParseIntPipe) id: number) {
    return this.games.getWorldRanking(id);
  }

  @Get(':id/export')
  exportGame(@Param('id', ParseIntPipe) id: number) {
    return this.games.exportGame(id);
  }

  @Post('import')
  importGame(
    @Body(new ZodValidationPipe(ImportGameRequest)) body: ImportGameRequest,
  ) {
    return this.games.importGame(body.name, body.state);
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
    @Body(new ZodValidationPipe(StartNegotiationRequest))
    body: StartNegotiationRequest,
  ) {
    return this.games.startNegotiation(id, body.targetTeamId);
  }

  @Patch(':id/negotiations/offer-value')
  setOfferValue(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(SetOfferValueRequest))
    body: SetOfferValueRequest,
  ) {
    return this.games.setOfferValue(id, body.negId, body.offerValue);
  }
}
