-- Migration: Exclude support groups and classes from is_regular_ready
--
-- 1,108 support groups and 261 classes pass compute_is_regular_ready() because
-- it doesn't check category_id or is_class. These are not "regulars" in the
-- hangout sense — they're structured programs that belong in Programs, not Regulars.

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

  -- Reject sponsor/partner/thank-you titles (not real events)
  IF LOWER(NEW.title) ~ '(premier partner|sponsor|thank you.*partner|partners? program)' THEN
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

  -- Reject non-hang categories (support groups, community, learning, family)
  IF NEW.category_id IN ('support_group', 'community', 'learning', 'family') THEN
    NEW.is_regular_ready := FALSE;
    RETURN NEW;
  END IF;

  -- Reject classes (structured programs, not hangout regulars)
  IF NEW.is_class IS TRUE THEN
    NEW.is_regular_ready := FALSE;
    RETURN NEW;
  END IF;

  -- All checks passed — this regular hang is good to surface
  NEW.is_regular_ready := TRUE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Expand trigger column list to include category_id and is_class
DROP TRIGGER IF EXISTS trg_compute_regular_ready ON events;
CREATE TRIGGER trg_compute_regular_ready
  BEFORE INSERT OR UPDATE OF title, series_id, start_time, source_url, category_id, is_class
  ON events FOR EACH ROW
  EXECUTE FUNCTION compute_is_regular_ready();

-- Backfill: re-evaluate affected rows
UPDATE events SET title = title
WHERE series_id IS NOT NULL
  AND start_date >= CURRENT_DATE
  AND is_regular_ready = TRUE
  AND (category_id IN ('support_group', 'community', 'learning', 'family') OR is_class = TRUE);
