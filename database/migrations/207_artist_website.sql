-- Add website column to artists table for official band/artist sites
ALTER TABLE artists ADD COLUMN IF NOT EXISTS website TEXT;
