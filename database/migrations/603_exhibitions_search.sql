-- Migration: search_exhibitions_ranked RPC function
--
-- Adds full-text + trigram search for exhibitions entities.
-- Exhibitions are Arts portal entities (Lost City: Arts).
-- Portal scoping: optional — exhibitions can appear in base-portal searches.
--
-- Join uses places (renamed from venues) and place_id (renamed from venue_id).
-- Currently-showing boost: closing_date >= CURRENT_DATE ranks higher.
-- ============================================================================

-- -------------------------------------------------------
-- 1. search_exhibitions_ranked RPC
-- -------------------------------------------------------

CREATE OR REPLACE FUNCTION search_exhibitions_ranked(
  p_query TEXT,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_portal_id UUID DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  title TEXT,
  slug TEXT,
  description TEXT,
  image_url TEXT,
  opening_date DATE,
  closing_date DATE,
  exhibition_type TEXT,
  admission_type TEXT,
  place_id INTEGER,
  venue_name TEXT,
  venue_neighborhood TEXT,
  combined_score REAL
) AS $$
DECLARE
  v_tsquery tsquery;
  v_search_terms TEXT;
BEGIN
  v_search_terms := regexp_replace(trim(p_query), '\s+', ' & ', 'g') || ':*';
  v_tsquery := to_tsquery('english', v_search_terms);

  RETURN QUERY
  SELECT
    e.id,
    e.title,
    e.slug,
    e.description,
    e.image_url,
    e.opening_date,
    e.closing_date,
    e.exhibition_type,
    e.admission_type,
    e.place_id,
    v.name AS venue_name,
    v.neighborhood AS venue_neighborhood,
    (
      -- Base text relevance
      (
        ts_rank_cd(
          to_tsvector('english',
            COALESCE(e.title, '') || ' ' ||
            COALESCE(e.description, '')
          ),
          v_tsquery,
          32
        ) * 0.7 +
        similarity(e.title, p_query) * 0.3 +
        CASE WHEN lower(e.title) = lower(p_query) THEN 1.0 ELSE 0 END +
        CASE WHEN lower(e.title) LIKE lower(p_query) || '%' THEN 0.5 ELSE 0 END
      )
      -- Currently-showing boost
      * CASE
          WHEN e.closing_date IS NULL THEN 1.2
          WHEN e.closing_date >= CURRENT_DATE THEN 1.4
          ELSE 0.6
        END
      -- Data completeness multiplier
      * (0.7
          + CASE WHEN e.description IS NOT NULL AND length(e.description) > 50 THEN 0.1 ELSE 0 END
          + CASE WHEN e.image_url IS NOT NULL THEN 0.1 ELSE 0 END
          + CASE WHEN e.place_id IS NOT NULL THEN 0.1 ELSE 0 END
        )
    )::REAL AS combined_score
  FROM exhibitions e
  LEFT JOIN places v ON e.place_id = v.id
  WHERE
    e.is_active = true
    AND (
      to_tsvector('english',
        COALESCE(e.title, '') || ' ' ||
        COALESCE(e.description, '')
      ) @@ v_tsquery
      OR similarity(e.title, p_query) > 0.2
    )
    AND (
      p_portal_id IS NULL
      OR e.portal_id = p_portal_id
    )
  ORDER BY combined_score DESC, e.closing_date ASC NULLS LAST, e.title ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_exhibitions_ranked(text, integer, integer, uuid)
IS 'Full-text + trigram search for exhibitions with currently-showing boost and data-quality scoring. Portal-scoped optional. 2026-04-10.';
