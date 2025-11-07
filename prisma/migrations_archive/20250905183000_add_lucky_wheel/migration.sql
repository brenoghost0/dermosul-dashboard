-- Add lucky wheel settings column to store settings
ALTER TABLE "store_settings"
ADD COLUMN IF NOT EXISTS "lucky_wheel_settings" JSONB;

-- Create table to log lucky wheel spins
CREATE TABLE IF NOT EXISTS "lucky_wheel_spins" (
    "id" TEXT PRIMARY KEY,
    "customer_id" TEXT,
    "session_id" TEXT,
    "cart_id" TEXT,
    "prize_id" TEXT NOT NULL,
    "prize_label" TEXT NOT NULL,
    "prize_type" TEXT NOT NULL,
    "prize_payload" JSONB,
    "coupon_code" TEXT,
    "free_shipping" BOOLEAN NOT NULL DEFAULT FALSE,
    "free_order" BOOLEAN NOT NULL DEFAULT FALSE,
    "ip_address" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lucky_wheel_spins_customer_id_fkey"
        FOREIGN KEY ("customer_id") REFERENCES "customers" ("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "lucky_wheel_spins_created_at_idx"
    ON "lucky_wheel_spins" ("created_at");

CREATE INDEX IF NOT EXISTS "lucky_wheel_spins_prize_id_created_at_idx"
    ON "lucky_wheel_spins" ("prize_id", "created_at");

CREATE INDEX IF NOT EXISTS "lucky_wheel_spins_session_id_idx"
    ON "lucky_wheel_spins" ("session_id");

CREATE INDEX IF NOT EXISTS "lucky_wheel_spins_cart_id_idx"
    ON "lucky_wheel_spins" ("cart_id");
