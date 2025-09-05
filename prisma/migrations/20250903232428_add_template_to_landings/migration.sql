-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_landings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "template" TEXT NOT NULL DEFAULT 'MODELO_1',
    "title" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "free_shipping" BOOLEAN NOT NULL,
    "image_url" TEXT,
    "shipping_price" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ATIVA',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME
);
INSERT INTO "new_landings" ("brand", "created_at", "description", "free_shipping", "id", "image_url", "price", "shipping_price", "slug", "status", "title", "updatedAt") SELECT "brand", "created_at", "description", "free_shipping", "id", "image_url", "price", "shipping_price", "slug", "status", "title", "updatedAt" FROM "landings";
DROP TABLE "landings";
ALTER TABLE "new_landings" RENAME TO "landings";
CREATE UNIQUE INDEX "landings_slug_key" ON "landings"("slug");
CREATE INDEX "landings_slug_idx" ON "landings"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
