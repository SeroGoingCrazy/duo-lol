ALTER TABLE "app"."member_prefs" ADD COLUMN "bio" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."member_prefs" ADD COLUMN "languages" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."member_prefs" ADD COLUMN "voice" text;--> statement-breakpoint
ALTER TABLE "app"."member_prefs" ADD COLUMN "play_times" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."member_prefs" ADD COLUMN "looking_until" timestamp;--> statement-breakpoint
ALTER TABLE "app"."member_prefs" ADD COLUMN "deck_filter" jsonb;