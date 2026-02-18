-- Expand Artefacts track from 40 to 50 with validated weird/wonderful object picks.

DO $$
DECLARE
  artefacts_track_id uuid;
  total_count integer;
BEGIN
  SELECT id
  INTO artefacts_track_id
  FROM explore_tracks
  WHERE slug = 'artefacts-of-the-lost-city';

  IF artefacts_track_id IS NULL THEN
    RAISE NOTICE 'Skipping artefacts expansion: track not found.';
    RETURN;
  END IF;

  WITH additions(rank, slug) AS (
    VALUES
      (41, 'dolls-head-trail'),
      (42, 'fountain-of-rings'),
      (43, 'world-athletes-monument'),
      (44, 'whittier-mill-tower'),
      (45, 'jack-smith-armchair-statue'),
      (46, 'sideways-the-dogs-grave'),
      (47, 'hoo-hoo-monument'),
      (48, '1895-exposition-steps'),
      (49, 'bobby-jones-grave'),
      (50, 'fiddlin-john-carsons-grave')
  ), resolved AS (
    SELECT a.rank, v.id AS venue_id
    FROM additions a
    JOIN venues v
      ON v.slug = a.slug
  )
  INSERT INTO explore_track_venues (
    track_id,
    venue_id,
    status,
    sort_order,
    is_featured,
    upvote_count,
    created_at,
    updated_at
  )
  SELECT
    artefacts_track_id,
    r.venue_id,
    'approved',
    r.rank,
    false,
    0,
    now(),
    now()
  FROM resolved r
  ON CONFLICT (track_id, venue_id)
  DO UPDATE SET
    sort_order = EXCLUDED.sort_order,
    status = 'approved',
    updated_at = now();

  SELECT COUNT(*)
  INTO total_count
  FROM explore_track_venues
  WHERE track_id = artefacts_track_id;

  RAISE NOTICE 'Artefacts expanded to % entries.', total_count;
END
$$;
