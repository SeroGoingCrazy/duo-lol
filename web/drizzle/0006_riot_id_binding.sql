DROP TABLE "app"."verification_challenges" CASCADE;--> statement-breakpoint
ALTER TABLE "app"."members" ADD COLUMN "bound_at" timestamp;--> statement-breakpoint
ALTER TABLE "app"."members" ADD COLUMN "avatar_icon_id" integer;--> statement-breakpoint
-- 会员 bound under 头像验证 keep their binding and stay 已验证 (ADR-0011)
UPDATE "app"."members" SET "bound_at" = "verified_at" WHERE "verified_at" IS NOT NULL;