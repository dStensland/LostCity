-- Migration: Regular Hang Health Gate
--
-- Regular hangs (karaoke nights, trivia, happy hours) have lighter quality
-- criteria than feed events. They tell you "this place does this thing on
-- this night." The bar is accuracy and confidence, not depth.
--
-- Required:
--   - Linked to a series (it's recurring)
--   - Has a start_time (people need to know when to show up)
--   - Title is meaningful (not broken crawler output)
--   - Source URL doesn't point to a known aggregator
--
-- NOT required (unlike feed events):
--   - Description (the title + venue + day IS the description)
--   - Deep-linked event URL (venue homepage is fine)
--   - Image

-- 1. Add the column (DEFAULT FALSE — backfill sets correct values)
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_regular_ready BOOLEAN DEFAULT FALSE;

-- 2. Trigger function
CREATE OR REPLACE FUNCTION compute_is_regular_ready() RETURNS TRIGGER AS $$
BEGIN
  -- Must be a recurring event (linked to a series)
  IF NEW.series_id IS NULL THEN
    NEW.is_regular_ready := FALSE;
    RETURN NEW;
  END IF;

  -- Must have a time slot (people need to know when to show up)
  IF NEW.start_time IS NULL THEN
    NEW.is_regular_ready := FALSE;
    RETURN NEW;
  END IF;

  -- Title must be meaningful
  IF NEW.title IS NULL OR LENGTH(TRIM(NEW.title)) < 3 THEN
    NEW.is_regular_ready := FALSE;
    RETURN NEW;
  END IF;

  -- Reject junk titles from broken crawlers
  IF LOWER(TRIM(NEW.title)) IN ('recurring', 'event', 'events', 'tbd', 'tba') THEN
    NEW.is_regular_ready := FALSE;
    RETURN NEW;
  END IF;

  -- Reject parsing artifacts (e.g. "1 event,19", "2 events,8")
  IF NEW.title ~ '^\d+ events?,\d+$' THEN
    NEW.is_regular_ready := FALSE;
    RETURN NEW;
  END IF;

  -- Source URL must not point to a known aggregator/curator
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

  -- All checks passed — this regular hang is good to surface
  NEW.is_regular_ready := TRUE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create trigger on relevant columns
DROP TRIGGER IF EXISTS trg_compute_regular_ready ON events;
CREATE TRIGGER trg_compute_regular_ready
  BEFORE INSERT OR UPDATE OF title, series_id, start_time, source_url
  ON events FOR EACH ROW
  EXECUTE FUNCTION compute_is_regular_ready();

-- 4. Backfill: evaluate all future recurring events
-- Only touch events with series_id to avoid unnecessary trigger fires
UPDATE events SET title = title
WHERE series_id IS NOT NULL AND start_date >= CURRENT_DATE;

-- 5. Index for regulars queries
CREATE INDEX IF NOT EXISTS idx_events_regular_ready_start_date
  ON events(start_date) WHERE is_regular_ready = true;
