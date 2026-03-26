-- RPC: get_portal_artists
-- Returns visual artists visible to a portal, with portal-scoped exhibition counts.
-- Join path: artists → exhibition_artists → exhibitions (filtered by source_id).

CREATE OR REPLACE FUNCTION get_portal_artists(
  p_portal_id UUID,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0,
  p_discipline TEXT DEFAULT 'visual_artist',
  p_q TEXT DEFAULT NULL,
  p_medium TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  discipline TEXT,
  bio TEXT,
  image_url TEXT,
  website TEXT,
  is_verified BOOLEAN,
  exhibition_count BIGINT,
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH accessible_sources AS (
    SELECT psa.source_id
    FROM portal_source_access psa
    WHERE psa.portal_id = p_portal_id
  ),
  portal_exhibitions AS (
    SELECT e.id AS exhibition_id, ea.artist_id
    FROM exhibitions e
    JOIN exhibition_artists ea ON ea.exhibition_id = e.id
    WHERE e.source_id IN (SELECT source_id FROM accessible_sources)
      AND e.is_active = true
      AND ea.artist_id IS NOT NULL
      AND (p_medium IS NULL OR e.medium = p_medium)
  ),
  artist_stats AS (
    SELECT
      pe.artist_id,
      COUNT(DISTINCT pe.exhibition_id) AS ex_count
    FROM portal_exhibitions pe
    GROUP BY pe.artist_id
  )
  SELECT
    a.id,
    a.name,
    a.slug,
    a.discipline,
    a.bio,
    a.image_url,
    a.website,
    a.is_verified,
    COALESCE(ast.ex_count, 0) AS exhibition_count,
    COUNT(*) OVER() AS total_count
  FROM artists a
  JOIN artist_stats ast ON ast.artist_id = a.id
  WHERE (p_discipline IS NULL OR a.discipline = p_discipline)
    AND (p_q IS NULL OR a.name ILIKE '%' || p_q || '%')
  ORDER BY ast.ex_count DESC, a.name ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Grant execute to anon and authenticated roles
GRANT EXECUTE ON FUNCTION get_portal_artists TO anon, authenticated;
