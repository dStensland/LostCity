-- Promote Willie B Statue as the lead artefact and category banner image.

DO $$
DECLARE
  artefacts_track_id uuid;
  willie_venue_id integer;
  willie_sort integer;
  willie_image text;
BEGIN
  SELECT id
  INTO artefacts_track_id
  FROM explore_tracks
  WHERE slug = 'artefacts-of-the-lost-city';

  SELECT v.id, etv.sort_order, v.image_url
  INTO willie_venue_id, willie_sort, willie_image
  FROM venues v
  LEFT JOIN explore_track_venues etv
    ON etv.venue_id = v.id
   AND etv.track_id = artefacts_track_id
  WHERE v.slug = 'willie-b-statue';

  IF artefacts_track_id IS NULL OR willie_venue_id IS NULL THEN
    RAISE NOTICE 'Skipping Willie B promotion: required track/venue missing.';
    RETURN;
  END IF;

  IF willie_sort IS NULL THEN
    RAISE NOTICE 'Skipping Willie B promotion: Willie B is not mapped to artefacts track.';
    RETURN;
  END IF;

  IF willie_sort > 1 THEN
    UPDATE explore_track_venues
    SET sort_order = sort_order + 1
    WHERE track_id = artefacts_track_id
      AND venue_id <> willie_venue_id
      AND sort_order < willie_sort;
  END IF;

  UPDATE explore_track_venues
  SET sort_order = 1,
      is_featured = true
  WHERE track_id = artefacts_track_id
    AND venue_id = willie_venue_id;

  IF COALESCE(willie_image, '') <> '' THEN
    UPDATE explore_tracks
    SET banner_image_url = willie_image
    WHERE id = artefacts_track_id;
  END IF;
END
$$;
