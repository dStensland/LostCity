-- 20260311132100_helpatl_policy_watch_wave2.sql
-- Add GBPI to HelpATL's local policy/news pool and move Atlanta Civic Circle
-- into HelpATL so the portal has a stronger policy spine without making the
-- Atlanta city feed more wonky by default.

DO $$
DECLARE
  helpatl_id UUID;
  gbpi_source_id INTEGER;
  civic_circle_source_id INTEGER;
BEGIN
  SELECT id INTO helpatl_id
  FROM portals
  WHERE slug = 'helpatl'
  LIMIT 1;

  IF helpatl_id IS NULL THEN
    RAISE NOTICE 'helpatl portal not found; skipping policy watch wave 2';
    RETURN;
  END IF;

  INSERT INTO network_sources (
    portal_id,
    name,
    slug,
    feed_url,
    website_url,
    description,
    categories
  )
  VALUES (
    helpatl_id,
    'Georgia Budget and Policy Institute',
    'gbpi',
    'https://gbpi.org/feed/',
    'https://gbpi.org',
    'Georgia budget, tax, economic mobility, and public-policy analysis focused on how state decisions affect residents.',
    ARRAY['news', 'civic', 'politics']
  )
  ON CONFLICT (slug) DO UPDATE
  SET
    portal_id = EXCLUDED.portal_id,
    name = EXCLUDED.name,
    feed_url = EXCLUDED.feed_url,
    website_url = EXCLUDED.website_url,
    description = EXCLUDED.description,
    categories = EXCLUDED.categories,
    is_active = true,
    updated_at = now();

  UPDATE network_sources
  SET portal_id = helpatl_id,
      categories = ARRAY['news', 'civic', 'politics'],
      updated_at = now()
  WHERE slug = 'atlanta-civic-circle';

  SELECT id INTO gbpi_source_id
  FROM network_sources
  WHERE slug = 'gbpi'
  LIMIT 1;

  SELECT id INTO civic_circle_source_id
  FROM network_sources
  WHERE slug = 'atlanta-civic-circle'
  LIMIT 1;

  UPDATE network_posts
  SET portal_id = helpatl_id
  WHERE source_id IN (
    COALESCE(gbpi_source_id, -1),
    COALESCE(civic_circle_source_id, -1)
  );
END $$;
