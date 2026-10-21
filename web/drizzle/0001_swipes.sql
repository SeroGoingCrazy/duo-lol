CREATE TABLE "app"."blocks" (
	"from_member" text NOT NULL,
	"to_member" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blocks_from_member_to_member_pk" PRIMARY KEY("from_member","to_member")
);
--> statement-breakpoint
CREATE TABLE "app"."mutual_likes" (
	"member_a" text NOT NULL,
	"member_b" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"cancelled_at" timestamp,
	CONSTRAINT "mutual_likes_member_a_member_b_pk" PRIMARY KEY("member_a","member_b")
);
--> statement-breakpoint
CREATE TABLE "app"."reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_member" text NOT NULL,
	"to_member" text NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"handled_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "app"."swipes" (
	"from_member" text NOT NULL,
	"to_member" text NOT NULL,
	"action" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "swipes_from_member_to_member_pk" PRIMARY KEY("from_member","to_member")
);
--> statement-breakpoint
ALTER TABLE "app"."member_prefs" ADD COLUMN "self_report" jsonb;--> statement-breakpoint
ALTER TABLE "app"."members" ADD COLUMN "suspended_at" timestamp;--> statement-breakpoint
ALTER TABLE "app"."blocks" ADD CONSTRAINT "blocks_from_member_members_id_fk" FOREIGN KEY ("from_member") REFERENCES "app"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."blocks" ADD CONSTRAINT "blocks_to_member_members_id_fk" FOREIGN KEY ("to_member") REFERENCES "app"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."mutual_likes" ADD CONSTRAINT "mutual_likes_member_a_members_id_fk" FOREIGN KEY ("member_a") REFERENCES "app"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."mutual_likes" ADD CONSTRAINT "mutual_likes_member_b_members_id_fk" FOREIGN KEY ("member_b") REFERENCES "app"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."reports" ADD CONSTRAINT "reports_from_member_members_id_fk" FOREIGN KEY ("from_member") REFERENCES "app"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."reports" ADD CONSTRAINT "reports_to_member_members_id_fk" FOREIGN KEY ("to_member") REFERENCES "app"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."swipes" ADD CONSTRAINT "swipes_from_member_members_id_fk" FOREIGN KEY ("from_member") REFERENCES "app"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."swipes" ADD CONSTRAINT "swipes_to_member_members_id_fk" FOREIGN KEY ("to_member") REFERENCES "app"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reports_to_idx" ON "app"."reports" USING btree ("to_member");--> statement-breakpoint
CREATE INDEX "swipes_to_idx" ON "app"."swipes" USING btree ("to_member","action");