-- Cast monetary fields to BIGINT for higher precision (PostgreSQL)

ALTER TABLE "landings"
ALTER COLUMN "price" TYPE BIGINT USING "price"::BIGINT,
ALTER COLUMN "shipping_price" TYPE BIGINT USING "shipping_price"::BIGINT;

ALTER TABLE "order_items"
ALTER COLUMN "unit_price" TYPE BIGINT USING "unit_price"::BIGINT;

ALTER TABLE "orders"
ALTER COLUMN "total_amount" TYPE BIGINT USING "total_amount"::BIGINT;

ALTER TABLE "payments"
ALTER COLUMN "paid_amount" TYPE BIGINT USING "paid_amount"::BIGINT;

-- Ensure supporting indexes exist
CREATE UNIQUE INDEX IF NOT EXISTS "orders_external_reference_key" ON "orders"("external_reference");
CREATE INDEX IF NOT EXISTS "orders_created_at_idx" ON "orders"("created_at");
CREATE INDEX IF NOT EXISTS "orders_status_idx" ON "orders"("status");
CREATE INDEX IF NOT EXISTS "payments_payment_method_idx" ON "payments"("payment_method");
