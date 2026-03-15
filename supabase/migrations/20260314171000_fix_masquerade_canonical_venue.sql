-- Promote the accidentally seeded Masquerade test row into the real canonical venue
-- and attach the room-level venues under it.

DO $$
DECLARE
  canonical_id INTEGER;
BEGIN
  SELECT id
  INTO canonical_id
  FROM venues
  WHERE slug = 'the-masquerade'
  ORDER BY active DESC, id ASC
  LIMIT 1;

  IF canonical_id IS NULL THEN
    UPDATE venues
    SET
      slug = 'the-masquerade',
      name = 'The Masquerade',
      active = TRUE,
      website = COALESCE(NULLIF(website, ''), 'https://www.masqueradeatlanta.com')
    WHERE slug = 'the-masquerade-test'
    RETURNING id INTO canonical_id;
  END IF;

  IF canonical_id IS NULL THEN
    RAISE EXCEPTION 'Could not resolve canonical The Masquerade venue row';
  END IF;

  UPDATE venues
  SET
    active = TRUE,
    name = 'The Masquerade',
    website = COALESCE(NULLIF(website, ''), 'https://www.masqueradeatlanta.com')
  WHERE id = canonical_id;

  UPDATE venues
  SET parent_venue_id = canonical_id
  WHERE slug IN (
    'the-masquerade-hell',
    'the-masquerade-heaven',
    'the-masquerade-purgatory',
    'the-masquerade-altar',
    'the-masquerade-music-park'
  )
    AND id <> canonical_id;
END $$;

SELECT refresh_search_suggestions();
