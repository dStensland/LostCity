-- Clean up featured flags on "A Beautiful Mosaic" track
-- The cultural venues migration (500000) added new venues but old restaurants
-- still had is_featured=TRUE, causing them to sort above cultural venues.
-- Fix: only Plaza Fiesta and Buford Highway Farmers Market should be featured.

DO $$
DECLARE
  v_track_id UUID := '773457ae-e687-410d-a0d1-caaad0dcc570'; -- a-beautiful-mosaic
BEGIN
  -- Unfeatured everything on this track first
  UPDATE explore_track_venues
  SET is_featured = FALSE
  WHERE track_id = v_track_id;

  -- Feature only the cultural flagships
  UPDATE explore_track_venues
  SET is_featured = TRUE
  WHERE track_id = v_track_id
    AND venue_id IN (
      2623,  -- Plaza Fiesta
      1205   -- Buford Highway Farmers Market
    );
END $$;
