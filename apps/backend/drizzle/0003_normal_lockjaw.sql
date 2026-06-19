ALTER TABLE "federations" ADD COLUMN "engine_federation_id" integer;--> statement-breakpoint
CREATE INDEX "federations_engine_idx" ON "federations" USING btree ("game_id","engine_federation_id");