-- get_right_now_feed RPC — final definition (with venue_name + GRANT)
-- Consolidated from supabase migrations 20260329100000..20260329100002

DROP FUNCTION IF EXISTS get_right_now_feed(UUID, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION get_right_now_feed(
  p_portal_id UUID DEFAULT NULL,
  p_city TEXT DEFAULT 'Atlanta',
  p_limit INTEGER DEFAULT 6
)
RETURNS TABLE (
  entity_type TEXT,
  id INTEGER,
  name TEXT,
  slug TEXT,
  image_url TEXT,
  place_type TEXT,
  neighborhood TEXT,
  venue_name TEXT,
  start_date DATE,
  start_time TIME,
  category_id TEXT,
  is_free BOOLEAN,
  price_min NUMERIC,
  is_open BOOLEAN,
  closes_at TEXT,
  google_rating NUMERIC,
  google_rating_count INTEGER,
  short_description TEXT,
  relevance_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH upcoming_events AS (
    SELECT
      'event'::TEXT AS entity_type,
      e.id,
      e.title AS name,
      e.id::TEXT AS slug,
      COALESCE(e.image_url, p.image_url) AS image_url,
      p.place_type,
      p.neighborhood,
      p.name AS venue_name,
      e.start_date,
      e.start_time,
      e.category_id,
      e.is_free,
      e.price_min,
      FALSE AS is_open,
      NULL::TEXT AS closes_at,
      NULL::NUMERIC AS google_rating,
      NULL::INTEGER AS google_rating_count,
      NULL::TEXT AS short_description,
      (1.0 - LEAST(EXTRACT(EPOCH FROM (e.start_date + e.start_time - NOW())) / 10800.0, 1.0))::NUMERIC AS relevance_score
    FROM events e
    JOIN places p ON p.id = e.place_id
    WHERE e.start_date = CURRENT_DATE
      AND e.start_time IS NOT NULL
      AND e.start_time > (CURRENT_TIME - INTERVAL '1 hour')
      AND e.start_time < (CURRENT_TIME + INTERVAL '3 hours')
      AND e.is_feed_ready = TRUE
      AND p.city ILIKE p_city || '%'
      AND (
        p_portal_id IS NULL
        OR e.portal_id = p_portal_id
        OR e.portal_id IS NULL
      )
    ORDER BY relevance_score DESC
    LIMIT 10
  ),
  open_places AS (
    SELECT
      'place'::TEXT AS entity_type,
      p.id,
      p.name,
      p.slug,
      COALESCE(pp.hero_image_url, p.image_url) AS image_url,
      p.place_type,
      p.neighborhood,
      NULL::TEXT AS venue_name,
      NULL::DATE AS start_date,
      NULL::TIME AS start_time,
      NULL::TEXT AS category_id,
      NULL::BOOLEAN AS is_free,
      NULL::NUMERIC AS price_min,
      TRUE AS is_open,
      NULL::TEXT AS closes_at,
      (pvd.google->>'rating')::NUMERIC AS google_rating,
      (pvd.google->>'rating_count')::INTEGER AS google_rating_count,
      p.short_description,
      0.5::NUMERIC AS relevance_score
    FROM places p
    LEFT JOIN place_profile pp ON pp.place_id = p.id
    LEFT JOIN place_vertical_details pvd ON pvd.place_id = p.id
    WHERE p.is_active != FALSE
      AND p.city ILIKE p_city || '%'
      AND p.hours IS NOT NULL
      AND p.place_type IS NOT NULL
    ORDER BY relevance_score DESC
    LIMIT 10
  ),
  combined AS (
    SELECT * FROM upcoming_events
    UNION ALL
    SELECT * FROM open_places
  )
  SELECT * FROM combined
  ORDER BY relevance_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_right_now_feed TO anon, authenticated;
