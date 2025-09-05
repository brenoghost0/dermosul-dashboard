/*
  Warnings:

  - You are about to alter the column `price` on the `landings` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `shipping_price` on the `landings` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `unit_price` on the `order_items` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `total_amount` on the `orders` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `paid_amount` on the `payments` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.

*/
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
    "price" BIGINT NOT NULL,
    "free_shipping" BOOLEAN NOT NULL,
    "image_url" TEXT,
    "shipping_price" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ATIVA',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME
);
INSERT INTO "new_landings" ("brand", "created_at", "description", "free_shipping", "id", "image_url", "price", "shipping_price", "slug", "status", "template", "title", "updatedAt") SELECT "brand", "created_at", "description", "free_shipping", "id", "image_url", "price", "shipping_price", "slug", "status", "template", "title", "updatedAt" FROM "landings";
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
    "unit_price" BIGINT NOT NULL,
    CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_order_items" ("id", "name", "order_id", "qty", "sku", "unit_price") SELECT "id", "name", "order_id", "qty", "sku", "unit_price" FROM "order_items";
DROP TABLE "order_items";
ALTER TABLE "new_order_items" RENAME TO "order_items";
CREATE TABLE "new_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "external_reference" TEXT,
    "customer_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "total_amount" BIGINT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_orders" ("category", "created_at", "customer_id", "external_reference", "id", "status", "total_amount") SELECT "category", "created_at", "customer_id", "external_reference", "id", "status", "total_amount" FROM "orders";
DROP TABLE "orders";
ALTER TABLE "new_orders" RENAME TO "orders";
CREATE UNIQUE INDEX "orders_external_reference_key" ON "orders"("external_reference");
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at");
CREATE INDEX "orders_status_idx" ON "orders"("status");
CREATE TABLE "new_payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_id" TEXT NOT NULL,
    "payment_method" TEXT NOT NULL,
    "paid_amount" BIGINT NOT NULL,
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
