CREATE SCHEMA "app";
--> statement-breakpoint
CREATE TABLE "app"."auth_accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "auth_accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "app"."auth_sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."member_prefs" (
	"member_id" text PRIMARY KEY NOT NULL,
	"positions" text[] DEFAULT '{}' NOT NULL,
	"recommend_opt_in" boolean DEFAULT false NOT NULL,
	"show_discord" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."members" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"email_verified" timestamp,
	"image" text,
	"puuid" text,
	"riot_id" text,
	"verified_at" timestamp,
	"last_active_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "members_email_unique" UNIQUE("email"),
	CONSTRAINT "members_puuid_unique" UNIQUE("puuid")
);
--> statement-breakpoint
CREATE TABLE "app"."verification_challenges" (
	"member_id" text PRIMARY KEY NOT NULL,
	"puuid" text NOT NULL,
	"riot_id" text NOT NULL,
	"icon_id" integer NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_members_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_members_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."member_prefs" ADD CONSTRAINT "member_prefs_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "app"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."verification_challenges" ADD CONSTRAINT "verification_challenges_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "app"."members"("id") ON DELETE cascade ON UPDATE no action;