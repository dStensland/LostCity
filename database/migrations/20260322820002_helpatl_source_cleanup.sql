-- HelpATL source cleanup: deactivate duplicates, remove dead subscriptions,
-- fix portal attribution.

DO $$
DECLARE
  helpatl_id UUID;
BEGIN
  SELECT id INTO helpatl_id FROM portals WHERE slug = 'helpatl';

  -- 1. Deactivate georgia-elections phantom record (no crawler, never ran)
  UPDATE sources SET is_active = false,
    health_tags = array_append(COALESCE(health_tags, '{}'), 'deactivated:phantom_duplicate')
  WHERE slug = 'georgia-elections' AND is_active = true;

  -- 2. Deactivate atlanta-city-meetings (Playwright scraper, duplicates atlanta-city-council RSS)
  UPDATE sources SET is_active = false,
    health_tags = array_append(COALESCE(health_tags, '{}'), 'deactivated:duplicate_of_atlanta-city-council')
  WHERE slug = 'atlanta-city-meetings' AND is_active = true;

  -- Deactivate future events from deactivated sources
  UPDATE events SET is_active = false
  WHERE source_id IN (
    SELECT id FROM sources WHERE slug IN ('georgia-elections', 'atlanta-city-meetings')
  )
  AND start_date >= CURRENT_DATE AND is_active = true;

  -- 3. Remove 4 dead support subscriptions from HelpATL
  -- These sources are all is_sensitive=true, contributing 0 visible events.
  UPDATE source_subscriptions SET is_active = false
  WHERE subscriber_portal_id = helpatl_id
    AND source_id IN (
      SELECT id FROM sources WHERE slug IN (
        'dbsa-atlanta',
        'griefshare-atlanta',
        'divorcecare-atlanta',
        'nami-georgia'
      )
    )
    AND is_active = true;

  -- 4. Fix fulton-county-meetings portal attribution (atlanta → helpatl)
  UPDATE sources SET owner_portal_id = helpatl_id
  WHERE slug = 'fulton-county-meetings'
    AND owner_portal_id = (SELECT id FROM portals WHERE slug = 'atlanta');

  -- Re-attribute fulton-county-meetings events to helpatl
  UPDATE events SET portal_id = helpatl_id
  WHERE source_id = (SELECT id FROM sources WHERE slug = 'fulton-county-meetings')
    AND portal_id = (SELECT id FROM portals WHERE slug = 'atlanta');

  -- Refresh materialized view
  REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
END $$;
