import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm';
import type { AuthUser } from '../auth/jwt.strategy';
import type { NormType } from '@football-gm/engine';
import {
  advanceMatchday as engineAdvanceMatchday,
  advanceSeason as engineAdvanceSeason,
  callReview as engineCallReview,
  closeSeason as engineCloseSeason,
  computeStandings,
  addNorm as engineAddNorm,
  applyImpulse as engineApplyImpulse,
  applyPointPenalties,
  cancelContract as engineCancelContract,
  createCup as engineCreateCup,
  createGame as engineCreateGame,
  createOwnTeam as engineCreateOwnTeam,
  cultivateArraigo as engineCultivateArraigo,
  emergencyMeeting as engineEmergencyMeeting,
  financialHealth,
  negotiableTeams,
  normBreaches,
  operatingCost,
  pendingEvents,
  pendingIntegrationTeams,
  playerTier,
  pointPenaltiesForYear,
  postponeMatchday as enginePostponeMatchday,
  removeNorm as engineRemoveNorm,
  resolveEvent as engineResolveEvent,
  runLevelingLeague as engineRunLevelingLeague,
  sanctionTeam as engineSanctionTeam,
  setEconomyPolicy as engineSetEconomyPolicy,
  setLeagueFormat as engineSetLeagueFormat,
  signContract as engineSignContract,
  startNegotiation as engineStartNegotiation,
  setNegotiationOfferValue as engineSetNegotiationOfferValue,
  removePrize as engineRemovePrize,
  setCupPrize as engineSetCupPrize,
  setLeaguePrize as engineSetLeaguePrize,
  startSeason as engineStartSeason,
  tierOf,
  wageBill,
  generateHeadlines,
  detectRivalries,
  type GameState,
} from '@football-gm/engine';
import { GameStateImportSchema } from '@football-gm/contracts';
import type {
  CreateGameRequest,
  FederationListItem,
  FederationOverview,
  GameListItem,
  GameSummary,
  HistoryResponse,
  CreateCupRequest,
  ComplianceResponse,
  CupsResponse,
  CupType,
  EconomyResponse,
  PrizesResponse,
  TransfersResponse,
  EventsResponse,
  MarketResponse,
  NegotiationDto,
  NextFixturesResponse,
  NormsResponse,
  StandingsResponse,
  StructureResponse,
  TeamDetail,
  TeamListItem,
  WorldRankingResponse,
  WorldStandingsResponse,
} from '@football-gm/contracts';
import type { Database } from '../db/drizzle';
import { DRIZZLE } from '../db/drizzle.module';
import * as s from '../db/schema';
import { buildWeakSquad, generateWorld } from './world-generator';
import { GameStateRepository } from './game-state.repository';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

@Injectable()
export class GameService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly repo: GameStateRepository,
  ) {}

  /* ----------------------------------------------------------- helpers */

  private assertOwner(game: { userId: number | null }, user: AuthUser) {
    if (user.role === 'admin') return;
    if (game.userId !== user.id) throw new ForbiddenException();
  }

  // Ensure a db divisions row exists for every engine division; returns
  // engine division orden -> db division id.
  private async ensureDivisions(
    tx: Tx,
    gameId: number,
    leagueId: number,
    divisions: Array<{ orden: number; name: string }>,
    teams: Array<{ divisionOrden: number | null }>,
  ): Promise<Map<number, number>> {
    const existing = await tx
      .select({ id: s.divisions.id, orden: s.divisions.orden })
      .from(s.divisions)
      .where(and(eq(s.divisions.gameId, gameId), eq(s.divisions.leagueId, leagueId)));
    const map = new Map<number, number>();
    for (const r of existing) map.set(r.orden, r.id);
    for (const d of divisions) {
      if (map.has(d.orden)) {
        await tx
          .update(s.divisions)
          .set({ name: d.name })
          .where(eq(s.divisions.id, map.get(d.orden)!));
        continue;
      }
      const plazas =
        teams.filter((t) => t.divisionOrden === d.orden).length || 20;
      const [row] = await tx
        .insert(s.divisions)
        .values({ gameId, leagueId, name: d.name, orden: d.orden, plazas })
        .returning({ id: s.divisions.id });
      map.set(d.orden, row.id);
    }
    return map;
  }

  private async playerLeagueId(gameId: number, tx?: Tx): Promise<number> {
    const db = tx ?? this.db;
    const [row] = await db
      .select({ id: s.leagues.id })
      .from(s.leagues)
      .innerJoin(s.federations, eq(s.leagues.federationId, s.federations.id))
      .where(and(eq(s.leagues.gameId, gameId), eq(s.federations.isPlayer, true)));
    if (!row) throw new NotFoundException(`Game ${gameId} has no player league`);
    return row.id;
  }

  private async playerFederation(gameId: number, tx?: Tx) {
    const db = tx ?? this.db;
    const [fed] = await db
      .select()
      .from(s.federations)
      .where(and(eq(s.federations.gameId, gameId), eq(s.federations.isPlayer, true)));
    if (!fed) throw new NotFoundException(`Game ${gameId} has no player federation`);
    return fed;
  }

  private async summaryFrom(gameId: number, state: GameState): Promise<GameSummary> {
    const [game] = await this.db.select().from(s.games).where(eq(s.games.id, gameId));
    if (!game) throw new NotFoundException(`Game ${gameId} not found`);
    const fed = await this.playerFederation(gameId);
    return {
      id: gameId,
      name: game.name,
      seed: game.seed,
      year: state.year,
      phase: state.phase,
      currentMatchday: state.currentMatchday,
      totalMatchdays: state.totalMatchdays,
      seasonOver: state.seasonOver,
      impulsesRemaining: state.impulsesRemaining,
      impulsesPerSeason: state.impulsesPerSeason,
      pendingEventsCount: pendingEvents(state).length,
      normBreachCount: normBreaches(state).length,
      reviewsUsedThisSeason: state.actionHistory.filter(
        (a) => a.year === state.year && a.type === 'call_review',
      ).length,
      leagueFormat: state.leagueFormat,
      federation: {
        id: fed.id,
        name: fed.name,
        prestige: state.prestige,
        tier: tierOf(state.prestige),
        isPlayer: fed.isPlayer,
      },
      mandate: state.mandates.find((m) => m.year === state.year) ?? null,
      consecutiveMandateFails: state.consecutiveMandateFails,
      headlines: generateHeadlines(state),
      lastChronicle: state.seasonChronicles.length > 0
        ? state.seasonChronicles[state.seasonChronicles.length - 1]
        : null,
      rivalLastMatchday: state.rivalLastMatchdayResults.map(r => ({
        matchday: r.matchday,
        federationId: r.federationId,
        homeName: r.homeName,
        awayName: r.awayName,
        homeGoals: r.homeGoals,
        awayGoals: r.awayGoals,
        isShock: r.isShock,
        federationName: state.federations.find(f => f.id === r.federationId)?.name ?? '',
      })),
    };
  }

  /* ------------------------------------------------------ create / list */

  async createGame(input: CreateGameRequest, user: AuthUser): Promise<{ id: number }> {
    if (user.role !== 'admin') {
      const [{ c }] = await this.db
        .select({ c: count() })
        .from(s.games)
        .where(eq(s.games.userId, user.id));
      if (c >= 3) throw new BadRequestException('GAME_LIMIT_REACHED');
    }
    const seed = input.seed ?? Math.floor(Math.random() * 2_147_483_647);
    const world = generateWorld(seed);
    const state = engineCreateGame(seed, {
      playerFederationName: world.federationName,
      confederations: world.confederations,
      teams: world.teams.map((t) => ({
        name: t.name,
        strength: t.strength,
        arraigo: t.arraigo,
        // Youth/cantera strength from the academy rating (§4.4 youth cups).
        youthStrength: Math.max(20, Math.round(t.academiaRating * 0.9)),
        stadiumCapacity: t.estadioAforo,
        academia: t.academiaRating,
        squad: t.squad, // engine tracks players for the §6 awards
      })),
      rivals: world.rivals.map((r) => ({
        name: r.name,
        prestige: r.prestige,
        confederationId: r.confederationId,
        teams: r.teams.map((rt) => ({
          name: rt.name,
          strength: rt.strength,
          arraigo: rt.arraigo,
        })),
      })),
    });

    return this.db.transaction(async (tx) => {
      const [game] = await tx
        .insert(s.games)
        .values({ name: input.name, seed, currentYear: state.year, userId: user.id })
        .returning({ id: s.games.id });

      // Federations (player + rivals), keyed back to their engine ids.
      const fedByEngine = new Map<number, number>();
      for (const f of state.federations) {
        const [row] = await tx
          .insert(s.federations)
          .values({
            gameId: game.id,
            engineFederationId: f.id,
            name: f.name,
            prestige: f.prestige,
            isPlayer: f.isPlayer,
          })
          .returning({ id: s.federations.id });
        fedByEngine.set(f.id, row.id);
      }
      const playerFedDbId = fedByEngine.get(state.playerFederationId)!;

      // Player league + division
      const [league] = await tx
        .insert(s.leagues)
        .values({ gameId: game.id, federationId: playerFedDbId, name: world.leagueName })
        .returning({ id: s.leagues.id });

      const [division] = await tx
        .insert(s.divisions)
        .values({
          gameId: game.id,
          leagueId: league.id,
          name: world.divisionName,
          orden: 1,
          plazas: world.teams.length,
        })
        .returning({ id: s.divisions.id });

      // Fase 9: create leagues + divisions for rival federations
      const rivalLeagueByFed = new Map<number, number>(); // engineFedId -> dbLeagueId
      const rivalDivByOrden = new Map<string, number>(); // "engineFedId:orden" -> dbDivId
      for (const rival of world.rivals) {
        const fedDbId = fedByEngine.get(state.federations.find(f => f.name === rival.name)?.id ?? 0);
        if (!fedDbId) continue;
        const [rLeague] = await tx
          .insert(s.leagues)
          .values({ gameId: game.id, federationId: fedDbId, name: rival.name })
          .returning({ id: s.leagues.id });
        rivalLeagueByFed.set(state.federations.find(f => f.name === rival.name)?.id ?? 0, rLeague.id);
        // Create one division per league (orden 1)
        const [rDiv] = await tx
          .insert(s.divisions)
          .values({
            gameId: game.id,
            leagueId: rLeague.id,
            name: rival.name,
            orden: 1,
            plazas: rival.teams.length,
          })
          .returning({ id: s.divisions.id });
        rivalDivByOrden.set(`${state.federations.find(f => f.name === rival.name)?.id ?? 0}:1`, rDiv.id);
      }

      // Teams: league teams get the rich domain attributes + squad; rival teams
      // are negotiation targets (lighter projection).
      let leagueIdx = 0;
      for (const t of state.teams) {
        const isPlayerTeam = t.federationId === state.playerFederationId;
        const rich = isPlayerTeam && t.divisionOrden !== null ? world.teams[leagueIdx++] : undefined;
        // For rival teams, find their division from the engine state
        let teamDivisionId: number | null = null;
        if (t.divisionOrden !== null) {
          if (isPlayerTeam) {
            teamDivisionId = division.id;
          } else {
            const engDiv = state.divisions.find(d => d.orden === t.divisionOrden && d.federationId === t.federationId);
            if (engDiv) {
              teamDivisionId = rivalDivByOrden.get(`${t.federationId}:${engDiv.orden}`) ?? null;
            }
          }
        }
        const [row] = await tx
          .insert(s.teams)
          .values({
            gameId: game.id,
            engineTeamId: t.id,
            name: t.name,
            strength: t.strength,
            arraigo: t.arraigo,
            prestige: rich?.prestige ?? Math.max(0, t.strength - 5),
            presupuesto: rich?.presupuesto ?? t.strength * 80_000,
            aficion: rich?.aficion ?? 0,
            estadioNombre: rich?.estadioNombre ?? null,
            estadioAforo: rich?.estadioAforo ?? null,
            academiaRating: rich?.academiaRating ?? 50,
            medicoRating: rich?.medicoRating ?? 50,
            ojeadoresRating: rich?.ojeadoresRating ?? 50,
            cuerpoTecnicoRating: rich?.cuerpoTecnicoRating ?? 50,
            federationId: fedByEngine.get(t.federationId) ?? playerFedDbId,
            divisionId: teamDivisionId,
          })
          .returning({ id: s.teams.id });
        if (rich) {
          // Persist players using the engine state as source of truth so
          // engine_player_id is preserved for awards/rankings (§6).
          const enginePlayers = state.players.filter((p) => p.teamId === t.id);
          if (enginePlayers.length > 0) {
            await tx.insert(s.players).values(
              enginePlayers.map((p) => ({
                gameId: game.id,
                teamId: row.id,
                enginePlayerId: p.id,
                name: p.name,
                posicion: p.posicion,
                calidad: p.calidad,
                nationality: p.nationality,
                cantera: p.cantera,
              })),
            );
          }
        }
      }

      await tx.insert(s.seasons).values({
        gameId: game.id,
        anio: state.year,
        impulsosRestantes: state.impulsesRemaining,
      });

      await tx
        .insert(s.gameEngineStates)
        .values({ gameId: game.id, state: state as unknown as Record<string, unknown> });

      return { id: game.id };
    });
  }

  async list(user: AuthUser): Promise<GameListItem[]> {
    const rows = await this.db
      .select()
      .from(s.games)
      .where(user.role === 'admin' ? undefined : eq(s.games.userId, user.id))
      .orderBy(desc(s.games.createdAt));
    return rows.map((g) => ({
      id: g.id,
      name: g.name,
      seed: g.seed,
      currentYear: g.currentYear,
      createdAt: g.createdAt.toISOString(),
    }));
  }

  async getSummary(gameId: number, user: AuthUser): Promise<GameSummary> {
    const [game] = await this.db
      .select({ userId: s.games.userId })
      .from(s.games)
      .where(eq(s.games.id, gameId));
    if (!game) throw new NotFoundException(`Game ${gameId} not found`);
    this.assertOwner(game, user);
    const state = await this.repo.loadState(gameId);
    return this.summaryFrom(gameId, state);
  }

  async deleteGame(gameId: number, user: AuthUser): Promise<{ ok: boolean }> {
    const [game] = await this.db
      .select({ userId: s.games.userId })
      .from(s.games)
      .where(eq(s.games.id, gameId));
    if (!game) throw new NotFoundException(`Game ${gameId} not found`);
    this.assertOwner(game, user);

    await this.db.transaction(async (tx) => {
      // Delete in FK-dependency order (leaf → root)
      const srIds = (
        await tx.select({ id: s.seasonRecords.id }).from(s.seasonRecords).where(eq(s.seasonRecords.gameId, gameId))
      ).map((r) => r.id);
      if (srIds.length > 0) {
        await tx.delete(s.seasonRecordPositions).where(inArray(s.seasonRecordPositions.seasonRecordId, srIds));
      }

      const negIds = (
        await tx.select({ id: s.negotiations.id }).from(s.negotiations).where(eq(s.negotiations.gameId, gameId))
      ).map((r) => r.id);
      if (negIds.length > 0) {
        await tx.delete(s.negotiationRequirements).where(inArray(s.negotiationRequirements.negotiationId, negIds));
      }

      await tx.delete(s.awards).where(eq(s.awards.gameId, gameId));
      await tx.delete(s.impulses).where(eq(s.impulses.gameId, gameId));
      await tx.delete(s.matches).where(eq(s.matches.gameId, gameId));
      await tx.delete(s.matchdays).where(eq(s.matchdays.gameId, gameId));
      await tx.delete(s.sanctions).where(eq(s.sanctions.gameId, gameId));
      await tx.delete(s.negotiations).where(eq(s.negotiations.gameId, gameId));
      await tx.delete(s.commercialContracts).where(eq(s.commercialContracts.gameId, gameId));
      await tx.delete(s.norms).where(eq(s.norms.gameId, gameId));
      await tx.delete(s.seasonRecords).where(eq(s.seasonRecords.gameId, gameId));
      await tx.delete(s.trajectories).where(eq(s.trajectories.gameId, gameId));
      await tx.delete(s.players).where(eq(s.players.gameId, gameId));
      await tx.delete(s.teams).where(eq(s.teams.gameId, gameId));
      await tx.delete(s.cups).where(eq(s.cups.gameId, gameId));
      await tx.delete(s.divisions).where(eq(s.divisions.gameId, gameId));
      await tx.delete(s.leagues).where(eq(s.leagues.gameId, gameId));
      await tx.delete(s.federations).where(eq(s.federations.gameId, gameId));
      await tx.delete(s.seasons).where(eq(s.seasons.gameId, gameId));
      await tx.delete(s.gameEngineStates).where(eq(s.gameEngineStates.gameId, gameId));
      await tx.delete(s.games).where(eq(s.games.id, gameId));
    });

    return { ok: true };
  }

  async setLeagueFormat(
    gameId: number,
    format: 'ida' | 'ida_vuelta',
  ): Promise<GameSummary> {
    return this.db.transaction(async (tx) => {
      const state = await this.repo.loadState(gameId, tx);
      this.assertPretemporada(state, 'cambiar el formato de la liga');
      const next = engineSetLeagueFormat(state, format);
      await this.repo.saveState(tx, gameId, next);
      return this.summaryFrom(gameId, next);
    });
  }

  /* ------------------------------------------------------- the loop */

  private assertNoPendingEvents(state: GameState): void {
    if (pendingEvents(state).length > 0) {
      throw new BadRequestException(
        'Hay una polémica sin resolver: atiéndela en Eventos antes de avanzar',
      );
    }
  }

  // Structural commands (cups, leveling, format, create team, prizes) can only
  // run in pretemporada so the calendar contemplates them from kickoff (§4.8).
  private assertPretemporada(state: GameState, action: string): void {
    if (state.phase !== 'pretemporada') {
      throw new BadRequestException(
        `No se puede ${action} con la temporada en curso: hazlo entre temporadas`,
      );
    }
  }

  private assertTemporada(state: GameState, action: string): void {
    if (state.phase !== 'temporada') {
      throw new BadRequestException(
        `No se puede ${action} en pretemporada: pulsa "Comenzar temporada" primero`,
      );
    }
  }

  // Build the season's calendar and start the playable phase (§4.8).
  async startSeason(gameId: number): Promise<GameSummary> {
    return this.db.transaction(async (tx) => {
      const state = await this.repo.loadState(gameId, tx);
      this.assertPretemporada(state, 'comenzar la temporada');
      const next = engineStartSeason(state);
      await this.repo.saveState(tx, gameId, next);
      return this.summaryFrom(gameId, next);
    });
  }

  async advanceMatchday(gameId: number): Promise<GameSummary> {
    return this.db.transaction(async (tx) => {
      const state = await this.repo.loadState(gameId, tx);
      this.assertTemporada(state, 'avanzar la jornada');
      this.assertNoPendingEvents(state);
      const next = engineAdvanceMatchday(state);
      await this.repo.saveState(tx, gameId, next);
      return this.summaryFrom(gameId, next);
    });
  }

  /* ----------------------------------- mid-season commissioner actions */

  async callReview(
    gameId: number,
    matchday: number,
    homeId: number,
    awayId: number,
  ): Promise<GameSummary> {
    return this.db.transaction(async (tx) => {
      const state = await this.repo.loadState(gameId, tx);
      this.assertTemporada(state, 'llamar a revisión');
      // Convert DB team IDs → engine team IDs
      const engToDb = await this.repo.engineToDbTeam(gameId, tx);
      // Reverse: db id → engine id
      const dbToEng = new Map<number, number>();
      for (const [eng, db] of engToDb) dbToEng.set(db, eng);
      const engHome = dbToEng.get(homeId);
      const engAway = dbToEng.get(awayId);
      if (engHome == null || engAway == null) {
        throw new BadRequestException('Equipo no encontrado');
      }
      const next = engineCallReview(state, matchday, engHome, engAway);
      if (next === state) {
        throw new BadRequestException(
          'No se pudo convocar revisión: ya usada en esta jornada para este local, falta presupuesto, o no estás en temporada',
        );
      }
      await this.repo.saveState(tx, gameId, next);
      return this.summaryFrom(gameId, next);
    });
  }

  async emergencyMeeting(
    gameId: number,
    teamId: number,
  ): Promise<GameSummary> {
    return this.db.transaction(async (tx) => {
      const state = await this.repo.loadState(gameId, tx);
      this.assertTemporada(state, 'reunión de emergencia');
      const engToDb = await this.repo.engineToDbTeam(gameId, tx);
      const dbToEng = new Map<number, number>();
      for (const [eng, db] of engToDb) dbToEng.set(db, eng);
      const engTeam = dbToEng.get(teamId);
      if (engTeam == null) {
        throw new BadRequestException('Equipo no encontrado');
      }
      const next = engineEmergencyMeeting(state, engTeam);
      if (next === state) {
        throw new BadRequestException(
          'No se pudo convocar reunión: ya usada para este equipo, falta presupuesto, o no estás en temporada',
        );
      }
      await this.repo.saveState(tx, gameId, next);
      return this.summaryFrom(gameId, next);
    });
  }

  async postponeMatchday(gameId: number): Promise<GameSummary> {
    return this.db.transaction(async (tx) => {
      const state = await this.repo.loadState(gameId, tx);
      this.assertTemporada(state, 'posponer jornada');
      const next = enginePostponeMatchday(state);
      if (next === state) {
        throw new BadRequestException(
          'No se pudo posponer: la temporada ya terminó o no estás en temporada',
        );
      }
      await this.repo.saveState(tx, gameId, next);
      return this.summaryFrom(gameId, next);
    });
  }

  async cultivateArraigo(gameId: number, teamId: number): Promise<GameSummary> {
    return this.db.transaction(async (tx) => {
      const state = await this.repo.loadState(gameId, tx);
      this.assertPretemporada(state, 'cultivar arraigo');
      const engToDb = await this.repo.engineToDbTeam(gameId, tx);
      const dbToEng = new Map<number, number>();
      for (const [eng, db] of engToDb) dbToEng.set(db, eng);
      const engTeam = dbToEng.get(teamId);
      if (engTeam == null) {
        throw new BadRequestException('Equipo no encontrado');
      }
      const next = engineCultivateArraigo(state, engTeam);
      if (next === state) {
        throw new BadRequestException(
          'No se pudo cultivar arraigo: límite de 2 equipos/temporada alcanzado, falta presupuesto, o no estás en pretemporada',
        );
      }
      await this.repo.saveState(tx, gameId, next);
      return this.summaryFrom(gameId, next);
    });
  }

  // Simulate the remaining matchdays to the end of the season and STOP. The
  // final table stays visible so the player can review it before closing
  // (this is the validated prototype loop: advance -> see table -> close).
  async advanceSeason(gameId: number): Promise<GameSummary> {
    return this.db.transaction(async (tx) => {
      const state = await this.repo.loadState(gameId, tx);
      this.assertTemporada(state, 'avanzar la temporada');
      this.assertNoPendingEvents(state);
      const next = engineAdvanceSeason(state);
      await this.repo.saveState(tx, gameId, next);
      return this.summaryFrom(gameId, next);
    });
  }

  // Close the finished season: write the append-only history (§6) and land in
  // pretemporada of the next year. Requires the season to be over.
  async closeSeason(gameId: number): Promise<GameSummary> {
    return this.db.transaction(async (tx) => {
      const finished = await this.repo.loadState(gameId, tx);
      if (finished.phase !== 'temporada' || !finished.seasonOver) {
        throw new BadRequestException('Season is not finished yet');
      }
      const closedYear = finished.year;
      const next = engineCloseSeason(finished);

      const map = await this.repo.engineToDbTeam(gameId, tx);
      const fedMap = await this.repo.engineToDbFederation(gameId, tx);
      const leagueId = await this.playerLeagueId(gameId, tx);
      // Cover both the finished structure (for history) and the next one
      // (for reprojection after promotion/relegation). Only player-federation
      // divisions — rival divisions are managed by the engine, not the DB.
      const playerDivisionsFinished = finished.divisions.filter(
        (d) => d.federationId === finished.playerFederationId,
      );
      const playerDivisionsNext = next.divisions.filter(
        (d) => d.federationId === next.playerFederationId,
      );
      const divMap = await this.ensureDivisions(
        tx,
        gameId,
        leagueId,
        [...playerDivisionsFinished, ...playerDivisionsNext],
        next.teams,
      );

      // Append-only history (§6): one acta per division of the finished
      // season — with sanction point penalties applied (matches the engine).
      // Only write history for the player's own federation divisions; rival
      // leagues are tracked via rivalChampions/rivalStandings in the engine.
      const closedPenalties = pointPenaltiesForYear(finished, closedYear);
      for (const d of finished.divisions.filter(
        (d) => d.federationId === finished.playerFederationId,
      )) {
        const dTeams = finished.teams.filter((t) => t.divisionOrden === d.orden);
        const dResults = finished.results.filter(
          (r) => r.divisionOrden === d.orden,
        );
        const table = applyPointPenalties(
          computeStandings(dTeams, dResults),
          closedPenalties,
        );
        if (table.length === 0) continue;
        const [record] = await tx
          .insert(s.seasonRecords)
          .values({
            gameId,
            anio: closedYear,
            divisionId: divMap.get(d.orden) ?? null,
            championTeamId: map.get(table[0].teamId)!,
          })
          .returning({ id: s.seasonRecords.id });
        await tx.insert(s.seasonRecordPositions).values(
          table.map((r, i) => ({
            seasonRecordId: record.id,
            teamId: map.get(r.teamId)!,
            posicion: i + 1,
            puntos: r.points,
            ganados: r.won,
            empatados: r.drawn,
            perdidos: r.lost,
            golesFavor: r.goalsFor,
            golesContra: r.goalsAgainst,
          })),
        );
        await tx.insert(s.trajectories).values(
          table.map((r, i) => ({
            gameId,
            teamId: map.get(r.teamId)!,
            anio: closedYear,
            divisionOrden: d.orden,
            puestoFinal: i + 1,
          })),
        );
      }

      // Cup actas (§4.4): a season_records row per cup finalised this year.
      // No positions table (single-elimination bracket has only one champion);
      // palmarés counts the title automatically via vw_palmares.
      const cupMap = await this.repo.engineToDbCup(gameId, tx);
      const cupsThisYear = next.cups.filter(
        (c) => c.year === closedYear && c.status === 'finalizada' && c.championTeamId !== null,
      );
      if (cupsThisYear.length > 0) {
        await tx.insert(s.seasonRecords).values(
          cupsThisYear.map((c) => ({
            gameId,
            anio: closedYear,
            divisionId: null,
            cupId: cupMap.get(c.id) ?? null,
            championTeamId: map.get(c.championTeamId!)!,
          })),
        );
      }

      // Awards (§6) emitted by the engine for the closed year. Persisted as
      // append-only history; the historical scorer ranking is a SQL view.
      const yearAwards = next.awards.filter((a) => a.year === closedYear);
      if (yearAwards.length > 0) {
        const playerMap = await this.repo.engineToDbPlayer(gameId, tx);
        await tx.insert(s.awards).values(
          yearAwards.map((a) => ({
            gameId,
            anio: a.year,
            tipo: a.tipo,
            playerId: playerMap.get(a.playerId)!,
            teamId: map.get(a.teamId) ?? null,
            valor: a.valor,
          })),
        );
      }

      // Sync read-model projections from the engine's evolved state: team
      // strength, ownership (adhesions), division placement, federation prestige.
      for (const t of next.teams) {
        const dbId = map.get(t.id);
        if (dbId) {
          await tx
            .update(s.teams)
            .set({
              strength: t.strength,
              arraigo: t.arraigo,
              federationId: fedMap.get(t.federationId) ?? undefined,
              divisionId:
                t.divisionOrden !== null
                  ? (divMap.get(t.divisionOrden) ?? null)
                  : null,
            })
            .where(eq(s.teams.id, dbId));
        }
      }
      for (const f of next.federations) {
        const dbId = fedMap.get(f.id);
        if (dbId) {
          await tx
            .update(s.federations)
            .set({ prestige: f.prestige })
            .where(eq(s.federations.id, dbId));
        }
      }
      await tx
        .update(s.games)
        .set({ currentYear: next.year })
        .where(eq(s.games.id, gameId));
      await tx.insert(s.seasons).values({
        gameId,
        anio: next.year,
        impulsosRestantes: next.impulsesRemaining,
      });

      await this.repo.saveState(tx, gameId, next);
      return this.summaryFrom(gameId, next);
    });
  }

  /* ----------------------------------------------------- read screens */

  async getStandings(
    gameId: number,
    divisionOrden = 1,
  ): Promise<StandingsResponse> {
    const state = await this.repo.loadState(gameId);
    const map = await this.repo.engineToDbTeam(gameId);
    const div =
      state.divisions.find((d) => d.orden === divisionOrden) ??
      state.divisions[0];
    const orden = div?.orden ?? 1;
    const divTeams = state.teams.filter((t) => t.divisionOrden === orden);
    const divResults = state.results.filter((r) => r.divisionOrden === orden);
    const rows = applyPointPenalties(
      computeStandings(divTeams, divResults),
      pointPenaltiesForYear(state, state.year),
    ).map((r) => ({
      teamId: map.get(r.teamId) ?? r.teamId,
      name: r.name,
      played: r.played,
      won: r.won,
      drawn: r.drawn,
      lost: r.lost,
      goalsFor: r.goalsFor,
      goalsAgainst: r.goalsAgainst,
      goalDiff: r.goalDiff,
      points: r.points,
    }));
    return {
      year: state.year,
      divisionOrden: orden,
      divisionName: div?.name ?? 'División',
      // Only expose the player's own divisions — rival federation divisions
      // share the same `orden` values (each rival league has orden=1) which
      // causes duplicate SegmentedControl options in the frontend.
      availableDivisions: state.divisions
        .filter((d) => d.federationId === state.playerFederationId)
        .map((d) => ({ orden: d.orden, name: d.name })),
      rows,
    };
  }

  async getStructure(gameId: number): Promise<StructureResponse> {
    const state = await this.repo.loadState(gameId);
    const map = await this.repo.engineToDbTeam(gameId);
    const toDto = (t: GameState['teams'][number]) => ({
      teamId: map.get(t.id) ?? t.id,
      name: t.name,
      strength: t.strength,
      arraigo: t.arraigo,
    });
    const playerDivisions = state.divisions.filter(
      (d) => d.federationId === state.playerFederationId,
    );
    return {
      divisions: playerDivisions.map((d) => ({
        orden: d.orden,
        name: d.name,
        teams: state.teams
          .filter((t) => t.federationId === state.playerFederationId && t.divisionOrden === d.orden)
          .map(toDto),
      })),
      pending: pendingIntegrationTeams(state).map(toDto),
    };
  }

  async runLevelingLeague(gameId: number): Promise<StructureResponse> {
    return this.db.transaction(async (tx) => {
      const state = await this.repo.loadState(gameId, tx);
      this.assertPretemporada(state, 'celebrar la liga de nivelación');
      if (state.treasury < 0) {
        throw new BadRequestException(
          'Tesorería en negativo: no puedes permitirte expandir la estructura (§5)',
        );
      }
      const next = engineRunLevelingLeague(state);
      const map = await this.repo.engineToDbTeam(gameId, tx);
      const leagueId = await this.playerLeagueId(gameId, tx);
      const playerDivisionsNext = next.divisions.filter(
        (d) => d.federationId === next.playerFederationId,
      );
      const divMap = await this.ensureDivisions(
        tx,
        gameId,
        leagueId,
        playerDivisionsNext,
        next.teams,
      );
      for (const t of next.teams) {
        if (t.federationId !== next.playerFederationId) continue;
        const dbId = map.get(t.id);
        if (dbId) {
          await tx
            .update(s.teams)
            .set({
              divisionId:
                t.divisionOrden !== null
                  ? (divMap.get(t.divisionOrden) ?? null)
                  : null,
            })
            .where(eq(s.teams.id, dbId));
        }
      }
      await this.repo.saveState(tx, gameId, next);
      const toDto = (t: GameState['teams'][number]) => ({
        teamId: map.get(t.id) ?? t.id,
        name: t.name,
        strength: t.strength,
        arraigo: t.arraigo,
      });
      return {
        divisions: playerDivisionsNext.map((d) => ({
          orden: d.orden,
          name: d.name,
          teams: next.teams
            .filter((t) => t.federationId === next.playerFederationId && t.divisionOrden === d.orden)
            .map(toDto),
        })),
        pending: pendingIntegrationTeams(next).map(toDto),
      };
    });
  }

  async createOwnTeam(
    gameId: number,
    name: string,
  ): Promise<StructureResponse> {
    return this.db.transaction(async (tx) => {
      const state = await this.repo.loadState(gameId, tx);
      this.assertPretemporada(state, 'crear un equipo propio');
      // The engine assigns the new team id as max(team.id) + 1; compute it
      // here so we can pre-build a matching squad and feed it to the engine.
      const expectedNewId =
        state.teams.reduce((m, t) => Math.max(m, t.id), 0) + 1;
      const squad = buildWeakSquad(state.seed, expectedNewId);
      const next = engineCreateOwnTeam(state, name, squad);
      if (next === state) {
        throw new BadRequestException(
          'No se pudo crear el equipo: nombre vacío o fondos insuficientes (coste 5 M€)',
        );
      }
      const existing = new Set(state.teams.map((t) => t.id));
      const created = next.teams.find((t) => !existing.has(t.id))!;

      const fedMap = await this.repo.engineToDbFederation(gameId, tx);
      const leagueId = await this.playerLeagueId(gameId, tx);
      const playerDivisionsNext = next.divisions.filter(
        (d) => d.federationId === next.playerFederationId,
      );
      const divMap = await this.ensureDivisions(
        tx,
        gameId,
        leagueId,
        playerDivisionsNext,
        next.teams,
      );

      const [row] = await tx
        .insert(s.teams)
        .values({
          gameId,
          engineTeamId: created.id,
          name: created.name,
          strength: created.strength,
          arraigo: created.arraigo,
          prestige: Math.max(0, created.strength - 5),
          presupuesto: 2_000_000,
          aficion: 1_000,
          estadioNombre: null,
          estadioAforo: null,
          academiaRating: 40,
          medicoRating: 40,
          ojeadoresRating: 40,
          cuerpoTecnicoRating: 40,
          federationId: fedMap.get(next.playerFederationId) ?? null,
          divisionId:
            created.divisionOrden !== null
              ? (divMap.get(created.divisionOrden) ?? null)
              : null,
        })
        .returning({ id: s.teams.id });

      const newPlayers = next.players.filter((p) => p.teamId === created.id);
      await tx.insert(s.players).values(
        newPlayers.map((p) => ({
          gameId,
          teamId: row.id,
          enginePlayerId: p.id,
          name: p.name,
          posicion: p.posicion,
          calidad: p.calidad,
          nationality: p.nationality,
          cantera: p.cantera,
        })),
      );

      await this.repo.saveState(tx, gameId, next);

      const map = await this.repo.engineToDbTeam(gameId, tx);
      const toDto = (t: GameState['teams'][number]) => ({
        teamId: map.get(t.id) ?? t.id,
        name: t.name,
        strength: t.strength,
        arraigo: t.arraigo,
      });
      return {
        divisions: playerDivisionsNext.map((d) => ({
          orden: d.orden,
          name: d.name,
          teams: next.teams
            .filter((t) => t.federationId === next.playerFederationId && t.divisionOrden === d.orden)
            .map(toDto),
        })),
        pending: pendingIntegrationTeams(next).map(toDto),
      };
    });
  }

  async listTeams(gameId: number): Promise<TeamListItem[]> {
    const rows = await this.db
      .select({
        id: s.teams.id,
        name: s.teams.name,
        strength: s.teams.strength,
        prestige: s.teams.prestige,
        divisionName: s.divisions.name,
        federationId: s.teams.federationId,
        federationName: s.federations.name,
      })
      .from(s.teams)
      .leftJoin(s.divisions, eq(s.teams.divisionId, s.divisions.id))
      .leftJoin(s.federations, eq(s.teams.federationId, s.federations.id))
      .where(eq(s.teams.gameId, gameId))
      .orderBy(desc(s.teams.strength));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      strength: r.strength,
      prestige: r.prestige,
      divisionName: r.divisionName ?? null,
      federationId: r.federationId,
      federationName: r.federationName ?? null,
    }));
  }

  async getTeam(gameId: number, teamId: number): Promise<TeamDetail> {
    const [team] = await this.db
      .select({
        id: s.teams.id,
        name: s.teams.name,
        strength: s.teams.strength,
        prestige: s.teams.prestige,
        arraigo: s.teams.arraigo,
        presupuesto: s.teams.presupuesto,
        aficion: s.teams.aficion,
        estadioNombre: s.teams.estadioNombre,
        estadioAforo: s.teams.estadioAforo,
        academiaRating: s.teams.academiaRating,
        medicoRating: s.teams.medicoRating,
        ojeadoresRating: s.teams.ojeadoresRating,
        cuerpoTecnicoRating: s.teams.cuerpoTecnicoRating,
        federationName: s.federations.name,
        divisionName: s.divisions.name,
      })
      .from(s.teams)
      .leftJoin(s.federations, eq(s.teams.federationId, s.federations.id))
      .leftJoin(s.divisions, eq(s.teams.divisionId, s.divisions.id))
      .where(and(eq(s.teams.gameId, gameId), eq(s.teams.id, teamId)));
    if (!team) throw new NotFoundException(`Team ${teamId} not found`);

    const dbSquad = await this.db
      .select({
        id: s.players.id,
        enginePlayerId: s.players.enginePlayerId,
        name: s.players.name,
        posicion: s.players.posicion,
        calidad: s.players.calidad,
        nationality: s.players.nationality,
        cantera: s.players.cantera,
      })
      .from(s.players)
      .where(eq(s.players.teamId, teamId))
      .orderBy(desc(s.players.calidad));

    // Enrich with engine stats (cards / availability) when present.
    const state = await this.repo.loadState(gameId);
    const enginePlayers = new Map(state.players.map((p) => [p.id, p]));
    const squad = dbSquad.map((p) => {
      const eng = p.enginePlayerId !== null ? enginePlayers.get(p.enginePlayerId) : undefined;
      return {
        id: p.id,
        name: p.name,
        posicion: p.posicion,
        calidad: p.calidad,
        nationality: p.nationality,
        cantera: p.cantera,
        yellowCardsThisSeason: eng?.season.yellowCards ?? 0,
        redCardsThisSeason: eng?.season.redCards ?? 0,
        matchesSuspendedLeft: eng?.matchesSuspendedLeft ?? 0,
        injuredMatchesLeft: eng?.injuredMatchesLeft ?? 0,
      };
    });

    const trajectory = await this.db
      .select({
        anio: s.trajectories.anio,
        divisionOrden: s.trajectories.divisionOrden,
        puestoFinal: s.trajectories.puestoFinal,
      })
      .from(s.trajectories)
      .where(and(eq(s.trajectories.gameId, gameId), eq(s.trajectories.teamId, teamId)))
      .orderBy(asc(s.trajectories.anio));

    // Compute norm breaches specific to this team
    const allBreaches = normBreaches(state);
    const teamDbToEng = await this.repo.engineToDbTeam(gameId);
    const engTeamId = [...teamDbToEng.entries()].find(([, db]) => db === teamId)?.[0];
    const teamBreaches = engTeamId != null
      ? allBreaches.filter((b) => b.teamId === engTeamId)
      : [];
    const teamSanctions = state.sanctions
      .filter((sa) => {
        const engId = [...teamDbToEng.entries()].find(([, db]) => db === teamId)?.[0];
        return engId != null && sa.teamId === engId;
      })
      .map((sa) => ({ year: sa.year, motivo: sa.motivo, castigo: sa.castigo }));

    // Palmarés: count league and cup titles for this team.
    const records = await this.db
      .select({
        divisionName: s.divisions.name,
        cupName: s.cups.name,
        cupTipo: s.cups.tipo,
      })
      .from(s.seasonRecords)
      .leftJoin(s.divisions, eq(s.seasonRecords.divisionId, s.divisions.id))
      .leftJoin(s.cups, eq(s.seasonRecords.cupId, s.cups.id))
      .where(and(eq(s.seasonRecords.gameId, gameId), eq(s.seasonRecords.championTeamId, teamId)));

    const palmaresMap = new Map<string, { competition: string; count: number; isYouth: boolean }>();
    for (const r of records) {
      const isCup = r.cupName != null;
      const name = isCup ? r.cupName! : (r.divisionName ?? 'Liga');
      const isYouth = isCup && (r.cupTipo === 'liga_juvenil');
      const key = `${name}|${isYouth}`;
      const existing = palmaresMap.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        palmaresMap.set(key, { competition: name, count: 1, isYouth });
      }
    }
    const palmares = [...palmaresMap.values()].sort((a, b) => b.count - a.count);

    // 5.3 — Rivalries: detect from engine state and filter to this team.
    const allRivalries = detectRivalries(state);
    const engTeamIdForRiv = [...(await this.repo.engineToDbTeam(gameId)).entries()].find(
      ([, db]) => db === teamId,
    )?.[0];
    const rivalries = engTeamIdForRiv != null
      ? allRivalries.filter(
          (r) => r.teamAId === engTeamIdForRiv || r.teamBId === engTeamIdForRiv,
        )
      : [];

    return {
      ...team,
      divisionName: team.divisionName ?? null,
      federationName: team.federationName ?? null,
      squad,
      trajectory,
      palmares,
      rivalries,
      requirements: {
        breaches: teamBreaches.map((b) => ({
          teamId: teamId,
          teamName: b.teamName,
          normId: b.normId,
          tipo: b.tipo,
          valor: b.valor,
          valorActual: b.valorActual,
          sanctioned: b.sanctioned,
        })),
        sanctions: teamSanctions,
      },
    };
  }

  async getFederation(gameId: number): Promise<FederationOverview> {
    const fed = await this.playerFederation(gameId);
    const [league] = await this.db
      .select({ id: s.leagues.id, name: s.leagues.name })
      .from(s.leagues)
      .where(eq(s.leagues.federationId, fed.id));

    const divisions = league
      ? await this.db
          .select({
            id: s.divisions.id,
            name: s.divisions.name,
            orden: s.divisions.orden,
            plazas: s.divisions.plazas,
          })
          .from(s.divisions)
          .where(eq(s.divisions.leagueId, league.id))
          .orderBy(asc(s.divisions.orden))
      : [];

    const counts = await this.db
      .select({
        divisionId: s.teams.divisionId,
        c: sql<number>`count(*)::int`,
      })
      .from(s.teams)
      .where(eq(s.teams.gameId, gameId))
      .groupBy(s.teams.divisionId);
    const countByDiv = new Map(counts.map((r) => [r.divisionId, r.c]));
    const teamCount = counts.reduce((a, r) => a + r.c, 0);

    return {
      id: fed.id,
      name: fed.name,
      prestige: fed.prestige,
      tier: tierOf(fed.prestige),
      isPlayer: fed.isPlayer,
      leagueName: league?.name ?? null,
      teamCount,
      divisions: divisions.map((d) => ({
        id: d.id,
        name: d.name ?? 'División',
        orden: d.orden,
        plazas: d.plazas,
        teamCount: countByDiv.get(d.id) ?? 0,
      })),
    };
  }

  async getFederationById(gameId: number, federationId: number): Promise<FederationOverview> {
    const state = await this.repo.loadState(gameId);
    const engFed = state.federations.find(f => f.id === federationId);
    if (!engFed) throw new NotFoundException(`Federation ${federationId} not found`);
    const confNames = new Map(state.confederations.map((c) => [c.id, c.name]));

    // Check if this is the player federation (has a DB row)
    const [dbFed] = await this.db
      .select()
      .from(s.federations)
      .where(and(eq(s.federations.gameId, gameId), eq(s.federations.engineFederationId, federationId)));

    // For player federation, use DB data; for rivals, use engine state
    const isPlayer = engFed.isPlayer;

    let leagueName: string | null = null;
    let divisions: FederationOverview['divisions'] = [];
    let teamCount = 0;

    if (isPlayer && dbFed) {
      // Player federation — query DB as before
      const [league] = await this.db
        .select({ id: s.leagues.id, name: s.leagues.name })
        .from(s.leagues)
        .where(eq(s.leagues.federationId, dbFed.id));
      leagueName = league?.name ?? null;

      const dbDivisions = league
        ? await this.db
            .select({
              id: s.divisions.id,
              name: s.divisions.name,
              orden: s.divisions.orden,
              plazas: s.divisions.plazas,
            })
            .from(s.divisions)
            .where(eq(s.divisions.leagueId, league.id))
            .orderBy(asc(s.divisions.orden))
        : [];

      const teamRows = await this.db
        .select({ divisionId: s.teams.divisionId })
        .from(s.teams)
        .where(eq(s.teams.federationId, dbFed.id));
      teamCount = teamRows.length;

      const divCounts = new Map<number, number>();
      for (const t of teamRows) {
        if (t.divisionId != null) {
          divCounts.set(t.divisionId, (divCounts.get(t.divisionId) ?? 0) + 1);
        }
      }

      divisions = dbDivisions.map((d) => ({
        id: d.id,
        name: d.name ?? 'División',
        orden: d.orden,
        plazas: d.plazas,
        teamCount: divCounts.get(d.id) ?? 0,
      }));
    } else {
      // Rival federation — build from engine state
      const rivalTeams = state.teams.filter(t => t.federationId === federationId);
      teamCount = rivalTeams.length;

      const rivalDivisions = state.divisions
        .filter(d => d.federationId === federationId)
        .sort((a, b) => a.orden - b.orden);

      divisions = rivalDivisions.map(d => {
        const count = rivalTeams.filter(t => t.divisionOrden === d.orden).length;
        return {
          id: d.orden,
          name: d.name ?? `División ${d.orden}`,
          orden: d.orden,
          plazas: d.orden === 1 ? 20 : 18,
          teamCount: count,
        };
      });

      // Derive league name from division names or confederation
      leagueName = rivalDivisions[0]?.name ?? confNames.get(engFed.confederationId ?? 0) ?? null;
    }

    // Rival standings from engine state
    let standings: FederationOverview['standings'] = undefined;
    if (!isPlayer) {
      const rivalKey = Object.keys(state.rivalStandings).find(k => {
        const [fedIdStr] = k.split(':');
        return Number(fedIdStr) === engFed.id;
      });
      if (rivalKey) {
        standings = state.rivalStandings[rivalKey].map(r => ({
          teamId: r.teamId,
          name: r.name,
          played: r.played,
          won: r.won,
          drawn: r.drawn,
          lost: r.lost,
          goalsFor: r.goalsFor,
          goalsAgainst: r.goalsAgainst,
          goalDiff: r.goalDiff,
          points: r.points,
        }));
      }
    }

    const teamsForFed = !isPlayer
      ? state.teams
          .filter((t) => t.federationId === federationId)
          .sort((a, b) => b.strength - a.strength)
          .map((t) => ({ teamId: t.id, name: t.name, strength: t.strength, arraigo: t.arraigo }))
      : undefined;

    const seasonHistory = !isPlayer
      ? state.rivalSeasonRecords
          .filter(r => r.federationId === federationId)
          .sort((a, b) => b.year - a.year)
          .map(r => ({
            year: r.year,
            federationId: r.federationId,
            federationName: r.federationName,
            championName: r.championName,
            runnerUpName: r.runnerUpName ?? null,
            topScorer: r.topScorer ?? null,
            relegated: r.relegated,
            cupWinner: r.cupWinner,
          }))
      : undefined;

    return {
      id: engFed.id,
      name: engFed.name,
      prestige: engFed.prestige,
      tier: tierOf(engFed.prestige),
      isPlayer,
      leagueName,
      teamCount,
      divisions,
      confederationId: engFed.confederationId || undefined,
      confederationName: engFed.confederationId ? confNames.get(engFed.confederationId) : undefined,
      standings,
      teams: teamsForFed,
      seasonHistory,
    };
  }

  async getHistory(gameId: number): Promise<HistoryResponse> {
    const records = await this.db
      .select({
        anio: s.seasonRecords.anio,
        championTeamId: s.seasonRecords.championTeamId,
        championName: s.teams.name,
        divisionName: s.divisions.name,
      })
      .from(s.seasonRecords)
      .leftJoin(s.teams, eq(s.seasonRecords.championTeamId, s.teams.id))
      .leftJoin(s.divisions, eq(s.seasonRecords.divisionId, s.divisions.id))
      .where(eq(s.seasonRecords.gameId, gameId))
      .orderBy(desc(s.seasonRecords.anio));

    const palmares = await this.db
      .select({
        teamId: s.vwPalmares.teamId,
        teamName: s.teams.name,
        titles: s.vwPalmares.titles,
      })
      .from(s.vwPalmares)
      .leftJoin(s.teams, eq(s.vwPalmares.teamId, s.teams.id))
      .where(eq(s.vwPalmares.gameId, gameId))
      .orderBy(desc(s.vwPalmares.titles));

    const awards = await this.db
      .select({
        anio: s.awards.anio,
        tipo: s.awards.tipo,
        playerName: s.players.name,
        teamName: s.teams.name,
        valor: s.awards.valor,
      })
      .from(s.awards)
      .leftJoin(s.players, eq(s.awards.playerId, s.players.id))
      .leftJoin(s.teams, eq(s.awards.teamId, s.teams.id))
      .where(eq(s.awards.gameId, gameId))
      .orderBy(desc(s.awards.anio), s.awards.tipo);

    const topScorers = await this.db
      .select({
        playerId: s.vwRankingGoleadores.playerId,
        playerName: s.players.name,
        teamName: s.teams.name,
        seasonsWon: s.vwRankingGoleadores.seasonsWon,
        totalGoles: s.vwRankingGoleadores.totalGoles,
      })
      .from(s.vwRankingGoleadores)
      .leftJoin(s.players, eq(s.vwRankingGoleadores.playerId, s.players.id))
      .leftJoin(s.teams, eq(s.players.teamId, s.teams.id))
      .where(eq(s.vwRankingGoleadores.gameId, gameId))
      .orderBy(desc(s.vwRankingGoleadores.totalGoles));

    // Rival champions from engine state — use rivalSeasonRecords (Fase 11.2+) which
    // store federationName directly, avoiding the broken divisionOrden→federationId lookup.
    const state = await this.repo.loadState(gameId);
    const rivalChampions = (state.rivalSeasonRecords ?? []).map(r => ({
      year: r.year,
      federationName: r.federationName,
      championName: r.championName,
      points: r.points ?? 0,
    }));

    // 7.1: Trajectory data for all player-federation teams
    const playerTeamIds = state.teams
      .filter(t => t.federationId === state.playerFederationId)
      .map(t => t.id);

    let trajectoryData: HistoryResponse['trajectoryData'] = [];
    if (playerTeamIds.length > 0) {
      const trajRows = await this.db
        .select({
          teamId: s.trajectories.teamId,
          teamName: s.teams.name,
          anio: s.trajectories.anio,
          divisionOrden: s.trajectories.divisionOrden,
          puestoFinal: s.trajectories.puestoFinal,
        })
        .from(s.trajectories)
        .innerJoin(s.teams, eq(s.trajectories.teamId, s.teams.id))
        .where(
          and(
            eq(s.trajectories.gameId, gameId),
            inArray(s.trajectories.teamId, playerTeamIds),
          ),
        )
        .orderBy(asc(s.trajectories.anio));

      const byTeam = new Map<number, { teamId: number; teamName: string; rows: Array<{ anio: number; divisionOrden: number | null; puestoFinal: number }> }>();
      for (const row of trajRows) {
        if (!byTeam.has(row.teamId)) {
          byTeam.set(row.teamId, { teamId: row.teamId, teamName: row.teamName ?? '—', rows: [] });
        }
        byTeam.get(row.teamId)!.rows.push({
          anio: row.anio,
          divisionOrden: row.divisionOrden,
          puestoFinal: row.puestoFinal,
        });
      }
      trajectoryData = [...byTeam.values()];
    }

    return {
      records: records.map((r) => ({
        anio: r.anio,
        championTeamId: r.championTeamId,
        championName: r.championName ?? '—',
        divisionName: r.divisionName ?? null,
      })),
      palmares: palmares.map((p) => ({
        teamId: p.teamId,
        teamName: p.teamName ?? '—',
        titles: p.titles,
      })),
      awards: awards.map((a) => ({
        year: a.anio,
        tipo: a.tipo,
        playerName: a.playerName ?? '—',
        teamName: a.teamName ?? '—',
        valor: a.valor,
      })),
      topScorers: topScorers.map((r) => ({
        playerId: r.playerId,
        playerName: r.playerName ?? '—',
        teamName: r.teamName ?? '—',
        seasonsWon: r.seasonsWon,
        totalGoles: r.totalGoles,
      })),
      rivalChampions,
      trajectoryData,
      recordBook: state.recordBook ?? null,
    };
  }

  /* ----------------------------- Batch 7: world ranking & export/import */

  async getWorldRanking(gameId: number): Promise<WorldRankingResponse> {
    const state = await this.repo.loadState(gameId);
    const isPlayer = new Map(state.federations.map(f => [f.id, f.isPlayer]));
    const rows = state.federationCoefficients.map(c => ({
      federationId: c.federationId,
      name: c.name,
      cumulativeScore: c.cumulativeScore,
      lastRank: c.lastRank,
      lastScore: c.lastScore,
      seasonsRanked: c.seasonsRanked,
      isPlayer: isPlayer.get(c.federationId) ?? false,
    }));
    return { rows };
  }

  async getWorldStandings(gameId: number): Promise<WorldStandingsResponse> {
    const state = await this.repo.loadState(gameId);

    const fedById = new Map(state.federations.map((f) => [f.id, f]));
    const confById = new Map(state.confederations.map((c) => [c.id, c]));

    const rivalDivs = state.divisions.filter((d) => d.federationId !== state.playerFederationId);
    const divsByFed = new Map<number, typeof rivalDivs>();
    for (const div of rivalDivs) {
      const arr = divsByFed.get(div.federationId) ?? [];
      arr.push(div);
      divsByFed.set(div.federationId, arr);
    }

    const federations: WorldStandingsResponse['federations'] = [];

    for (const [fedId, divs] of divsByFed) {
      const fed = fedById.get(fedId);
      if (!fed) continue;
      const confederation = fed.confederationId ? confById.get(fed.confederationId) : undefined;

      const divisions = divs
        .sort((a, b) => a.orden - b.orden)
        .map((div) => {
          const key = `${fedId}:${div.orden}`;
          const rows = (state.rivalStandings[key] ?? []).map((r) => ({
            teamId: r.teamId,
            name: r.name,
            played: r.played,
            won: r.won,
            drawn: r.drawn,
            lost: r.lost,
            goalsFor: r.goalsFor,
            goalsAgainst: r.goalsAgainst,
            goalDiff: r.goalDiff,
            points: r.points,
          }));
          return { orden: div.orden, name: div.name, standings: rows };
        });

      federations.push({
        federationId: fedId,
        federationName: fed.name,
        confederationName: confederation?.name,
        prestige: fed.prestige,
        tier: tierOf(fed.prestige) as 1 | 2 | 3 | 4 | 5,
        matchdayProgress: state.rivalCurrentMatchday ?? 0,
        divisions,
      });
    }

    federations.sort((a, b) => b.prestige - a.prestige);
    return { federations };
  }

  async exportGame(gameId: number): Promise<{ name: string; state: unknown }> {
    const [game] = await this.db
      .select({ name: s.games.name })
      .from(s.games)
      .where(eq(s.games.id, gameId));
    if (!game) throw new NotFoundException(`Game ${gameId} not found`);
    const state = await this.repo.loadState(gameId);
    return { name: game.name, state };
  }

  async importGame(name: string, importedState: unknown, user: AuthUser): Promise<{ id: number }> {
    const parsed = GameStateImportSchema.safeParse(importedState);
    if (!parsed.success) {
      throw new BadRequestException('Estado de partida inválido o corrupto');
    }
    const state = parsed.data as unknown as GameState;

    if (user.role !== 'admin') {
      const [{ c }] = await this.db
        .select({ c: count() })
        .from(s.games)
        .where(eq(s.games.userId, user.id));
      if (c >= 3) throw new BadRequestException('GAME_LIMIT_REACHED');
    }
    return this.db.transaction(async (tx) => {
      const [newGame] = await tx
        .insert(s.games)
        .values({
          name,
          seed: state.seed ?? 0,
          currentYear: state.year ?? 1,
          userId: user.id,
        })
        .returning({ id: s.games.id });
      await tx.insert(s.gameEngineStates).values({
        gameId: newGame.id,
        state: state as unknown as Record<string, unknown>,
      });
      return { id: newGame.id };
    });
  }

  /* ------------------------------- commissioner: federations & market */

  async getFederations(gameId: number): Promise<FederationListItem[]> {
    const state = await this.repo.loadState(gameId);
    const confNames = new Map(state.confederations.map((c) => [c.id, c.name]));
    return state.federations
      .map((f) => ({
        id: f.id,
        name: f.name,
        prestige: f.prestige,
        tier: tierOf(f.prestige),
        isPlayer: f.isPlayer,
        teamCount: state.teams.filter((t) => t.federationId === f.id).length,
        confederationId: f.confederationId || undefined,
        confederationName: f.confederationId ? confNames.get(f.confederationId) : undefined,
      }))
      .sort((a, b) => b.prestige - a.prestige);
  }

  async getMarket(gameId: number): Promise<MarketResponse> {
    const state = await this.repo.loadState(gameId);
    const map = await this.repo.engineToDbTeam(gameId);
    const fedName = new Map(state.federations.map((f) => [f.id, f]));
    const teams = negotiableTeams(state).map((t) => {
      const owner = fedName.get(t.federationId);
      return {
        teamId: map.get(t.id) ?? t.id,
        name: t.name,
        strength: t.strength,
        arraigo: t.arraigo,
        tier: tierOf(owner?.prestige ?? 0),
        currentFederationId: t.federationId,
        currentFederationName: owner?.name ?? '—',
      };
    });
    return { playerTier: playerTier(state), teams };
  }

  async getNegotiations(gameId: number): Promise<NegotiationDto[]> {
    const state = await this.repo.loadState(gameId);
    const map = await this.repo.engineToDbTeam(gameId);
    const teamName = new Map(state.teams.map((t) => [t.id, t.name]));
    const fedName = new Map(state.federations.map((f) => [f.id, f.name]));
    return state.negotiations.map((n) => ({
      id: n.id,
      targetTeamId: map.get(n.targetTeamId) ?? n.targetTeamId,
      targetTeamName: teamName.get(n.targetTeamId) ?? '—',
      state: n.state,
      startedYear: n.startedYear,
      requirementsSeasonsLeft: n.requirementsSeasonsLeft,
      acceptedYear: n.acceptedYear,
      effectiveYear: n.effectiveYear,
      fromFederationName: fedName.get(n.fromFederationId) ?? '—',
      byFederationName: fedName.get(n.byFederationId) ?? '—',
      requirements: n.requirements ?? [],
      offerValue: n.offerValue ?? 0,
      revealedCount: n.revealedCount ?? 0,
    }));
  }

  async startNegotiation(
    gameId: number,
    dbTeamId: number,
  ): Promise<NegotiationDto[]> {
    return this.db.transaction(async (tx) => {
      const [team] = await tx
        .select({ eng: s.teams.engineTeamId })
        .from(s.teams)
        .where(and(eq(s.teams.gameId, gameId), eq(s.teams.id, dbTeamId)));
      if (!team || team.eng == null) {
        throw new NotFoundException(`Team ${dbTeamId} not found`);
      }
      const state = await this.repo.loadState(gameId, tx);
      const next = engineStartNegotiation(state, team.eng);
      if (next === state) {
        throw new BadRequestException(
          'No puedes negociar por este equipo (tier, ya en curso o propio)',
        );
      }
      await this.repo.saveState(tx, gameId, next);
      // Inline projection of the just-created negotiations list.
      const map = await this.repo.engineToDbTeam(gameId, tx);
      const teamName = new Map(next.teams.map((t) => [t.id, t.name]));
      const fedName = new Map(next.federations.map((f) => [f.id, f.name]));
      return next.negotiations.map((n) => ({
        id: n.id,
        targetTeamId: map.get(n.targetTeamId) ?? n.targetTeamId,
        targetTeamName: teamName.get(n.targetTeamId) ?? '—',
        state: n.state,
        startedYear: n.startedYear,
        requirementsSeasonsLeft: n.requirementsSeasonsLeft,
        acceptedYear: n.acceptedYear,
        effectiveYear: n.effectiveYear,
        fromFederationName: fedName.get(n.fromFederationId) ?? '—',
        byFederationName: fedName.get(n.byFederationId) ?? '—',
        requirements: n.requirements ?? [],
        offerValue: n.offerValue ?? 0,
        revealedCount: n.revealedCount ?? 0,
      }));
    });
  }

  async setOfferValue(gameId: number, negId: number, offerValue: number): Promise<NegotiationDto[]> {
    return this.db.transaction(async (tx) => {
      const state = await this.repo.loadState(gameId, tx);
      const next = engineSetNegotiationOfferValue(state, negId, offerValue);
      if (next === state) throw new BadRequestException('Negociación no encontrada o no modificable');
      await this.repo.saveState(tx, gameId, next);
      const map = await this.repo.engineToDbTeam(gameId, tx);
      const teamName = new Map(next.teams.map((t) => [t.id, t.name]));
      const fedName = new Map(next.federations.map((f) => [f.id, f.name]));
      return next.negotiations.map((n) => ({
        id: n.id,
        targetTeamId: map.get(n.targetTeamId) ?? n.targetTeamId,
        targetTeamName: teamName.get(n.targetTeamId) ?? '—',
        state: n.state,
        startedYear: n.startedYear,
        requirementsSeasonsLeft: n.requirementsSeasonsLeft,
        acceptedYear: n.acceptedYear,
        effectiveYear: n.effectiveYear,
        fromFederationName: fedName.get(n.fromFederationId) ?? '—',
        byFederationName: fedName.get(n.byFederationId) ?? '—',
        requirements: n.requirements ?? [],
        offerValue: n.offerValue ?? 0,
        revealedCount: n.revealedCount ?? 0,
      }));
    });
  }

  /* ------------------------------------- commissioner: economy (§4.5) */

  private economyResponse(state: GameState): EconomyResponse {
    const competing = state.teams.filter(
      (t) => t.divisionOrden !== null,
    ).length;
    return {
      treasury: state.treasury,
      financialHealth: financialHealth(state.treasury),
      operatingCostNow: operatingCost(competing, state.divisions.length),
      policy: {
        talentInvestment: state.economy.talentInvestment,
      },
      last: state.lastEconomy,
      contracts: state.commercialContracts.map((c) => ({
        id: c.id,
        tipo: c.tipo,
        nombre: c.nombre,
        valorAnual: c.valorAnual,
        yearsLeft: c.yearsLeft,
      })),
      offers: state.contractOffers.map((o) => ({
        id: o.id,
        tipo: o.tipo,
        nombre: o.nombre,
        valorAnual: o.valorAnual,
        years: o.years,
      })),
    };
  }

  async getEconomy(gameId: number): Promise<EconomyResponse> {
    return this.economyResponse(await this.repo.loadState(gameId));
  }

  async setEconomyPolicy(
    gameId: number,
    policy: { talentInvestment: number },
  ): Promise<EconomyResponse> {
    return this.db.transaction(async (tx) => {
      const next = engineSetEconomyPolicy(await this.repo.loadState(gameId, tx), policy);
      await this.repo.saveState(tx, gameId, next);
      return this.economyResponse(next);
    });
  }

  async signContract(
    gameId: number,
    offerId: number,
  ): Promise<EconomyResponse> {
    return this.db.transaction(async (tx) => {
      const state = await this.repo.loadState(gameId, tx);
      const next = engineSignContract(state, offerId);
      if (next === state) {
        throw new BadRequestException('Oferta no disponible');
      }
      await this.repo.saveState(tx, gameId, next);
      return this.economyResponse(next);
    });
  }

  async cancelContract(
    gameId: number,
    contractId: number,
  ): Promise<EconomyResponse> {
    return this.db.transaction(async (tx) => {
      const state = await this.repo.loadState(gameId, tx);
      const next = engineCancelContract(state, contractId);
      if (next === state) {
        throw new BadRequestException('Contrato no encontrado');
      }
      await this.repo.saveState(tx, gameId, next);
      return this.economyResponse(next);
    });
  }

  // Fase 6.5: prize definitions per competition + the payouts ledger. cupId
  // is passed through as the engine id (matches what /cups returns); team ids
  // are mapped engine→db so the UI can navigate to team pages.
  private prizesResponse(
    state: GameState,
    teamMap: Map<number, number>,
  ): PrizesResponse {
    const cupName = new Map(state.cups.map((c) => [c.id, c.name]));
    return {
      prizes: state.competitionPrizes.map((p) => ({
        id: p.id,
        kind: p.kind,
        cupId: p.cupId,
        cupName: p.cupId !== null ? (cupName.get(p.cupId) ?? null) : null,
        pool: p.pool,
        shares: p.shares,
      })),
      latestPaidYear: state.prizePayments.reduce(
        (m, p) => Math.max(m, p.year),
        0,
      ),
      payments: state.prizePayments.map((p) => ({
        year: p.year,
        competitionLabel: p.competitionLabel,
        teamId: teamMap.get(p.teamId) ?? p.teamId,
        teamName: p.teamName,
        position: p.position,
        amount: p.amount,
      })),
    };
  }

  async getPrizes(gameId: number): Promise<PrizesResponse> {
    const state = await this.repo.loadState(gameId);
    return this.prizesResponse(state, await this.repo.engineToDbTeam(gameId));
  }

  async setLeaguePrize(
    gameId: number,
    pool: number,
    shares: number[],
  ): Promise<PrizesResponse> {
    return this.db.transaction(async (tx) => {
      const state = await this.repo.loadState(gameId, tx);
      const next = engineSetLeaguePrize(state, pool, shares);
      if (next === state) {
        throw new BadRequestException(
          'No se pueden definir premios fuera de pretemporada',
        );
      }
      await this.repo.saveState(tx, gameId, next);
      return this.prizesResponse(next, await this.repo.engineToDbTeam(gameId, tx));
    });
  }

  async setCupPrize(
    gameId: number,
    cupId: number, // engine cup id (matches what /cups returns)
    pool: number,
    shares: number[],
  ): Promise<PrizesResponse> {
    return this.db.transaction(async (tx) => {
      const state = await this.repo.loadState(gameId, tx);
      const next = engineSetCupPrize(state, cupId, pool, shares);
      if (next === state) {
        throw new BadRequestException(
          'No se pudo asignar el premio: copa no existe o no estás en pretemporada',
        );
      }
      await this.repo.saveState(tx, gameId, next);
      return this.prizesResponse(next, await this.repo.engineToDbTeam(gameId, tx));
    });
  }

  async removePrize(gameId: number, prizeId: number): Promise<PrizesResponse> {
    return this.db.transaction(async (tx) => {
      const state = await this.repo.loadState(gameId, tx);
      const next = engineRemovePrize(state, prizeId);
      if (next === state) {
        throw new BadRequestException(
          'No se pudo eliminar el premio (no existe o no estás en pretemporada)',
        );
      }
      await this.repo.saveState(tx, gameId, next);
      return this.prizesResponse(next, await this.repo.engineToDbTeam(gameId, tx));
    });
  }

  // Fase 6.4: transfer window report. `year` is the year the transfers belong
  // to (the pretemporada of the year stamped on each entry); `entries` is the
  // latest window, `history` is every move ever recorded.
  async getTransfers(gameId: number): Promise<TransfersResponse> {
    const state = await this.repo.loadState(gameId);
    const map = await this.repo.engineToDbTeam(gameId);
    const dto = state.transfers.map((t) => ({
      year: t.year,
      playerId: t.playerId,
      playerName: t.playerName,
      fromTeamId: map.get(t.fromTeamId) ?? t.fromTeamId,
      fromTeamName: t.fromTeamName,
      toTeamId: map.get(t.toTeamId) ?? t.toTeamId,
      toTeamName: t.toTeamName,
      calidad: t.calidad,
      ...(t.isInternational && {
        isInternational: t.isInternational,
        fromFederationName: t.fromFederationName,
      }),
    }));
    // Latest year present in the log; 0 when there's no history yet.
    const latestYear = dto.reduce((acc, t) => Math.max(acc, t.year), 0);
    return {
      year: latestYear,
      entries: dto.filter((t) => t.year === latestYear),
      history: dto,
    };
  }

  // Fase 6.3: salary-cap compliance per team. One row per competing team in
  // the player's league, with the wage bill and whether it fits the active
  // tope_salarial cap (null cap => everybody trivially complies, just shows
  // the bills).
  async getCompliance(gameId: number): Promise<ComplianceResponse> {
    const state = await this.repo.loadState(gameId);
    const map = await this.repo.engineToDbTeam(gameId);
    const cap =
      state.norms.find((n) => n.tipo === 'tope_salarial')?.valor ?? null;
    const divName = new Map(state.divisions.map((d) => [d.orden, d.name]));
    const rows = state.teams
      .filter(
        (t) =>
          t.divisionOrden !== null &&
          t.federationId === state.playerFederationId,
      )
      .map((t) => {
        const bill = wageBill(t.id, state.players);
        return {
          teamId: map.get(t.id) ?? t.id,
          teamName: t.name,
          divisionName: divName.get(t.divisionOrden!) ?? null,
          wageBill: bill,
          cap,
          complies: cap === null ? true : bill <= cap,
        };
      })
      .sort((a, b) => b.wageBill - a.wageBill);
    return { cap, rows };
  }

  /* ------------------------------ commissioner: norms & sanctions (§4.7) */

  private normsResponse(
    state: GameState,
    map: Map<number, number>,
  ): NormsResponse {
    const teamName = new Map(state.teams.map((t) => [t.id, t.name]));
    return {
      norms: state.norms.map((n) => ({
        id: n.id,
        tipo: n.tipo,
        valor: n.valor,
      })),
      breaches: normBreaches(state).map((b) => ({
        teamId: map.get(b.teamId) ?? b.teamId,
        teamName: b.teamName,
        normId: b.normId,
        tipo: b.tipo,
        valor: b.valor,
        valorActual: b.valorActual,
        sanctioned: b.sanctioned,
      })),
      sanctions: state.sanctions.map((sa) => ({
        id: sa.id,
        teamId: map.get(sa.teamId) ?? sa.teamId,
        teamName: teamName.get(sa.teamId) ?? '—',
        normId: sa.normId,
        year: sa.year,
        appliesToYear: sa.appliesToYear,
        motivo: sa.motivo,
        castigo: sa.castigo,
      })),
    };
  }

  async getNorms(gameId: number): Promise<NormsResponse> {
    const state = await this.repo.loadState(gameId);
    return this.normsResponse(state, await this.repo.engineToDbTeam(gameId));
  }

  async addNorm(
    gameId: number,
    tipo: NormType,
    valor: number,
  ): Promise<NormsResponse> {
    return this.db.transaction(async (tx) => {
      const next = engineAddNorm(await this.repo.loadState(gameId, tx), tipo, valor);
      await this.repo.saveState(tx, gameId, next);
      return this.normsResponse(next, await this.repo.engineToDbTeam(gameId, tx));
    });
  }

  async removeNorm(gameId: number, normId: number): Promise<NormsResponse> {
    return this.db.transaction(async (tx) => {
      const next = engineRemoveNorm(await this.repo.loadState(gameId, tx), normId);
      await this.repo.saveState(tx, gameId, next);
      return this.normsResponse(next, await this.repo.engineToDbTeam(gameId, tx));
    });
  }

  async sanctionTeam(
    gameId: number,
    dbTeamId: number,
    normId: number,
  ): Promise<NormsResponse> {
    return this.db.transaction(async (tx) => {
      const [team] = await tx
        .select({ eng: s.teams.engineTeamId })
        .from(s.teams)
        .where(and(eq(s.teams.gameId, gameId), eq(s.teams.id, dbTeamId)));
      if (!team || team.eng == null) {
        throw new NotFoundException(`Team ${dbTeamId} not found`);
      }
      const state = await this.repo.loadState(gameId, tx);
      const next = engineSanctionTeam(state, team.eng, normId);
      if (next === state) {
        throw new BadRequestException(
          'No se puede sancionar: el equipo no incumple esa norma o ya está sancionado',
        );
      }
      await this.repo.saveState(tx, gameId, next);
      return this.normsResponse(next, await this.repo.engineToDbTeam(gameId, tx));
    });
  }

  /* --------------------------------------- commissioner: impulses (§4.6) */

  private nextFixturesResponse(
    state: GameState,
    map: Map<number, number>,
  ): NextFixturesResponse {
    const teamName = new Map(state.teams.map((t) => [t.id, t.name]));
    const divName = new Map(state.divisions.map((d) => [d.orden, d.name]));
    const fixtures = state.fixtures
      .filter((f) => f.matchday === state.currentMatchday)
      .map((f) => {
        const imp = state.pendingImpulses.find(
          (p) =>
            p.matchday === f.matchday &&
            p.homeId === f.homeId &&
            p.awayId === f.awayId,
        );
        return {
          matchday: f.matchday,
          divisionOrden: f.divisionOrden,
          divisionName: divName.get(f.divisionOrden) ?? 'División',
          homeTeamId: map.get(f.homeId) ?? f.homeId,
          homeTeamName: teamName.get(f.homeId) ?? '—',
          awayTeamId: map.get(f.awayId) ?? f.awayId,
          awayTeamName: teamName.get(f.awayId) ?? '—',
          favoredTeamId: imp
            ? (map.get(imp.favoredTeamId) ?? imp.favoredTeamId)
            : null,
        };
      });

    // Fase 6.2: copas programadas en esta jornada. Rondas futuras de eliminatoria
    // se generan dinámicamente al jugarse, así que pueden venir sin matches.
    const cupRounds = state.cupSchedule
      .filter((e) => e.matchday === state.currentMatchday)
      .map((e) => {
        const cup = state.cups.find((c) => c.id === e.cupId);
        const round = cup?.rounds.find((r) => r.numero === e.roundNumero);
        const matches =
          round?.matches.map((m) => ({
            homeTeamId: m.homeTeamId > 0 ? (map.get(m.homeTeamId) ?? m.homeTeamId) : null,
            homeTeamName: m.homeTeamId > 0 ? (teamName.get(m.homeTeamId) ?? '—') : null,
            awayTeamId: m.awayTeamId > 0 ? (map.get(m.awayTeamId) ?? m.awayTeamId) : null,
            awayTeamName: m.awayTeamId > 0 ? (teamName.get(m.awayTeamId) ?? '—') : null,
          })) ?? [];
        return {
          cupId: cup?.id ?? e.cupId,
          cupName: cup?.name ?? '—',
          cupFormato: (cup?.formato ?? 'eliminatoria') as 'eliminatoria' | 'liga',
          roundNumero: e.roundNumero,
          matchesKnown: !!round,
          matches,
        };
      });

    return {
      matchday: state.currentMatchday,
      seasonOver: state.seasonOver,
      impulsesRemaining: state.impulsesRemaining,
      impulsesPerSeason: state.impulsesPerSeason,
      fixtures,
      cupRounds,
    };
  }

  async getNextFixtures(gameId: number): Promise<NextFixturesResponse> {
    const state = await this.repo.loadState(gameId);
    return this.nextFixturesResponse(state, await this.repo.engineToDbTeam(gameId));
  }

  async applyImpulse(
    gameId: number,
    dbHomeId: number,
    dbAwayId: number,
    dbFavoredId: number,
  ): Promise<NextFixturesResponse> {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .select({ id: s.teams.id, eng: s.teams.engineTeamId })
        .from(s.teams)
        .where(eq(s.teams.gameId, gameId));
      const dbToEng = new Map<number, number>();
      for (const r of rows) if (r.eng != null) dbToEng.set(r.id, r.eng);

      const engHome = dbToEng.get(dbHomeId);
      const engAway = dbToEng.get(dbAwayId);
      const engFav = dbToEng.get(dbFavoredId);
      if (engHome == null || engAway == null || engFav == null) {
        throw new NotFoundException('Equipo no encontrado');
      }
      if (engFav !== engHome && engFav !== engAway) {
        throw new BadRequestException(
          'El equipo beneficiado debe jugar ese partido',
        );
      }

      const state = await this.repo.loadState(gameId, tx);
      const fixture = state.fixtures.find(
        (f) =>
          f.matchday === state.currentMatchday &&
          f.homeId === engHome &&
          f.awayId === engAway,
      );
      if (!fixture) {
        throw new BadRequestException(
          'Ese partido no está en la próxima jornada',
        );
      }
      const next = engineApplyImpulse(state, fixture, engFav);
      if (next === state) {
        throw new BadRequestException(
          'Sin impulsos disponibles o ya aplicado a ese partido',
        );
      }
      await this.repo.saveState(tx, gameId, next);
      return this.nextFixturesResponse(
        next,
        await this.repo.engineToDbTeam(gameId, tx),
      );
    });
  }

  /* --------------------------------- season events / polémicas (§1, §2) */

  private effectDescription(tipo: GameState['events'][number]['tipo']): string {
    switch (tipo) {
      case 'arbitraje_dudoso': return 'Si actúas: -1M€, -3 arraigo, pierdes 1 impulse.';
      case 'incidente_aficion': return 'Si actúas: -1M€, -3 arraigo, -10% capacidad de estadio.';
      case 'declaraciones_polemicas': return 'Si actúas: -1M€, -3 arraigo, -1 prestige (multa).';
      case 'doping_positivo': return 'Si actúas: -1M€, -3 arraigo, el equipo pierde -10 strength.';
      case 'conflicto_jugadores': return 'Si actúas: -1M€, -3 arraigo, el equipo pierde -5 strength.';
      case 'crisis_economica_club': return 'Si actúas: -1M€, -3 arraigo, +3M€ bailout pero -5 strength al club.';
      case 'escandalo_directiva': return 'Si actúas: -1M€, -3 arraigo, pierdes 2 impulses.';
      case 'manipulacion_resultados': return 'Si actúas: -1M€, -3 arraigo, descenso 1 división.';
    }
  }

  private eventsResponse(
    state: GameState,
    map: Map<number, number>,
  ): EventsResponse {
    const teamName = new Map(state.teams.map((t) => [t.id, t.name]));
    const toDto = (e: GameState['events'][number]) => ({
      id: e.id,
      year: e.year,
      matchday: e.matchday,
      tipo: e.tipo,
      status: e.status,
      teamId: e.teamId !== null ? (map.get(e.teamId) ?? null) : null,
      teamName: e.teamId !== null ? (teamName.get(e.teamId) ?? null) : null,
      message: e.message,
      resolvedAction: e.resolvedAction,
      severity: e.severity,
      chainedFromId: e.chainedFromId,
      effectDescription: this.effectDescription(e.tipo),
    });
    const sorted = [...state.events].sort(
      (a, b) => b.year - a.year || b.matchday - a.matchday || b.id - a.id,
    );
    return {
      pending: sorted.filter((e) => e.status === 'pendiente').map(toDto),
      recent: sorted.filter((e) => e.status !== 'pendiente').slice(0, 12).map(toDto),
    };
  }

  async getEvents(gameId: number): Promise<EventsResponse> {
    const state = await this.repo.loadState(gameId);
    return this.eventsResponse(state, await this.repo.engineToDbTeam(gameId));
  }

  async resolveEvent(
    gameId: number,
    eventId: number,
    action: 'actuar' | 'ignorar',
  ): Promise<EventsResponse> {
    return this.db.transaction(async (tx) => {
      const state = await this.repo.loadState(gameId, tx);
      const next = engineResolveEvent(state, eventId, action);
      if (next === state) {
        throw new BadRequestException(
          'No se puede resolver: evento no encontrado o ya resuelto',
        );
      }
      await this.repo.saveState(tx, gameId, next);
      return this.eventsResponse(next, await this.repo.engineToDbTeam(gameId, tx));
    });
  }

  /* --------------------------------------- cups / tournaments (§4.4) */

  private cupsResponse(
    state: GameState,
    map: Map<number, number>,
  ): CupsResponse {
    const teamName = new Map(state.teams.map((t) => [t.id, t.name]));
    const dbTeamId = (id: number) => (id === -1 ? -1 : (map.get(id) ?? id));
    const name = (id: number) => (id === -1 ? 'BYE' : (teamName.get(id) ?? '—'));
    return {
      cups: state.cups.map((c) => ({
        id: c.id,
        name: c.name,
        tipo: c.tipo,
        formato: c.formato,
        categoria: c.categoria,
        year: c.year,
        status: c.status,
        championTeamId:
          c.championTeamId !== null ? (map.get(c.championTeamId) ?? null) : null,
        championTeamName:
          c.championTeamId !== null ? (teamName.get(c.championTeamId) ?? null) : null,
        rounds: c.rounds.map((r) => ({
          numero: r.numero,
          ...(r.leg ? { leg: r.leg } : {}),
          matches: r.matches.map((m) => ({
            homeTeamId: dbTeamId(m.homeTeamId),
            homeTeamName: name(m.homeTeamId),
            awayTeamId: dbTeamId(m.awayTeamId),
            awayTeamName: name(m.awayTeamId),
            homeGoals: m.homeGoals,
            awayGoals: m.awayGoals,
            played: m.played,
            winnerTeamId:
              m.winnerTeamId !== null ? (map.get(m.winnerTeamId) ?? null) : null,
            ...(m.leg ? { leg: m.leg } : {}),
          })),
        })),
        recurring: c.recurring,
      })),
    };
  }

  async getCups(gameId: number): Promise<CupsResponse> {
    const state = await this.repo.loadState(gameId);
    return this.cupsResponse(state, await this.repo.engineToDbTeam(gameId));
  }

  async createCup(
    gameId: number,
    input: CreateCupRequest,
  ): Promise<CupsResponse> {
    return this.db.transaction(async (tx) => {
      // Map db team ids -> engine ids for the engine call.
      const rows = await tx
        .select({ id: s.teams.id, eng: s.teams.engineTeamId })
        .from(s.teams)
        .where(eq(s.teams.gameId, gameId));
      const dbToEng = new Map<number, number>();
      for (const r of rows) if (r.eng != null) dbToEng.set(r.id, r.eng);
      const engineIds: number[] = [];
      for (const dbId of input.participantTeamIds) {
        const eng = dbToEng.get(dbId);
        if (eng == null) {
          throw new BadRequestException(`Equipo ${dbId} no encontrado`);
        }
        engineIds.push(eng);
      }

      const state = await this.repo.loadState(gameId, tx);
      this.assertPretemporada(state, 'crear una copa');
      const next = engineCreateCup(
        state,
        input.name,
        input.tipo as CupType,
        input.formato,
        input.categoria,
        engineIds,
        input.recurring,
      );
      if (next === state) {
        throw new BadRequestException(
          'No se pudo crear la copa: nombre vacío, participantes inválidos o demasiados/pocos',
        );
      }

      const existing = new Set(state.cups.map((c) => c.id));
      const created = next.cups.find((c) => !existing.has(c.id))!;
      const fedMap = await this.repo.engineToDbFederation(gameId, tx);

      await tx.insert(s.cups).values({
        gameId,
        engineCupId: created.id,
        federationId: fedMap.get(next.playerFederationId)!,
        name: created.name,
        tipo: created.tipo,
        formato: input.formato,
      });

      await this.repo.saveState(tx, gameId, next);
      return this.cupsResponse(next, await this.repo.engineToDbTeam(gameId, tx));
    });
  }
}
