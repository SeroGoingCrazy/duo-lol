ALTER TABLE "app"."member_prefs" ADD COLUMN "notify_discord" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."members" ADD COLUMN "seen_at" timestamp;