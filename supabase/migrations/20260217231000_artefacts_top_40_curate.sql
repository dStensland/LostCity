-- Curate Artefacts track down to a high-signal top 40: special, weird, and wonderful objects.

DO $$
DECLARE
  artefacts_track_id uuid;
  kept_count integer;
BEGIN
  SELECT id
  INTO artefacts_track_id
  FROM explore_tracks
  WHERE slug = 'artefacts-of-the-lost-city';

  IF artefacts_track_id IS NULL THEN
    RAISE NOTICE 'Skipping artefacts curation: track not found.';
    RETURN;
  END IF;

  -- Keep list in intentional editorial order.
  WITH curated(rank, slug) AS (
    VALUES
      (1, 'willie-b-statue'),
      (2, 'the-big-chicken'),
      (3, 'crypt-of-civilization'),
      (4, 'two-headed-calf-moon-rocks'),
      (5, 'autoeater'),
      (6, 'the-cyclorama'),
      (7, 'vortex-laughing-skull'),
      (8, 'coca-cola-vault'),
      (9, 'zero-mile-post'),
      (10, 'the-great-fish'),
      (11, 'noguchi-playscape'),
      (12, 'the-varsity-neon-sign'),
      (13, 'giant-hands-of-dr-sid'),
      (14, 'phoenix-rising-sculpture'),
      (15, 'ramblin-wreck'),
      (16, 'lord-dooley-statue'),
      (17, 'anti-gravity-monument'),
      (18, 'hank-aaron-home-run-wall'),
      (19, 'kermit-chaplin-statue'),
      (20, 'one-person-jail-cell'),
      (21, 'adalanta-desert-plaque'),
      (22, 'elvis-shrine-vault'),
      (23, 'pink-trap-house-chevy'),
      (24, 'confessional-photobooth'),
      (25, 'owl-rock'),
      (26, 'monster-mansion-monsters'),
      (27, 'riverview-carousel'),
      (28, 'the-general-locomotive'),
      (29, 'spirit-of-delta'),
      (30, 'stone-mountain-carving'),
      (31, 'lion-of-atlanta'),
      (32, 'asa-candler-mausoleum'),
      (33, 'eav-totem-pole'),
      (34, 'merci-boxcar'),
      (35, 'fdr-superb-railcar'),
      (36, 'bridge-over-nothing'),
      (37, 'hank-aaron-statue'),
      (38, 'the-dump-apartment'),
      (39, 'concord-covered-bridge'),
      (40, 'covington-clock-tower')
  )
  DELETE FROM explore_track_venues etv
  USING venues v
  WHERE etv.track_id = artefacts_track_id
    AND etv.venue_id = v.id
    AND NOT EXISTS (
      SELECT 1
      FROM curated c
      WHERE c.slug = v.slug
    );

  WITH curated(rank, slug) AS (
    VALUES
      (1, 'willie-b-statue'),
      (2, 'the-big-chicken'),
      (3, 'crypt-of-civilization'),
      (4, 'two-headed-calf-moon-rocks'),
      (5, 'autoeater'),
      (6, 'the-cyclorama'),
      (7, 'vortex-laughing-skull'),
      (8, 'coca-cola-vault'),
      (9, 'zero-mile-post'),
      (10, 'the-great-fish'),
      (11, 'noguchi-playscape'),
      (12, 'the-varsity-neon-sign'),
      (13, 'giant-hands-of-dr-sid'),
      (14, 'phoenix-rising-sculpture'),
      (15, 'ramblin-wreck'),
      (16, 'lord-dooley-statue'),
      (17, 'anti-gravity-monument'),
      (18, 'hank-aaron-home-run-wall'),
      (19, 'kermit-chaplin-statue'),
      (20, 'one-person-jail-cell'),
      (21, 'adalanta-desert-plaque'),
      (22, 'elvis-shrine-vault'),
      (23, 'pink-trap-house-chevy'),
      (24, 'confessional-photobooth'),
      (25, 'owl-rock'),
      (26, 'monster-mansion-monsters'),
      (27, 'riverview-carousel'),
      (28, 'the-general-locomotive'),
      (29, 'spirit-of-delta'),
      (30, 'stone-mountain-carving'),
      (31, 'lion-of-atlanta'),
      (32, 'asa-candler-mausoleum'),
      (33, 'eav-totem-pole'),
      (34, 'merci-boxcar'),
      (35, 'fdr-superb-railcar'),
      (36, 'bridge-over-nothing'),
      (37, 'hank-aaron-statue'),
      (38, 'the-dump-apartment'),
      (39, 'concord-covered-bridge'),
      (40, 'covington-clock-tower')
  ), ranked AS (
    SELECT c.rank, v.id AS venue_id
    FROM curated c
    JOIN venues v
      ON v.slug = c.slug
  )
  UPDATE explore_track_venues etv
  SET sort_order = r.rank,
      is_featured = (r.rank <= 12),
      status = 'approved'
  FROM ranked r
  WHERE etv.track_id = artefacts_track_id
    AND etv.venue_id = r.venue_id;

  SELECT COUNT(*)
  INTO kept_count
  FROM explore_track_venues etv
  WHERE etv.track_id = artefacts_track_id;

  RAISE NOTICE 'Artefacts curated to % entries.', kept_count;
END
$$;
