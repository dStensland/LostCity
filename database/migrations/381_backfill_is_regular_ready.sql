-- Migration: Backfill is_regular_ready for all existing events
--
-- The compute_is_regular_ready() trigger only fires on INSERT/UPDATE,
-- so existing events still have is_regular_ready = NULL. This backfill
-- touches all future events with a series_id to trigger the computation.
--
-- Events without series_id get is_regular_ready = FALSE explicitly
-- so they don't leak through the IS NULL fallback in applyVenueGate.

-- 1. Trigger computation for recurring events (has series_id)
UPDATE events SET title = title
WHERE series_id IS NOT NULL
  AND start_date >= CURRENT_DATE
  AND is_regular_ready IS NULL;

-- 2. Explicitly mark non-recurring events as not regular-ready
UPDATE events SET is_regular_ready = FALSE
WHERE series_id IS NULL
  AND start_date >= CURRENT_DATE
  AND is_regular_ready IS NULL;
