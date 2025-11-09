-- Upgrade coupon model with advanced configuration fields
ALTER TABLE "coupons"
  ADD COLUMN "name" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "free_shipping" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "auto_apply" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "stackable" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "usage_limit" INTEGER,
  ADD COLUMN "usage_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "per_customer_limit" INTEGER,
  ADD COLUMN "min_subtotal_cents" INTEGER,
  ADD COLUMN "max_discount_cents" INTEGER,
  ADD COLUMN "new_customer_only" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "target_product_ids" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "target_collection_ids" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "target_category_ids" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "excluded_product_ids" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "metadata" JSONB;

-- Store coupon usage history
CREATE TABLE "coupon_redemptions" (
  "id" TEXT NOT NULL,
  "coupon_id" TEXT NOT NULL,
  "order_id" TEXT,
  "customer_id" TEXT,
  "amount_cents" INTEGER NOT NULL DEFAULT 0,
  "free_shipping" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "coupon_redemptions_coupon_id_idx" ON "coupon_redemptions"("coupon_id");
CREATE INDEX "coupon_redemptions_customer_id_idx" ON "coupon_redemptions"("customer_id");

ALTER TABLE "coupon_redemptions"
  ADD CONSTRAINT "coupon_redemptions_coupon_id_fkey"
    FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "coupon_redemptions"
  ADD CONSTRAINT "coupon_redemptions_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "coupon_redemptions"
  ADD CONSTRAINT "coupon_redemptions_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
