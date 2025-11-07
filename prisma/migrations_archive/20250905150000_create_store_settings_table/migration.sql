-- Create table used by StoreSettings model
CREATE TABLE IF NOT EXISTS "store_settings" (
    "id" TEXT PRIMARY KEY,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "default_title" TEXT,
    "default_description" TEXT,
    "logo_url" TEXT,
    "favicon_url" TEXT,
    "apple_touch_icon_url" TEXT,
    "primary_color" TEXT,
    "secondary_color" TEXT,
    "accent_color" TEXT,
    "meta_image_url" TEXT,
    "typography" JSONB,
    "text_blocks" JSONB,
    "home_layout" JSONB,
    "seo_settings" JSONB,
    "domain_settings" JSONB,
    "integration_settings" JSONB,
    "checkout_settings" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed default row if missing
INSERT INTO "store_settings" ("id", "currency")
SELECT 'store', 'BRL'
WHERE NOT EXISTS (SELECT 1 FROM "store_settings" WHERE "id" = 'store');
