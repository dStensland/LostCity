-- Migration: Fix cascade place active trigger
--
-- The trigger function cascade_venue_active_to_events() referenced OLD.active / NEW.active,
-- which broke after the venues table was renamed to places and the `active` column was
-- renamed to `is_active`. The trigger also referenced the old `venues` table name.
--
-- Fixes: update function body to use is_active, re-create trigger on places table.

-- 1. Drop the old broken trigger (venues table no longer exists; drop from places)
DROP TRIGGER IF EXISTS trg_cascade_venue_active ON places;

-- 2. Replace the function with corrected column references
CREATE OR REPLACE FUNCTION cascade_venue_active_to_events() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
    IF NEW.is_active = FALSE THEN
      -- Deactivate feed/regular flags on future events at this place
      UPDATE events SET is_feed_ready = FALSE, is_regular_ready = FALSE
      WHERE place_id = NEW.id AND start_date >= CURRENT_DATE;
    ELSE
      -- Re-trigger evaluation (touch title to fire existing triggers)
      UPDATE events SET title = title
      WHERE place_id = NEW.id AND start_date >= CURRENT_DATE;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Re-create trigger on the places table with correct column name
CREATE TRIGGER trg_cascade_place_active
  AFTER UPDATE OF is_active ON places
  FOR EACH ROW EXECUTE FUNCTION cascade_venue_active_to_events();
