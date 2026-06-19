ALTER TABLE "teams" ADD COLUMN "engine_team_id" integer;--> statement-breakpoint
CREATE INDEX "teams_engine_idx" ON "teams" USING btree ("game_id","engine_team_id");