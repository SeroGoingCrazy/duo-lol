CREATE TABLE "app"."funnel_events" (
	"session" text NOT NULL,
	"event" text NOT NULL,
	"mode" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "funnel_events_session_event_mode_pk" PRIMARY KEY("session","event","mode")
);
--> statement-breakpoint
CREATE INDEX "funnel_events_created_idx" ON "app"."funnel_events" USING btree ("created_at");