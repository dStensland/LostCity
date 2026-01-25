-- Migration: Disable sources with persistent 404 errors
-- Date: 2026-01-24
--
-- These sources have been returning 404 errors consistently.
-- Marking them inactive to prevent error spam in crawl logs.

UPDATE sources
SET is_active = false
WHERE slug IN (
    'oglethorpe-university',
    'sports-social',
    'midway-pub'
);

-- Add note explaining why they were disabled
COMMENT ON TABLE sources IS 'Event sources. Some sources disabled 2026-01-24 due to 404 errors: oglethorpe-university, sports-social, midway-pub';
