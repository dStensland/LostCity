-- Migration: Reject sponsor/partner titles from regular hangs
--
-- "Premier Partners" and similar sponsor acknowledgment titles leak into
-- the Regulars tab from venue websites. They're not events — filter them.

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

  -- All checks passed — this regular hang is good to surface
  NEW.is_regular_ready := TRUE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Backfill: re-evaluate future recurring events to pick up the new rule
UPDATE events SET title = title
WHERE series_id IS NOT NULL
  AND start_date >= CURRENT_DATE
  AND LOWER(title) ~ '(premier partner|sponsor|thank you.*partner|partners? program)';
