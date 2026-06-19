ALTER TABLE "cups" ADD COLUMN "engine_cup_id" integer;--> statement-breakpoint
CREATE INDEX "cups_engine_idx" ON "cups" USING btree ("game_id","engine_cup_id");