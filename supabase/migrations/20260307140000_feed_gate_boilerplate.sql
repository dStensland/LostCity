-- Feed gate Rule 4: Boilerplate description with no image and no series = not feed-ready.
-- Events with a boilerplate template description (e.g. "X is a live event") but no image
-- and no series provide no useful discovery value. Hold them until enriched.

CREATE OR REPLACE FUNCTION compute_is_feed_ready() RETURNS TRIGGER AS $$
BEGIN
  -- Rule 0: Sensitive events are never feed-ready (AA/NA meetings, etc.)
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
  -- These template descriptions add no discovery value without an image or series.
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

-- Trigger unchanged (same columns), but re-create to pick up new function body
DROP TRIGGER IF EXISTS trg_compute_feed_ready ON events;
CREATE TRIGGER trg_compute_feed_ready
  BEFORE INSERT OR UPDATE OF title, description, image_url, series_id, is_sensitive
  ON events FOR EACH ROW
  EXECUTE FUNCTION compute_is_feed_ready();

-- Backfill: re-evaluate all future events to apply Rule 4
UPDATE events SET title = title WHERE start_date >= CURRENT_DATE;
