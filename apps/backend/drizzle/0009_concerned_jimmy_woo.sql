CREATE TYPE "public"."cup_format" AS ENUM('eliminatoria', 'eliminatoria_ida_vuelta', 'liga');--> statement-breakpoint
CREATE TYPE "public"."league_format" AS ENUM('ida', 'ida_vuelta');--> statement-breakpoint
CREATE TYPE "public"."negotiation_requirement_type" AS ENUM('prestigio', 'estadio', 'reparto');--> statement-breakpoint
CREATE TYPE "public"."norm_type" AS ENUM('tope_plantilla', 'minimo_competitivo', 'tope_salarial', 'tope_extrangeros', 'minimo_cantera', 'tope_edad_media');--> statement-breakpoint
DROP INDEX "cups_engine_idx";--> statement-breakpoint
DROP INDEX "federations_engine_idx";--> statement-breakpoint
DROP INDEX "players_engine_idx";--> statement-breakpoint
DROP INDEX "teams_engine_idx";--> statement-breakpoint
UPDATE "cups" SET "formato" = 'eliminatoria' WHERE "formato" = 'single_elimination';--> statement-breakpoint
ALTER TABLE "cups" ALTER COLUMN "formato" SET DATA TYPE cup_format USING formato::cup_format;--> statement-breakpoint
ALTER TABLE "leagues" ALTER COLUMN "format" SET DATA TYPE league_format USING format::league_format;--> statement-breakpoint
ALTER TABLE "negotiation_requirements" ALTER COLUMN "tipo" SET DATA TYPE negotiation_requirement_type USING tipo::negotiation_requirement_type;--> statement-breakpoint
ALTER TABLE "norms" ALTER COLUMN "tipo" SET DATA TYPE norm_type USING tipo::norm_type;--> statement-breakpoint
CREATE UNIQUE INDEX "cups_engine_uq" ON "cups" USING btree ("game_id","engine_cup_id");--> statement-breakpoint
CREATE UNIQUE INDEX "federations_engine_uq" ON "federations" USING btree ("game_id","engine_federation_id");--> statement-breakpoint
CREATE INDEX "impulses_game_id_idx" ON "impulses" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "matchdays_game_id_idx" ON "matchdays" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "matches_game_id_idx" ON "matches" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "neg_req_negotiation_idx" ON "negotiation_requirements" USING btree ("negotiation_id");--> statement-breakpoint
CREATE INDEX "norms_game_id_idx" ON "norms" USING btree ("game_id");--> statement-breakpoint
CREATE UNIQUE INDEX "players_engine_uq" ON "players" USING btree ("game_id","engine_player_id");--> statement-breakpoint
CREATE INDEX "sanctions_game_id_idx" ON "sanctions" USING btree ("game_id");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_engine_uq" ON "teams" USING btree ("game_id","engine_team_id");--> statement-breakpoint
ALTER TABLE "matchdays" ADD CONSTRAINT "matchdays_one_container" CHECK (("matchdays"."division_id" IS NULL) <> ("matchdays"."cup_id" IS NULL));--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_one_container" CHECK (("matches"."division_id" IS NULL) <> ("matches"."cup_id" IS NULL));