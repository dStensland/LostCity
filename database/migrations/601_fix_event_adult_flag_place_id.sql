-- Migration: Fix set_event_adult_flag() after events venue_id -> place_id rename
--
-- event_adult_flag_trigger now fires on place_id, but its function body still
-- referenced NEW.venue_id / venues. That breaks inserts and updates on events.

CREATE OR REPLACE FUNCTION set_event_adult_flag()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.place_id IS NOT NULL THEN
    SELECT is_adult INTO NEW.is_adult
    FROM places
    WHERE id = NEW.place_id;

    IF NEW.is_adult IS NULL THEN
      NEW.is_adult := false;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

