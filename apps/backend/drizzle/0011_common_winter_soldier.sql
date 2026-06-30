CREATE INDEX "awards_player_idx" ON "awards" USING btree ("player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "norms_game_tipo_uq" ON "norms" USING btree ("game_id","tipo");--> statement-breakpoint
CREATE INDEX "players_game_idx" ON "players" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "sanctions_team_idx" ON "sanctions" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "trajectories_game_idx" ON "trajectories" USING btree ("game_id");