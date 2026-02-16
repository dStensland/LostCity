-- Banner image fixes:
-- 1. Update "Hard in Da Paint" description to remove "Krog Tunnel" name reference
--    (user wants the Krog image but not the name called out)
-- 2. Add GWCC to "The Midnight Train" track for Dragon Con imagery

-- Fix Hard in Da Paint description
UPDATE explore_tracks
SET description = 'BeltLine murals, gallery crawls, and the street art that makes Atlanta a canvas.'
WHERE slug = 'hard-in-da-paint';

-- Add GWCC to Midnight Train for Dragon Con vibes
DO $$
DECLARE
  v_track_id UUID;
BEGIN
  SELECT id INTO v_track_id FROM explore_tracks WHERE slug = 'the-midnight-train';

  IF v_track_id IS NULL THEN
    RAISE NOTICE 'Track not found, skipping';
    RETURN;
  END IF;

  INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, status, editorial_blurb)
  VALUES
    (v_track_id, 90, 1, TRUE, 'approved',
     'Dragon Con, MomoCon, Anime Weekend Atlanta — 80,000 costumes pour through five connected buildings every Labor Day. The weirdest weekend in the South.')
  ON CONFLICT (track_id, venue_id) DO UPDATE SET
    sort_order = EXCLUDED.sort_order,
    is_featured = EXCLUDED.is_featured,
    editorial_blurb = EXCLUDED.editorial_blurb;
END $$;
