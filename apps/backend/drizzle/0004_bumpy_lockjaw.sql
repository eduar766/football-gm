ALTER TABLE "players" ADD COLUMN "engine_player_id" integer;--> statement-breakpoint
CREATE INDEX "players_engine_idx" ON "players" USING btree ("game_id","engine_player_id");