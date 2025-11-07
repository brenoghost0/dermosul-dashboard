-- Adjust schema to match current Prisma model using PostgreSQL syntax.

-- Customers: optional gender field
ALTER TABLE "customers"
ADD COLUMN IF NOT EXISTS "gender" TEXT;

-- Landings: status + updatedAt columns and supporting indexes
ALTER TABLE "landings"
ADD COLUMN IF NOT EXISTS "status" TEXT;

UPDATE "landings"
SET "status" = COALESCE("status", 'ATIVA');

ALTER TABLE "landings"
ALTER COLUMN "status" SET DEFAULT 'ATIVA',
ALTER COLUMN "status" SET NOT NULL;

ALTER TABLE "landings"
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "landings_slug_key" ON "landings"("slug");
CREATE INDEX IF NOT EXISTS "landings_slug_idx" ON "landings"("slug");

-- Payments: ensure default timestamp and keep foreign key behaviour
ALTER TABLE "payments"
ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- Addresses: align FK behaviour with Prisma schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'addresses_customer_id_fkey') THEN
    ALTER TABLE "addresses" DROP CONSTRAINT "addresses_customer_id_fkey";
  END IF;
END $$;

ALTER TABLE "addresses"
ADD CONSTRAINT "addresses_customer_id_fkey"
FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Order items + payments foreign keys (re-assert to guarantee cascade rules)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'order_items_order_id_fkey') THEN
    ALTER TABLE "order_items" DROP CONSTRAINT "order_items_order_id_fkey";
  END IF;
END $$;

ALTER TABLE "order_items"
ADD CONSTRAINT "order_items_order_id_fkey"
FOREIGN KEY ("order_id") REFERENCES "orders"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'payments_order_id_fkey') THEN
    ALTER TABLE "payments" DROP CONSTRAINT "payments_order_id_fkey";
  END IF;
END $$;

ALTER TABLE "payments"
ADD CONSTRAINT "payments_order_id_fkey"
FOREIGN KEY ("order_id") REFERENCES "orders"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
