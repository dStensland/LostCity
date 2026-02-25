-- Artefacts refresh pass:
-- - Remove retired/demolished picks
-- - Replace with still-standing object artefacts
-- - Improve image accuracy for key entries
-- - Tighten blurbs around the object itself

DO $$
DECLARE
  artefacts_track_id explore_tracks.id%TYPE;
  total_count integer;
BEGIN
  SELECT id
  INTO artefacts_track_id
  FROM explore_tracks
  WHERE slug = 'artefacts-of-the-lost-city';

  IF artefacts_track_id IS NULL THEN
    RAISE NOTICE 'Skipping artefacts refresh: track not found.';
    RETURN;
  END IF;

  -- Remove retired or weakly represented entries from the track.
  DELETE FROM explore_track_venues etv
  USING venues v
  WHERE etv.track_id = artefacts_track_id
    AND etv.venue_id = v.id
    AND v.slug IN (
      'lion-of-atlanta',
      'bridge-over-nothing',
      '1895-exposition-steps'
    );

  -- Add replacements at the same ranks.
  WITH additions(rank, slug, blurb, source_url, source_label) AS (
    VALUES
      (
        31,
        '54-columns',
        'A Sol LeWitt field of 54 concrete columns: minimalist geometry that feels like a frozen skyline.',
        'https://www.atlasobscura.com/places/54-columns',
        'Atlas Obscura'
      ),
      (
        36,
        'millennium-gate',
        'A 100-foot triumphal arch built as a modern civic monument, with carved reliefs and a museum beneath.',
        'https://en.wikipedia.org/wiki/Millennium_Gate_(Atlanta)',
        'Wikipedia'
      ),
      (
        48,
        'bradley-observatory',
        'A 1930s observatory anchored by historic telescopes and a dome built for public skywatching.',
        'https://en.wikipedia.org/wiki/Bradley_Observatory',
        'Wikipedia'
      )
  ), resolved AS (
    SELECT a.rank, v.id AS venue_id, a.blurb, a.source_url, a.source_label
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
    editorial_blurb,
    source_url,
    source_label,
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
    r.blurb,
    r.source_url,
    r.source_label,
    0,
    now(),
    now()
  FROM resolved r
  ON CONFLICT (track_id, venue_id)
  DO UPDATE SET
    status = 'approved',
    sort_order = EXCLUDED.sort_order,
    is_featured = EXCLUDED.is_featured,
    editorial_blurb = EXCLUDED.editorial_blurb,
    source_url = EXCLUDED.source_url,
    source_label = EXCLUDED.source_label,
    updated_at = now();

  -- Improve image accuracy for object-specific cards.
  UPDATE venues
  SET image_url = CASE slug
    WHEN 'kermit-chaplin-statue' THEN 'https://puppet.org/wp-content/uploads/2025/11/DSC01219_select_2008-1024x683.jpg'
    WHEN 'hank-aaron-statue' THEN 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Statue_of_Hank_Aaron_at_Turner_Field_%284054760656%29.jpg/1280px-Statue_of_Hank_Aaron_at_Turner_Field_%284054760656%29.jpg'
    ELSE image_url
  END
  WHERE slug IN ('kermit-chaplin-statue', 'hank-aaron-statue');

  -- Refresh blurbs for updated artefacts to keep language object-first.
  UPDATE explore_track_venues etv
  SET
    editorial_blurb = CASE v.slug
      WHEN 'kermit-chaplin-statue' THEN 'A 12-foot Kermit as Charlie Chaplin, gifted by the Henson family and moved to Atlanta in 2025.'
      WHEN 'hank-aaron-statue' THEN 'A bronze Hank Aaron frozen mid-swing, honoring 755 home runs and baseball''s retired number 44.'
      WHEN 'one-person-jail-cell' THEN 'A one-person 1890s steel lockup box: just enough room for one standing prisoner and a heavy iron door.'
      WHEN 'adalanta-desert-plaque' THEN 'A speculative-history plaque from the fictional desert city of "Adalanta," installed as public art.'
      WHEN 'fiddlin-john-carsons-grave' THEN 'The grave marker of Fiddlin'' John Carson, with a carved fiddle honoring one of country recording''s earliest stars.'
      ELSE etv.editorial_blurb
    END,
    source_label = CASE
      WHEN v.slug IN (
        'kermit-chaplin-statue',
        'hank-aaron-statue',
        'one-person-jail-cell',
        'adalanta-desert-plaque',
        'fiddlin-john-carsons-grave'
      ) THEN COALESCE(etv.source_label, 'Source')
      ELSE etv.source_label
    END,
    source_url = CASE v.slug
      WHEN 'kermit-chaplin-statue' THEN 'https://puppet.org/center-for-puppetry-arts-receives-iconic-kermit-the-frog-chaplin-statue-from-the-family-of-jim-henson/'
      WHEN 'hank-aaron-statue' THEN 'https://commons.wikimedia.org/wiki/File:Statue_of_Hank_Aaron_at_Turner_Field_(4054760656).jpg'
      ELSE etv.source_url
    END,
    updated_at = now()
  FROM venues v
  WHERE etv.track_id = artefacts_track_id
    AND etv.venue_id = v.id
    AND v.slug IN (
      'kermit-chaplin-statue',
      'hank-aaron-statue',
      'one-person-jail-cell',
      'adalanta-desert-plaque',
      'fiddlin-john-carsons-grave'
    );

  -- Keep featured flags aligned to top slots.
  UPDATE explore_track_venues
  SET
    is_featured = (sort_order <= 12),
    status = 'approved',
    updated_at = now()
  WHERE track_id = artefacts_track_id;

  SELECT COUNT(*)
  INTO total_count
  FROM explore_track_venues
  WHERE track_id = artefacts_track_id;

  RAISE NOTICE 'Artefacts refresh complete: % entries.', total_count;
END
$$;
