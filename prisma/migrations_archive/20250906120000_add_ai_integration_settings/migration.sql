-- Create table for storing encrypted OpenAI credentials
CREATE TABLE IF NOT EXISTS "ai_integration_settings" (
    "id" TEXT PRIMARY KEY,
    "provider" TEXT NOT NULL DEFAULT 'openai',
    "encrypted_api_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Ensure the column used by Prisma's @updatedAt is updated automatically
CREATE OR REPLACE FUNCTION update_ai_integration_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updated_at" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_integration_settings_updated_at_trg ON "ai_integration_settings";

CREATE TRIGGER ai_integration_settings_updated_at_trg
BEFORE UPDATE ON "ai_integration_settings"
FOR EACH ROW
EXECUTE FUNCTION update_ai_integration_settings_updated_at();
