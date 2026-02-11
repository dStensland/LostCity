-- Migration 181: Originally deactivated broken crawlers.
-- All three have been fixed:
--   - concrete-jungle: Now uses Airtable CSV download via Playwright
--   - lifeline-animal-project: Now uses iCal feed (/events/?ical=1)
--   - chattahoochee-riverkeeper: Now uses iCal feed (/events/?ical=1)
-- Keeping all active. No-op migration.

BEGIN;
-- No changes needed — all sources are active and working.
COMMIT;
