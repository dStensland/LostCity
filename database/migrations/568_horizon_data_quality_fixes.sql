-- Migration: Horizon Data Quality Fixes
--
-- Batch of targeted data quality corrections surfaced during the planning
-- horizon feature buildout. No schema changes — data-only updates.
--
-- Fixes:
--   1. Normalize "Atl" city abbreviation → "Atlanta" in venues
--   2. Doja Cat at State Farm Arena miscategorized as "religious" → "music"
--   3. "unknown" category events with identifiable categories (404 Day, Garden Lights)
--   4. Deactivate premature 2027 Stone Mountain Christmas orphan
--   5. Frolicon importance downgrade: flagship/major → standard
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.

-- 1. Normalize "Atl" city abbreviation to "Atlanta"
UPDATE venues
SET city = 'Atlanta'
WHERE city = 'Atl';

-- 2. Fix Doja Cat at State Farm Arena miscategorized as religious
UPDATE events
SET category_id = 'music'
WHERE category_id = 'religious'
  AND title ILIKE '%doja cat%';

-- 3. Fix "unknown" category events with identifiable real categories

-- 404 Day is a community/local celebration tied to Atlanta's area code
UPDATE events
SET category_id = 'community'
WHERE category_id = 'unknown'
  AND title ILIKE '%404 day%';

-- Garden Lights (Atlanta Botanical Garden holiday light show) is family content
UPDATE events
SET category_id = 'family'
WHERE category_id = 'unknown'
  AND title ILIKE '%garden lights%';

-- 4. Deactivate premature 2027 Stone Mountain Christmas events
-- Stone Mountain Christmas for 2027 appeared as an orphan in the planning
-- horizon view. Deactivate until the crawler produces them legitimately.
UPDATE events
SET is_active = false
WHERE title ILIKE '%stone mountain christmas%'
  AND start_date >= '2027-01-01';

-- 5. Downgrade Frolicon importance: it is a niche adult convention,
-- not a major plan-ahead event that should surface in horizon views.
UPDATE events
SET importance = 'standard'
WHERE title ILIKE '%frolicon%'
  AND importance IN ('flagship', 'major');
