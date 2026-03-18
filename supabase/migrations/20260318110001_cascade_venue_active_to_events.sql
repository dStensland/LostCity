-- Migration: Cascade venue active flag to events
--
-- When a venue is deactivated, future events at that venue should have their
-- feed/regular flags cleared. This replaces the post-query JS filter
-- filterOutInactiveVenueEvents() with a DB-level guarantee.

CREATE OR REPLACE FUNCTION cascade_venue_active_to_events() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.active IS DISTINCT FROM NEW.active THEN
    IF NEW.active = FALSE THEN
      -- Deactivate feed/regular flags on future events
      UPDATE events SET is_feed_ready = FALSE, is_regular_ready = FALSE
      WHERE venue_id = NEW.id AND start_date >= CURRENT_DATE;
    ELSE
      -- Re-trigger evaluation (touch title to fire existing triggers)
      UPDATE events SET title = title
      WHERE venue_id = NEW.id AND start_date >= CURRENT_DATE;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cascade_venue_active
  AFTER UPDATE OF active ON venues
  FOR EACH ROW EXECUTE FUNCTION cascade_venue_active_to_events();

-- Backfill: cascade for currently inactive venues
UPDATE events SET is_feed_ready = FALSE, is_regular_ready = FALSE
WHERE venue_id IN (SELECT id FROM venues WHERE active = FALSE)
  AND start_date >= CURRENT_DATE
  AND (is_feed_ready = TRUE OR is_regular_ready = TRUE);
