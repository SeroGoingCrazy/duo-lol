CREATE TABLE "app"."riot_bans" (
	"puuid" text PRIMARY KEY NOT NULL,
	"riot_id_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "riot_bans_riot_id_idx" ON "app"."riot_bans" USING btree ("riot_id_key");