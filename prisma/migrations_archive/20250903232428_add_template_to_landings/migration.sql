-- Landings template column (PostgreSQL friendly)

ALTER TABLE "landings"
ADD COLUMN IF NOT EXISTS "template" TEXT;

UPDATE "landings"
SET "template" = COALESCE("template", 'MODELO_1');

ALTER TABLE "landings"
ALTER COLUMN "template" SET DEFAULT 'MODELO_1',
ALTER COLUMN "template" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "landings_slug_key" ON "landings"("slug");
CREATE INDEX IF NOT EXISTS "landings_slug_idx" ON "landings"("slug");
