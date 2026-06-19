CREATE TYPE "public"."award_type" AS ENUM('max_goleador', 'max_asistente', 'mejor_portero');--> statement-breakpoint
CREATE TYPE "public"."commercial_contract_type" AS ENUM('patrocinio', 'publicidad', 'derechos_tv', 'derechos_imagen');--> statement-breakpoint
CREATE TYPE "public"."competition_type" AS ENUM('liga', 'copa', 'liga_juvenil', 'torneo_verano', 'liga_nivelacion');--> statement-breakpoint
CREATE TYPE "public"."negotiation_state" AS ENUM('tier_check', 'gathering_requirements', 'offer', 'accepted', 'effective', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."player_position" AS ENUM('POR', 'DEF', 'MED', 'DEL');--> statement-breakpoint
CREATE TABLE "awards" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"anio" integer NOT NULL,
	"tipo" "award_type" NOT NULL,
	"player_id" integer NOT NULL,
	"team_id" integer,
	"valor" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commercial_contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"federation_id" integer NOT NULL,
	"tipo" "commercial_contract_type" NOT NULL,
	"valor_anual" bigint NOT NULL,
	"anio_inicio" integer NOT NULL,
	"anio_fin" integer
);
--> statement-breakpoint
CREATE TABLE "cups" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"federation_id" integer NOT NULL,
	"name" text NOT NULL,
	"tipo" "competition_type" NOT NULL,
	"formato" text
);
--> statement-breakpoint
CREATE TABLE "divisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"league_id" integer NOT NULL,
	"name" text,
	"orden" integer NOT NULL,
	"plazas" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "federations" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"name" text NOT NULL,
	"prestige" integer DEFAULT 0 NOT NULL,
	"is_player" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"seed" bigint NOT NULL,
	"current_year" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "impulses" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"season_id" integer NOT NULL,
	"match_id" integer NOT NULL,
	"beneficiary_team_id" integer NOT NULL,
	"efecto" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leagues" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"federation_id" integer NOT NULL,
	"name" text NOT NULL,
	"format" text
);
--> statement-breakpoint
CREATE TABLE "matchdays" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"season_id" integer NOT NULL,
	"numero" integer NOT NULL,
	"division_id" integer,
	"cup_id" integer
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"season_id" integer NOT NULL,
	"matchday_id" integer NOT NULL,
	"home_team_id" integer NOT NULL,
	"away_team_id" integer NOT NULL,
	"home_goals" integer,
	"away_goals" integer,
	"played" boolean DEFAULT false NOT NULL,
	"division_id" integer,
	"cup_id" integer,
	"cards" jsonb
);
--> statement-breakpoint
CREATE TABLE "negotiation_requirements" (
	"id" serial PRIMARY KEY NOT NULL,
	"negotiation_id" integer NOT NULL,
	"tipo" text NOT NULL,
	"valor" text NOT NULL,
	"cumplido" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "negotiations" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"federation_id" integer NOT NULL,
	"target_team_id" integer NOT NULL,
	"estado" "negotiation_state" DEFAULT 'tier_check' NOT NULL,
	"anio_inicio" integer NOT NULL,
	"anio_efectivo" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "norms" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"federation_id" integer NOT NULL,
	"tipo" text NOT NULL,
	"valor" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"team_id" integer,
	"name" text NOT NULL,
	"posicion" "player_position" NOT NULL,
	"calidad" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sanctions" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"norm_id" integer,
	"season_id" integer,
	"motivo" text NOT NULL,
	"castigo" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "season_record_positions" (
	"id" serial PRIMARY KEY NOT NULL,
	"season_record_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"posicion" integer NOT NULL,
	"puntos" integer NOT NULL,
	"ganados" integer NOT NULL,
	"empatados" integer NOT NULL,
	"perdidos" integer NOT NULL,
	"goles_favor" integer NOT NULL,
	"goles_contra" integer NOT NULL,
	"ascenso" boolean DEFAULT false NOT NULL,
	"descenso" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "season_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"anio" integer NOT NULL,
	"division_id" integer,
	"cup_id" integer,
	"champion_team_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"anio" integer NOT NULL,
	"impulsos_restantes" integer DEFAULT 5 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"name" text NOT NULL,
	"prestige" integer DEFAULT 0 NOT NULL,
	"arraigo" integer DEFAULT 0 NOT NULL,
	"presupuesto" bigint DEFAULT 0 NOT NULL,
	"aficion" integer DEFAULT 0 NOT NULL,
	"estadio_nombre" text,
	"estadio_aforo" integer,
	"strength" integer DEFAULT 50 NOT NULL,
	"academia_rating" smallint DEFAULT 50 NOT NULL,
	"medico_rating" smallint DEFAULT 50 NOT NULL,
	"ojeadores_rating" smallint DEFAULT 50 NOT NULL,
	"cuerpo_tecnico_rating" smallint DEFAULT 50 NOT NULL,
	"federation_id" integer,
	"division_id" integer
);
--> statement-breakpoint
CREATE TABLE "trajectories" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"anio" integer NOT NULL,
	"division_orden" integer,
	"puesto_final" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "awards" ADD CONSTRAINT "awards_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "awards" ADD CONSTRAINT "awards_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "awards" ADD CONSTRAINT "awards_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_contracts" ADD CONSTRAINT "commercial_contracts_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_contracts" ADD CONSTRAINT "commercial_contracts_federation_id_federations_id_fk" FOREIGN KEY ("federation_id") REFERENCES "public"."federations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cups" ADD CONSTRAINT "cups_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cups" ADD CONSTRAINT "cups_federation_id_federations_id_fk" FOREIGN KEY ("federation_id") REFERENCES "public"."federations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "divisions" ADD CONSTRAINT "divisions_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "divisions" ADD CONSTRAINT "divisions_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federations" ADD CONSTRAINT "federations_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impulses" ADD CONSTRAINT "impulses_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impulses" ADD CONSTRAINT "impulses_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impulses" ADD CONSTRAINT "impulses_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impulses" ADD CONSTRAINT "impulses_beneficiary_team_id_teams_id_fk" FOREIGN KEY ("beneficiary_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_federation_id_federations_id_fk" FOREIGN KEY ("federation_id") REFERENCES "public"."federations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchdays" ADD CONSTRAINT "matchdays_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchdays" ADD CONSTRAINT "matchdays_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchdays" ADD CONSTRAINT "matchdays_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchdays" ADD CONSTRAINT "matchdays_cup_id_cups_id_fk" FOREIGN KEY ("cup_id") REFERENCES "public"."cups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_matchday_id_matchdays_id_fk" FOREIGN KEY ("matchday_id") REFERENCES "public"."matchdays"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_home_team_id_teams_id_fk" FOREIGN KEY ("home_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_away_team_id_teams_id_fk" FOREIGN KEY ("away_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_cup_id_cups_id_fk" FOREIGN KEY ("cup_id") REFERENCES "public"."cups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiation_requirements" ADD CONSTRAINT "negotiation_requirements_negotiation_id_negotiations_id_fk" FOREIGN KEY ("negotiation_id") REFERENCES "public"."negotiations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_federation_id_federations_id_fk" FOREIGN KEY ("federation_id") REFERENCES "public"."federations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_target_team_id_teams_id_fk" FOREIGN KEY ("target_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "norms" ADD CONSTRAINT "norms_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "norms" ADD CONSTRAINT "norms_federation_id_federations_id_fk" FOREIGN KEY ("federation_id") REFERENCES "public"."federations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanctions" ADD CONSTRAINT "sanctions_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanctions" ADD CONSTRAINT "sanctions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanctions" ADD CONSTRAINT "sanctions_norm_id_norms_id_fk" FOREIGN KEY ("norm_id") REFERENCES "public"."norms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanctions" ADD CONSTRAINT "sanctions_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_record_positions" ADD CONSTRAINT "season_record_positions_season_record_id_season_records_id_fk" FOREIGN KEY ("season_record_id") REFERENCES "public"."season_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_record_positions" ADD CONSTRAINT "season_record_positions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_records" ADD CONSTRAINT "season_records_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_records" ADD CONSTRAINT "season_records_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_records" ADD CONSTRAINT "season_records_cup_id_cups_id_fk" FOREIGN KEY ("cup_id") REFERENCES "public"."cups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_records" ADD CONSTRAINT "season_records_champion_team_id_teams_id_fk" FOREIGN KEY ("champion_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_federation_id_federations_id_fk" FOREIGN KEY ("federation_id") REFERENCES "public"."federations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trajectories" ADD CONSTRAINT "trajectories_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trajectories" ADD CONSTRAINT "trajectories_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "awards_game_year_idx" ON "awards" USING btree ("game_id","anio");--> statement-breakpoint
CREATE INDEX "commercial_contracts_game_idx" ON "commercial_contracts" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "cups_game_idx" ON "cups" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "divisions_league_idx" ON "divisions" USING btree ("league_id");--> statement-breakpoint
CREATE INDEX "federations_game_idx" ON "federations" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "leagues_game_idx" ON "leagues" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "matchdays_season_idx" ON "matchdays" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX "matches_season_idx" ON "matches" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX "matches_matchday_idx" ON "matches" USING btree ("matchday_id");--> statement-breakpoint
CREATE INDEX "negotiations_game_idx" ON "negotiations" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "players_team_idx" ON "players" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "srp_record_idx" ON "season_record_positions" USING btree ("season_record_id");--> statement-breakpoint
CREATE INDEX "season_records_game_year_idx" ON "season_records" USING btree ("game_id","anio");--> statement-breakpoint
CREATE UNIQUE INDEX "seasons_game_year_uq" ON "seasons" USING btree ("game_id","anio");--> statement-breakpoint
CREATE INDEX "teams_game_idx" ON "teams" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "teams_federation_idx" ON "teams" USING btree ("federation_id");--> statement-breakpoint
CREATE INDEX "teams_division_idx" ON "teams" USING btree ("division_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trajectories_game_team_year_uq" ON "trajectories" USING btree ("game_id","team_id","anio");--> statement-breakpoint
CREATE VIEW "public"."vw_palmares" AS (SELECT sr.game_id, sr.champion_team_id AS team_id, COUNT(*)::int AS titles
      FROM season_records sr
      GROUP BY sr.game_id, sr.champion_team_id);--> statement-breakpoint
CREATE VIEW "public"."vw_ranking_goleadores" AS (SELECT a.game_id,
             a.player_id,
             COUNT(*)::int AS seasons_won,
             SUM(a.valor)::int AS total_goles
      FROM awards a
      WHERE a.tipo = 'max_goleador'
      GROUP BY a.game_id, a.player_id);