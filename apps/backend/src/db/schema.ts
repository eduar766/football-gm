// Drizzle schema = the persistence model. Faithful translation of the design
// doc §3 entity model + the save root (Game) + the append-only history layer
// (§6). Modeling decisions honored:
//   - Nothing is hard-deleted: associations are nullable FKs; a team leaving a
//     federation sets federation_id = NULL, it is never removed (§3).
//   - History is append-only: season_records / trajectories / awards are written
//     once at season close and never mutated (enforced in the app layer).
//   - Palmarés & rankings are NOT stored: they are SQL views derived from the
//     history tables — a single source of truth (§6).
//   - Tier is NOT stored: it is derived from prestige by the engine (single
//     source of truth for that rule).

import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  pgView,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/* ------------------------------------------------------------------ enums */

export const userRole = pgEnum('user_role', ['admin', 'beta']);
export const playerPosition = pgEnum('player_position', ['POR', 'DEF', 'MED', 'DEL']);
export const competitionType = pgEnum('competition_type', [
  'liga',
  'copa',
  'liga_juvenil',
  'torneo_verano',
  'liga_nivelacion',
]);
export const negotiationState = pgEnum('negotiation_state', [
  'tier_check',
  'gathering_requirements',
  'offer',
  'accepted',
  'effective',
  'rejected',
  'cancelled',
]);
export const commercialContractType = pgEnum('commercial_contract_type', [
  'patrocinio',
  'publicidad',
  'derechos_tv',
  'derechos_imagen',
]);
export const awardType = pgEnum('award_type', [
  'max_goleador',
  'max_asistente',
  'mejor_portero',
]);

export const normType = pgEnum('norm_type', [
  'tope_plantilla',
  'minimo_competitivo',
  'tope_salarial',
  'tope_extrangeros',
  'minimo_cantera',
  'tope_edad_media',
]);

export const negotiationRequirementType = pgEnum('negotiation_requirement_type', [
  'prestigio',
  'estadio',
  'reparto',
]);

export const leagueFormat = pgEnum('league_format', ['ida', 'ida_vuelta']);

export const cupFormat = pgEnum('cup_format', [
  'eliminatoria',
  'eliminatoria_ida_vuelta',
  'liga',
]);

/* ------------------------------------------------------------------ users */

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRole('role').notNull().default('beta'),
  approved: boolean('approved').notNull().default(false),
  forcePasswordChange: boolean('force_password_change').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
});

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
});

export const accessRequestStatus = pgEnum('access_request_status', [
  'pending',
  'approved',
  'rejected',
]);

export const accessRequests = pgTable('access_requests', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  reason: text('reason').notNull(),
  status: accessRequestStatus('status').notNull().default('pending'),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewedByUserId: integer('reviewed_by_user_id').references(() => users.id),
});

/* ------------------------------------------------------- save root: Game */

export const games = pgTable('games', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  seed: bigint('seed', { mode: 'number' }).notNull(),
  currentYear: integer('current_year').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// The serialized engine GameState = the simulation write-model and source of
// truth for determinism (reload the exact state, including the RNG cursor).
// The relational tables below are the read/history projections. This is the
// pragmatic anti-corruption boundary between the pure engine and the domain.
export const gameEngineStates = pgTable('game_engine_states', {
  gameId: integer('game_id')
    .primaryKey()
    .references(() => games.id),
  state: jsonb('state').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/* --------------------------------------------- competitive structure (§3) */

export const federations = pgTable(
  'federations',
  {
    id: serial('id').primaryKey(),
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id),
    // Stable link to the engine's in-state federation id (1 = player, 2.. rivals).
    engineFederationId: integer('engine_federation_id'),
    name: text('name').notNull(),
    prestige: integer('prestige').notNull().default(0),
    isPlayer: boolean('is_player').notNull().default(false),
  },
  (t) => [
    index('federations_game_idx').on(t.gameId),
    uniqueIndex('federations_engine_uq').on(t.gameId, t.engineFederationId),
  ],
);

export const leagues = pgTable(
  'leagues',
  {
    id: serial('id').primaryKey(),
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id),
    federationId: integer('federation_id')
      .notNull()
      .references(() => federations.id),
    name: text('name').notNull(),
    format: leagueFormat('format'),
  },
  (t) => [index('leagues_game_idx').on(t.gameId)],
);

export const divisions = pgTable(
  'divisions',
  {
    id: serial('id').primaryKey(),
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id),
    leagueId: integer('league_id')
      .notNull()
      .references(() => leagues.id),
    name: text('name'),
    orden: integer('orden').notNull(), // 1 = top tier division
    plazas: integer('plazas').notNull(),
  },
  (t) => [index('divisions_league_idx').on(t.leagueId)],
);

// A team absorbs its children (squad, staff, academy, medical, scouts). The
// commissioner does not manage them (§2), so non-squad capabilities are kept as
// lightweight ratings rather than micro-modeled entities. Players are modeled.
export const teams = pgTable(
  'teams',
  {
    id: serial('id').primaryKey(),
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id),
    name: text('name').notNull(),
    // Stable link to the engine's in-state team id (1..N). Nullable: teams not
    // backed by the simulation core (future) can exist without one.
    engineTeamId: integer('engine_team_id'),
    prestige: integer('prestige').notNull().default(0),
    arraigo: integer('arraigo').notNull().default(0), // loyalty to current federation (§5)
    presupuesto: bigint('presupuesto', { mode: 'number' }).notNull().default(0),
    aficion: integer('aficion').notNull().default(0),
    estadioNombre: text('estadio_nombre'),
    estadioAforo: integer('estadio_aforo'),
    strength: integer('strength').notNull().default(50), // avg squad quality proxy
    academiaRating: smallint('academia_rating').notNull().default(50),
    medicoRating: smallint('medico_rating').notNull().default(50),
    ojeadoresRating: smallint('ojeadores_rating').notNull().default(50),
    cuerpoTecnicoRating: smallint('cuerpo_tecnico_rating').notNull().default(50),
    // Nullable: a team can belong to no federation / no division. Never deleted.
    federationId: integer('federation_id').references(() => federations.id),
    divisionId: integer('division_id').references(() => divisions.id),
  },
  (t) => [
    index('teams_game_idx').on(t.gameId),
    index('teams_federation_idx').on(t.federationId),
    index('teams_division_idx').on(t.divisionId),
    uniqueIndex('teams_engine_uq').on(t.gameId, t.engineTeamId),
  ],
);

export const players = pgTable(
  'players',
  {
    id: serial('id').primaryKey(),
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id),
    teamId: integer('team_id').references(() => teams.id), // nullable: free agents
    // Stable link to the engine's in-state player id. Awards/rankings join
    // through this column to translate engine outputs into db rows.
    enginePlayerId: integer('engine_player_id'),
    name: text('name').notNull(),
    posicion: playerPosition('posicion').notNull(),
    calidad: integer('calidad').notNull(),
    nationality: text('nationality').notNull().default('local'),
    cantera: boolean('cantera').notNull().default(false),
  },
  (t) => [
    index('players_team_idx').on(t.teamId),
    uniqueIndex('players_engine_uq').on(t.gameId, t.enginePlayerId),
  ],
);

export const cups = pgTable(
  'cups',
  {
    id: serial('id').primaryKey(),
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id),
    // Stable link to the engine's in-state cup id.
    engineCupId: integer('engine_cup_id'),
    federationId: integer('federation_id')
      .notNull()
      .references(() => federations.id),
    name: text('name').notNull(),
    tipo: competitionType('tipo').notNull(),
    formato: cupFormat('formato'),
  },
  (t) => [
    index('cups_game_idx').on(t.gameId),
    uniqueIndex('cups_engine_uq').on(t.gameId, t.engineCupId),
  ],
);

/* ----------------------------------------------------- season cycle (§3) */

export const seasons = pgTable(
  'seasons',
  {
    id: serial('id').primaryKey(),
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id),
    anio: integer('anio').notNull(),
    impulsosRestantes: integer('impulsos_restantes').notNull().default(5),
  },
  (t) => [uniqueIndex('seasons_game_year_uq').on(t.gameId, t.anio)],
);

// A matchday belongs to exactly one competition context: a league division or
// a cup (kept relational rather than polymorphic via two nullable FKs).
export const matchdays = pgTable(
  'matchdays',
  {
    id: serial('id').primaryKey(),
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id),
    seasonId: integer('season_id')
      .notNull()
      .references(() => seasons.id),
    numero: integer('numero').notNull(),
    divisionId: integer('division_id').references(() => divisions.id),
    cupId: integer('cup_id').references(() => cups.id),
  },
  (t) => [
    index('matchdays_season_idx').on(t.seasonId),
    index('matchdays_game_id_idx').on(t.gameId),
    check('matchdays_one_container', sql`(${t.divisionId} IS NULL) <> (${t.cupId} IS NULL)`),
  ],
);

export const matches = pgTable(
  'matches',
  {
    id: serial('id').primaryKey(),
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id),
    seasonId: integer('season_id')
      .notNull()
      .references(() => seasons.id),
    matchdayId: integer('matchday_id')
      .notNull()
      .references(() => matchdays.id),
    homeTeamId: integer('home_team_id')
      .notNull()
      .references(() => teams.id),
    awayTeamId: integer('away_team_id')
      .notNull()
      .references(() => teams.id),
    homeGoals: integer('home_goals'),
    awayGoals: integer('away_goals'),
    played: boolean('played').notNull().default(false),
    divisionId: integer('division_id').references(() => divisions.id),
    cupId: integer('cup_id').references(() => cups.id),
    cards: jsonb('cards'), // lightweight; refined in Phase 5 (match realism)
  },
  (t) => [
    index('matches_season_idx').on(t.seasonId),
    index('matches_matchday_idx').on(t.matchdayId),
    index('matches_game_id_idx').on(t.gameId),
    check('matches_one_container', sql`(${t.divisionId} IS NULL) <> (${t.cupId} IS NULL)`),
  ],
);

/* ------------------------------------------ commissioner levers (§4, §3) */

export const negotiations = pgTable(
  'negotiations',
  {
    id: serial('id').primaryKey(),
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id),
    federationId: integer('federation_id')
      .notNull()
      .references(() => federations.id),
    targetTeamId: integer('target_team_id')
      .notNull()
      .references(() => teams.id),
    estado: negotiationState('estado').notNull().default('tier_check'),
    anioInicio: integer('anio_inicio').notNull(),
    anioEfectivo: integer('anio_efectivo'), // set on acceptance, +2 years (§4.2)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('negotiations_game_idx').on(t.gameId)],
);

export const negotiationRequirements = pgTable(
  'negotiation_requirements',
  {
    id: serial('id').primaryKey(),
    negotiationId: integer('negotiation_id')
      .notNull()
      .references(() => negotiations.id),
    tipo: negotiationRequirementType('tipo').notNull(),
    valor: text('valor').notNull(),
    cumplido: boolean('cumplido').notNull().default(false),
  },
  (t) => [index('neg_req_negotiation_idx').on(t.negotiationId)],
);

export const norms = pgTable(
  'norms',
  {
    id: serial('id').primaryKey(),
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id),
    federationId: integer('federation_id')
      .notNull()
      .references(() => federations.id),
    tipo: normType('tipo').notNull(),
    valor: text('valor').notNull(),
  },
  (t) => [index('norms_game_id_idx').on(t.gameId)],
);

export const sanctions = pgTable(
  'sanctions',
  {
    id: serial('id').primaryKey(),
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),
    normId: integer('norm_id').references(() => norms.id),
    seasonId: integer('season_id').references(() => seasons.id),
    motivo: text('motivo').notNull(),
    castigo: text('castigo').notNull(),
  },
  (t) => [index('sanctions_game_id_idx').on(t.gameId)],
);

// Impulse hangs off Season (annual counter) and points to a concrete match (§4.6).
export const impulses = pgTable(
  'impulses',
  {
    id: serial('id').primaryKey(),
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id),
    seasonId: integer('season_id')
      .notNull()
      .references(() => seasons.id),
    matchId: integer('match_id')
      .notNull()
      .references(() => matches.id),
    beneficiaryTeamId: integer('beneficiary_team_id')
      .notNull()
      .references(() => teams.id),
    efecto: text('efecto').notNull(),
  },
  (t) => [index('impulses_game_id_idx').on(t.gameId)],
);

export const commercialContracts = pgTable(
  'commercial_contracts',
  {
    id: serial('id').primaryKey(),
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id),
    federationId: integer('federation_id')
      .notNull()
      .references(() => federations.id),
    tipo: commercialContractType('tipo').notNull(),
    valorAnual: bigint('valor_anual', { mode: 'number' }).notNull(),
    anioInicio: integer('anio_inicio').notNull(),
    anioFin: integer('anio_fin'),
  },
  (t) => [index('commercial_contracts_game_idx').on(t.gameId)],
);

/* ------------------------------------------- append-only history (§6) */

// Acta de temporada: per competition & season — champion + final table.
export const seasonRecords = pgTable(
  'season_records',
  {
    id: serial('id').primaryKey(),
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id),
    anio: integer('anio').notNull(),
    divisionId: integer('division_id').references(() => divisions.id),
    cupId: integer('cup_id').references(() => cups.id),
    championTeamId: integer('champion_team_id')
      .notNull()
      .references(() => teams.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('season_records_game_year_idx').on(t.gameId, t.anio)],
);

export const seasonRecordPositions = pgTable(
  'season_record_positions',
  {
    id: serial('id').primaryKey(),
    seasonRecordId: integer('season_record_id')
      .notNull()
      .references(() => seasonRecords.id),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),
    posicion: integer('posicion').notNull(),
    puntos: integer('puntos').notNull(),
    ganados: integer('ganados').notNull(),
    empatados: integer('empatados').notNull(),
    perdidos: integer('perdidos').notNull(),
    golesFavor: integer('goles_favor').notNull(),
    golesContra: integer('goles_contra').notNull(),
    ascenso: boolean('ascenso').notNull().default(false),
    descenso: boolean('descenso').notNull().default(false),
  },
  (t) => [index('srp_record_idx').on(t.seasonRecordId)],
);

// Trayectoria: one row per team per season — division + final position. This is
// what lets the UI read "this team has been climbing season after season".
export const trajectories = pgTable(
  'trajectories',
  {
    id: serial('id').primaryKey(),
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),
    anio: integer('anio').notNull(),
    divisionOrden: integer('division_orden'),
    puestoFinal: integer('puesto_final').notNull(),
  },
  (t) => [uniqueIndex('trajectories_game_team_year_uq').on(t.gameId, t.teamId, t.anio)],
);

export const awards = pgTable(
  'awards',
  {
    id: serial('id').primaryKey(),
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id),
    anio: integer('anio').notNull(),
    tipo: awardType('tipo').notNull(),
    playerId: integer('player_id')
      .notNull()
      .references(() => players.id),
    teamId: integer('team_id').references(() => teams.id),
    valor: integer('valor').notNull(),
  },
  (t) => [index('awards_game_year_idx').on(t.gameId, t.anio)],
);

/* ------------------------------- derived views: NOT stored (§6) */

// Palmarés = every season_record where a team is champion. Single source of
// truth; titles are counted, never written to a table.
export const vwPalmares = pgView('vw_palmares', {
  gameId: integer('game_id').notNull(),
  teamId: integer('team_id').notNull(),
  titles: integer('titles').notNull(),
}).as(
  sql`SELECT sr.game_id, sr.champion_team_id AS team_id, COUNT(*)::int AS titles
      FROM season_records sr
      GROUP BY sr.game_id, sr.champion_team_id`,
);

// Historical scoring ranking, derived from the top-scorer awards.
export const vwRankingGoleadores = pgView('vw_ranking_goleadores', {
  gameId: integer('game_id').notNull(),
  playerId: integer('player_id').notNull(),
  seasonsWon: integer('seasons_won').notNull(),
  totalGoles: integer('total_goles').notNull(),
}).as(
  sql`SELECT a.game_id,
             a.player_id,
             COUNT(*)::int AS seasons_won,
             SUM(a.valor)::int AS total_goles
      FROM awards a
      WHERE a.tipo = 'max_goleador'
      GROUP BY a.game_id, a.player_id`,
);
