-- Migration 181: Deactivate crawlers with upstream issues
-- These sources have site-side problems that prevent crawling.
-- Re-enable when the issues are resolved.

BEGIN;

UPDATE sources
SET is_active = false
WHERE slug IN (
  'concrete-jungle',         -- Uses Airtable embed, needs API integration
  'lifeline-animal-project', -- reCAPTCHA bot protection blocks all requests
  'chattahoochee-riverkeeper' -- Tribe Events API returning 500 errors
);

COMMIT;
