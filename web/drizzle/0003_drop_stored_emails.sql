-- Login now asks Discord for the identify scope only (privacy page): forget emails stored before that.
UPDATE "app"."members" SET "email" = NULL;
