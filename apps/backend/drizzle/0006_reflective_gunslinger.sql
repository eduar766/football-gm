ALTER TABLE "players" ADD COLUMN "nationality" text DEFAULT 'local' NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "cantera" boolean DEFAULT false NOT NULL;