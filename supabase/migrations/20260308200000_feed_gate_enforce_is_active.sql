-- Feed gate: enforce is_active at the database level
--
-- Problem: is_active = false means "this event is canceled/removed/deactivated"
-- but neither compute_is_feed_ready() nor compute_is_regular_ready() checked it.
-- Result: deactivated events leaked into every feed, timeline, and listing route.
--
-- Fix: Both trigger functions now check is_active first. When is_active = false,
-- is_feed_ready and is_regular_ready are set to false. The existing application-
-- level applyFeedGate() / applyVenueGate() then filters them out everywhere.
--
-- This is the correct layer for this check — database triggers ensure the
-- invariant holds regardless of which API route or crawler touches the row.

-- 1. Update compute_is_feed_ready to check is_active
CREATE OR REPLACE FUNCTION compute_is_feed_ready() RETURNS TRIGGER AS $$
BEGIN
  -- Rule 0a: Inactive events are never feed-ready
  IF NEW.is_active = FALSE THEN
    NEW.is_feed_ready := FALSE;
    RETURN NEW;
  END IF;

  -- Rule 0b: Sensitive events are never feed-ready (AA/NA meetings, etc.)
  IF NEW.is_sensitive = TRUE THEN
    NEW.is_feed_ready := FALSE;
    RETURN NEW;
  END IF;

  -- Rule 1: Skeleton event — no description AND no image AND no series
  IF NEW.description IS NULL AND NEW.image_url IS NULL AND NEW.series_id IS NULL THEN
    NEW.is_feed_ready := FALSE;
    RETURN NEW;
  END IF;

  -- Rule 2: Generic title with no description AND no series
  IF NEW.description IS NULL AND NEW.series_id IS NULL AND LOWER(TRIM(NEW.title)) IN (
    'happy hour', 'open mic', 'trivia', 'trivia night', 'karaoke', 'karaoke night',
    'bingo', 'dj night', 'live music', 'brunch', 'sunday brunch', 'weekend brunch',
    'sunday brunch buffet', 'bottomless brunch', 'bottomless mimosa brunch',
    'jazz brunch', 'ladies night', 'wine night', 'date night', 'wing deal',
    'all day happy hour', 'oyster happy hour', 'taco tuesday',
    'tuesday dance night', 'drag nite', 'meditation'
  ) THEN
    NEW.is_feed_ready := FALSE;
    RETURN NEW;
  END IF;

  -- Rule 3: Decontextualized title (Round N, Game N, Match N) with no description
  IF NEW.description IS NULL AND NEW.title ~* '^(Round|Game|Match)\s+\d+$' THEN
    NEW.is_feed_ready := FALSE;
    RETURN NEW;
  END IF;

  -- Rule 4: Boilerplate description with no other context
  IF NEW.image_url IS NULL AND NEW.series_id IS NULL
     AND NEW.description IS NOT NULL
     AND (
       LOWER(NEW.description) LIKE '%is a live event%'
       OR LOWER(NEW.description) LIKE '%is a local event%'
       OR LOWER(NEW.description) LIKE '%is a live music event%'
       OR LOWER(NEW.description) LIKE '%is a film screening%'
       OR LOWER(NEW.description) LIKE '%is a community program%'
       OR LOWER(NEW.description) LIKE '%location details are listed%'
       OR LOWER(NEW.description) LIKE '%use the ticket link for current availability%'
       OR (LENGTH(NEW.description) < 250 AND LOWER(NEW.description) LIKE '%category: %')
     )
  THEN
    NEW.is_feed_ready := FALSE;
    RETURN NEW;
  END IF;

  -- All rules passed
  NEW.is_feed_ready := TRUE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add is_active to the feed-ready trigger's column watch list
DROP TRIGGER IF EXISTS trg_compute_feed_ready ON events;
CREATE TRIGGER trg_compute_feed_ready
  BEFORE INSERT OR UPDATE OF title, description, image_url, series_id, is_sensitive, is_active
  ON events FOR EACH ROW
  EXECUTE FUNCTION compute_is_feed_ready();


-- 2. Update compute_is_regular_ready to check is_active
CREATE OR REPLACE FUNCTION compute_is_regular_ready() RETURNS TRIGGER AS $$
BEGIN
  -- Inactive events are never regular-ready
  IF NEW.is_active = FALSE THEN
    NEW.is_regular_ready := FALSE;
    RETURN NEW;
  END IF;

  -- Must be a recurring event (linked to a series)
  IF NEW.series_id IS NULL THEN
    NEW.is_regular_ready := FALSE;
    RETURN NEW;
  END IF;

  -- Must have a time slot
  IF NEW.start_time IS NULL THEN
    NEW.is_regular_ready := FALSE;
    RETURN NEW;
  END IF;

  -- Title must be meaningful
  IF NEW.title IS NULL OR LENGTH(TRIM(NEW.title)) < 3 THEN
    NEW.is_regular_ready := FALSE;
    RETURN NEW;
  END IF;

  -- Reject junk titles
  IF LOWER(TRIM(NEW.title)) IN ('recurring', 'event', 'events', 'tbd', 'tba') THEN
    NEW.is_regular_ready := FALSE;
    RETURN NEW;
  END IF;

  -- Reject parsing artifacts
  IF NEW.title ~ '^\d+ events?,\d+$' THEN
    NEW.is_regular_ready := FALSE;
    RETURN NEW;
  END IF;

  -- Source URL must not point to aggregator
  IF NEW.source_url IS NOT NULL AND (
    NEW.source_url ILIKE '%badslava.com%'
    OR NEW.source_url ILIKE '%artsatl.org%'
    OR NEW.source_url ILIKE '%creativeloafing.com%'
    OR NEW.source_url ILIKE '%timeout.com%'
    OR NEW.source_url ILIKE '%accessatlanta.com%'
  ) THEN
    NEW.is_regular_ready := FALSE;
    RETURN NEW;
  END IF;

  -- All checks passed
  NEW.is_regular_ready := TRUE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add is_active to the regular-ready trigger's column watch list
DROP TRIGGER IF EXISTS trg_compute_regular_ready ON events;
CREATE TRIGGER trg_compute_regular_ready
  BEFORE INSERT OR UPDATE OF title, series_id, start_time, source_url, is_active
  ON events FOR EACH ROW
  EXECUTE FUNCTION compute_is_regular_ready();


-- 3. Backfill: mark inactive events as not feed/regular ready
UPDATE events
SET is_feed_ready = FALSE, is_regular_ready = FALSE
WHERE is_active = FALSE
  AND (is_feed_ready = TRUE OR is_regular_ready = TRUE);
