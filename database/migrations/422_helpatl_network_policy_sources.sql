-- 422_helpatl_network_policy_sources.sql
-- Move first-wave policy reporting sources into HelpATL's local network pool
-- so HelpATL can combine them with Atlanta's inherited city-news stack.

DO $$
DECLARE
  helpatl_id UUID;
  georgia_recorder_source_id INTEGER;
  capitol_beat_source_id INTEGER;
BEGIN
  SELECT id INTO helpatl_id
  FROM portals
  WHERE slug = 'helpatl'
  LIMIT 1;

  IF helpatl_id IS NULL THEN
    RAISE NOTICE 'helpatl portal not found; skipping network policy source reassignment';
    RETURN;
  END IF;

  UPDATE network_sources
  SET portal_id = helpatl_id
  WHERE slug IN ('georgia-recorder', 'capitol-beat');

  SELECT id INTO georgia_recorder_source_id FROM network_sources WHERE slug = 'georgia-recorder' LIMIT 1;
  SELECT id INTO capitol_beat_source_id FROM network_sources WHERE slug = 'capitol-beat' LIMIT 1;

  UPDATE network_posts
  SET portal_id = helpatl_id
  WHERE source_id IN (
    COALESCE(georgia_recorder_source_id, -1),
    COALESCE(capitol_beat_source_id, -1)
  );
END $$;
