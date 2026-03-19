-- Migration: Flagship Dedup Cleanup
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.
--
-- Purpose: Final pass to fix flagship deduplication and correct mis-elevated events.
-- Sections:
--   1. Fix Southern-Fried Gaming Expo (regex miss in prior migration)
--   2. Deduplicate flagship entries — keep lowest ID per date as canonical
--   3. Demote Virginia-Highland Summerfest (all entries should be major)
--   4. Demote 404 Day (fun but not city-defining)

-- ---------------------------------------------------------------------------
-- Section 1: Fix Southern-Fried Gaming Expo
-- Prior migration used ILIKE '%southern.fried gaming%' — the dot matched any
-- character but the actual title contains a hyphen, so it did not match.
-- This is a niche convention, not a city tentpole.
-- ---------------------------------------------------------------------------

UPDATE events
SET is_tentpole = false,
    importance  = 'standard'
WHERE is_tentpole = true
  AND title ILIKE '%southern-fried gaming%';


-- ---------------------------------------------------------------------------
-- Section 2: Deduplicate flagship entries — keep one flagship per event
--
-- Strategy: for each duplicated event title group, the canonical flagship is
-- the row with the lowest id that also has is_active = true (preferring rows
-- with a venue_id, but MIN(id) is the tiebreaker).  All other rows in the
-- same title group / same start_date are demoted to 'major'.
-- ---------------------------------------------------------------------------

-- Virginia-Highland Summerfest
UPDATE events
SET importance = 'major'
WHERE title ILIKE '%virginia%highland summerfest%'
  AND importance = 'flagship'
  AND id NOT IN (
    SELECT MIN(id)
    FROM events
    WHERE title ILIKE '%virginia%highland summerfest%'
      AND importance IN ('flagship', 'major')
      AND is_active = true
    GROUP BY start_date
  );

-- Candler Park Fall Fest
UPDATE events
SET importance = 'major'
WHERE title ILIKE '%candler park fall%'
  AND importance = 'flagship'
  AND id NOT IN (
    SELECT MIN(id)
    FROM events
    WHERE title ILIKE '%candler park fall%'
      AND importance IN ('flagship', 'major')
      AND is_active = true
    GROUP BY start_date
  );

-- Juneteenth (all instances treated as a single event — no date grouping needed)
UPDATE events
SET importance = 'major'
WHERE title ILIKE '%juneteenth%'
  AND importance = 'flagship'
  AND id NOT IN (
    SELECT MIN(id)
    FROM events
    WHERE title ILIKE '%juneteenth%'
      AND importance IN ('flagship', 'major')
      AND is_active = true
  );

-- Dragon Con (exclude kickoff/related events; those can remain at their own level)
UPDATE events
SET importance = 'major'
WHERE title ILIKE '%dragon con%'
  AND title NOT ILIKE '%kick%'
  AND importance = 'flagship'
  AND id NOT IN (
    SELECT MIN(id)
    FROM events
    WHERE title ILIKE '%dragon con%'
      AND title NOT ILIKE '%kick%'
      AND importance IN ('flagship', 'major')
      AND is_active = true
  );

-- Stone Mountain Christmas
UPDATE events
SET importance = 'major'
WHERE title ILIKE '%stone mountain christmas%'
  AND importance = 'flagship'
  AND is_active = true
  AND id NOT IN (
    SELECT MIN(id)
    FROM events
    WHERE title ILIKE '%stone mountain christmas%'
      AND importance IN ('flagship', 'major')
      AND is_active = true
  );

-- Garden Lights, Holiday Nights
UPDATE events
SET importance = 'major'
WHERE title ILIKE '%garden lights%'
  AND importance = 'flagship'
  AND is_active = true
  AND id NOT IN (
    SELECT MIN(id)
    FROM events
    WHERE title ILIKE '%garden lights%'
      AND importance IN ('flagship', 'major')
      AND is_active = true
  );


-- ---------------------------------------------------------------------------
-- Section 3: Virginia-Highland Summerfest — full demotion
--
-- Migration 571 only caught 1 of 4 entries because the prior WHERE clause
-- was too narrow.  This ensures ALL remaining flagship entries are demoted.
-- VaHi Summerfest is a well-loved neighborhood festival but not a city
-- tentpole in the Dragon Con / Music Midtown sense.
-- ---------------------------------------------------------------------------

UPDATE events
SET importance = 'major'
WHERE title ILIKE '%virginia%highland summerfest%'
  AND importance = 'flagship';


-- ---------------------------------------------------------------------------
-- Section 4: 404 Day demotion
--
-- 404 Day is a fun Atlanta-specific celebration but does not meet the bar
-- for city-defining tentpole (no multi-day footprint, no major economic
-- draw, not Atlanta's own event in the way AJC Peachtree Road Race is).
-- ---------------------------------------------------------------------------

UPDATE events
SET importance = 'major'
WHERE title ILIKE '%404 day%'
  AND importance = 'flagship';
