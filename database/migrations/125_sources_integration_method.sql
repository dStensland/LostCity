ALTER TABLE sources
ADD COLUMN IF NOT EXISTS integration_method TEXT;
