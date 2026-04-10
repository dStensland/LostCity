-- Re-enable 7 Stages after crawler fix.
-- Crawler now: validates dates aren't past, searches structured elements
-- instead of full body text, extracts real times instead of hardcoding 20:00.

UPDATE sources SET is_active = true
WHERE slug = '7-stages';
