-- Merge 404 Day (404day.com) into 404 Weekend (404weekend.com).
-- The unified crawler four04_weekend.py now crawls both sites.
-- Deactivate the 404-day source and reassign its events to 404-weekend.

-- 1. Ensure both sources have portal attribution (was NULL)
UPDATE sources
SET owner_portal_id = (SELECT id FROM portals WHERE slug = 'atlanta')
WHERE slug IN ('404-day', '404-weekend')
  AND owner_portal_id IS NULL;

-- 2. Reassign existing 404-day events to 404-weekend source
UPDATE events
SET source_id = (SELECT id FROM sources WHERE slug = '404-weekend')
WHERE source_id = (SELECT id FROM sources WHERE slug = '404-day');

-- 3. Deactivate the 404-day source (crawler file remains as reference)
UPDATE sources
SET is_active = false
WHERE slug = '404-day';
