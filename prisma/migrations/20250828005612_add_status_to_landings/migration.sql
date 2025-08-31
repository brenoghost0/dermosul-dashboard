-- AlterTable
ALTER TABLE "customers" ADD COLUMN "gender" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_addresses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customer_id" TEXT NOT NULL,
    "cep" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "complement" TEXT,
    "district" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "addresses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_addresses" ("cep", "city", "complement", "created_at", "customer_id", "district", "id", "number", "state", "street") SELECT "cep", "city", "complement", "created_at", "customer_id", "district", "id", "number", "state", "street" FROM "addresses";
DROP TABLE "addresses";
ALTER TABLE "new_addresses" RENAME TO "addresses";
CREATE TABLE "new_landings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
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
INSERT INTO "new_landings" ("brand", "created_at", "description", "free_shipping", "id", "image_url", "price", "shipping_price", "slug", "title", "updatedAt") SELECT "brand", "created_at", "description", "free_shipping", "id", "image_url", "price", "shipping_price", "slug", "title", "updatedAt" FROM "landings";
DROP TABLE "landings";
ALTER TABLE "new_landings" RENAME TO "landings";
CREATE UNIQUE INDEX "landings_slug_key" ON "landings"("slug");
CREATE INDEX "landings_slug_idx" ON "landings"("slug");
CREATE TABLE "new_order_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unit_price" INTEGER NOT NULL,
    CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_order_items" ("id", "name", "order_id", "qty", "sku", "unit_price") SELECT "id", "name", "order_id", "qty", "sku", "unit_price" FROM "order_items";
DROP TABLE "order_items";
ALTER TABLE "new_order_items" RENAME TO "order_items";
CREATE TABLE "new_payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_id" TEXT NOT NULL,
    "payment_method" TEXT NOT NULL,
    "paid_amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_payments" ("created_at", "id", "order_id", "paid_amount", "payment_method", "status") SELECT "created_at", "id", "order_id", "paid_amount", "payment_method", "status" FROM "payments";
DROP TABLE "payments";
ALTER TABLE "new_payments" RENAME TO "payments";
CREATE INDEX "payments_payment_method_idx" ON "payments"("payment_method");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
