CREATE TABLE "app"."riot_bans" (
	"puuid" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
