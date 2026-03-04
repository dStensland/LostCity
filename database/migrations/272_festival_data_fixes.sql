-- 272_festival_data_fixes.sql
-- Fix festival visibility: reactivate series, canonicalize dupes, clean tentpoles, add guard trigger

-- ============================================================
-- 1a. Reactivate series that have active future events
-- Unblocks: DevNexus (118), Shortsfest (20), Smoke on the Lake (14),
--           Dunwoody Art (4), Invest Fest (3), Cherry Blossom (2),
--           GA Food & Wine (2), Pigs & Peaches (2)
-- ============================================================
UPDATE series SET is_active = true
WHERE is_active = false AND id IN (
  SELECT DISTINCT s.id FROM series s
  JOIN events e ON e.series_id = s.id
  WHERE e.start_date >= CURRENT_DATE AND e.is_active = true
);

-- ============================================================
-- 1b. Canonicalize SweetWater 420 Fest duplicate events
-- Keep id 52932 (has image, venue, correct dates); mark rest as dupes
-- ============================================================
UPDATE events SET canonical_event_id = 52932
WHERE id IN (2224, 23086, 27865)
  AND canonical_event_id IS NULL;

-- ============================================================
-- 1c. Remove is_tentpole from wrong-city / non-tentpole events
-- ============================================================
-- Freely Fest (Nashville)
UPDATE events SET is_tentpole = false WHERE id = 66792 AND is_tentpole = true;
-- Charlotte Tattoo Convention
UPDATE events SET is_tentpole = false WHERE id = 60552 AND is_tentpole = true;
-- SFQP Open To All Organizing Meeting (not a tentpole event)
UPDATE events SET is_tentpole = false WHERE id = 62544 AND is_tentpole = true;

-- ============================================================
-- 1d. Fix missing portal_id on Atlanta festivals
-- ============================================================
UPDATE festivals SET portal_id = (
  SELECT id FROM portals WHERE slug = 'atlanta' LIMIT 1
)
WHERE slug IN ('sweet-auburn-fest', 'atlanta-film-festival')
  AND portal_id IS NULL;

-- ============================================================
-- 1e. Guard trigger: prevent accidental series deactivation
--     when the series still has active future events
-- ============================================================
CREATE OR REPLACE FUNCTION guard_series_deactivation()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  future_count INTEGER;
BEGIN
  -- Only fire when is_active transitions from true to false
  IF OLD.is_active = true AND NEW.is_active = false THEN
    SELECT COUNT(*) INTO future_count
    FROM events
    WHERE series_id = OLD.id
      AND start_date >= CURRENT_DATE
      AND is_active = true;

    IF future_count > 0 THEN
      RAISE WARNING 'Series "%" has % active future events — keeping active',
        OLD.title, future_count;
      NEW.is_active := true;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_series_deactivation ON series;
CREATE TRIGGER trg_guard_series_deactivation
  BEFORE UPDATE ON series
  FOR EACH ROW
  EXECUTE FUNCTION guard_series_deactivation();
