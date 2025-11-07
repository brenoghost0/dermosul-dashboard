ALTER TABLE "store_settings"
ADD COLUMN IF NOT EXISTS "defaultTitle" TEXT,
ADD COLUMN IF NOT EXISTS "defaultDescription" TEXT,
ADD COLUMN IF NOT EXISTS "lucky_wheel_settings" JSONB;

UPDATE "store_settings"
SET "defaultTitle" = COALESCE("defaultTitle", "default_title"),
    "defaultDescription" = COALESCE("defaultDescription", "default_description")
WHERE "default_title" IS NOT NULL OR "default_description" IS NOT NULL;

ALTER TABLE "store_settings"
DROP COLUMN IF EXISTS "default_title",
DROP COLUMN IF EXISTS "default_description";
