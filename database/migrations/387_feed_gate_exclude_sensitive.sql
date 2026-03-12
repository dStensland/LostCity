-- Sensitive events (AA/NA meetings, etc.) should never appear in discovery feeds.
-- The is_sensitive flag was already set on these sources, but compute_is_feed_ready
-- didn't check it — so 3,700+ support group meetings were marked feed-ready.

-- 1. Update trigger to check is_sensitive
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

  -- All rules passed
  NEW.is_feed_ready := TRUE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Add is_sensitive to trigger column watch list
DROP TRIGGER IF EXISTS trg_compute_feed_ready ON events;
CREATE TRIGGER trg_compute_feed_ready
  BEFORE INSERT OR UPDATE OF title, description, image_url, series_id, is_sensitive
  ON events FOR EACH ROW
  EXECUTE FUNCTION compute_is_feed_ready();

-- 3. Backfill: mark all sensitive events as not feed-ready
UPDATE events SET is_feed_ready = false WHERE is_sensitive = true AND is_feed_ready = true;
