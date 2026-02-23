-- Add facebook_url column for social bio enrichment pipeline
ALTER TABLE venues ADD COLUMN IF NOT EXISTS facebook_url TEXT;
