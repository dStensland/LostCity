-- Migration: Add health diagnostic columns to sources table
-- These columns help track source issues and seasonal availability

-- Add health_tags column for diagnostic tags like 'no-events', 'instagram-only', etc.
ALTER TABLE sources ADD COLUMN IF NOT EXISTS health_tags TEXT[] DEFAULT '{}';

-- Add active_months column for seasonal sources (1-12 for Jan-Dec)
ALTER TABLE sources ADD COLUMN IF NOT EXISTS active_months INT[] DEFAULT NULL;

-- Index for efficient filtering by health tags
CREATE INDEX IF NOT EXISTS idx_sources_health_tags ON sources USING GIN(health_tags);

-- Add comments for documentation
COMMENT ON COLUMN sources.health_tags IS 'Diagnostic tags: no-events, instagram-only, facebook-events, seasonal, timeout, dns-error, ssl-error, parse-error';
COMMENT ON COLUMN sources.active_months IS 'Months when source is active (1-12 for Jan-Dec). NULL means year-round.';
