ALTER TABLE "awards" DROP CONSTRAINT "awards_game_id_games_id_fk";
--> statement-breakpoint
ALTER TABLE "commercial_contracts" DROP CONSTRAINT "commercial_contracts_game_id_games_id_fk";
--> statement-breakpoint
ALTER TABLE "cups" DROP CONSTRAINT "cups_game_id_games_id_fk";
--> statement-breakpoint
ALTER TABLE "divisions" DROP CONSTRAINT "divisions_game_id_games_id_fk";
--> statement-breakpoint
ALTER TABLE "federations" DROP CONSTRAINT "federations_game_id_games_id_fk";
--> statement-breakpoint
ALTER TABLE "game_engine_states" DROP CONSTRAINT "game_engine_states_game_id_games_id_fk";
--> statement-breakpoint
ALTER TABLE "impulses" DROP CONSTRAINT "impulses_game_id_games_id_fk";
--> statement-breakpoint
ALTER TABLE "leagues" DROP CONSTRAINT "leagues_game_id_games_id_fk";
--> statement-breakpoint
ALTER TABLE "matchdays" DROP CONSTRAINT "matchdays_game_id_games_id_fk";
--> statement-breakpoint
ALTER TABLE "matches" DROP CONSTRAINT "matches_game_id_games_id_fk";
--> statement-breakpoint
ALTER TABLE "negotiations" DROP CONSTRAINT "negotiations_game_id_games_id_fk";
--> statement-breakpoint
ALTER TABLE "norms" DROP CONSTRAINT "norms_game_id_games_id_fk";
--> statement-breakpoint
ALTER TABLE "players" DROP CONSTRAINT "players_game_id_games_id_fk";
--> statement-breakpoint
ALTER TABLE "sanctions" DROP CONSTRAINT "sanctions_game_id_games_id_fk";
--> statement-breakpoint
ALTER TABLE "season_records" DROP CONSTRAINT "season_records_game_id_games_id_fk";
--> statement-breakpoint
ALTER TABLE "seasons" DROP CONSTRAINT "seasons_game_id_games_id_fk";
--> statement-breakpoint
ALTER TABLE "teams" DROP CONSTRAINT "teams_game_id_games_id_fk";
--> statement-breakpoint
ALTER TABLE "trajectories" DROP CONSTRAINT "trajectories_game_id_games_id_fk";
--> statement-breakpoint
ALTER TABLE "awards" ADD CONSTRAINT "awards_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_contracts" ADD CONSTRAINT "commercial_contracts_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cups" ADD CONSTRAINT "cups_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "divisions" ADD CONSTRAINT "divisions_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federations" ADD CONSTRAINT "federations_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_engine_states" ADD CONSTRAINT "game_engine_states_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impulses" ADD CONSTRAINT "impulses_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchdays" ADD CONSTRAINT "matchdays_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "norms" ADD CONSTRAINT "norms_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanctions" ADD CONSTRAINT "sanctions_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_records" ADD CONSTRAINT "season_records_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trajectories" ADD CONSTRAINT "trajectories_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;