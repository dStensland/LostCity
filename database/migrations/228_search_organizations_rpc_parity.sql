-- Migration 228: Search RPC parity for organizations after producer -> organization rename.
-- Ensures modern search clients can call search_organizations_ranked safely.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

DROP FUNCTION IF EXISTS search_organizations_ranked(TEXT, INTEGER, INTEGER, TEXT[], TEXT[]);

CREATE OR REPLACE FUNCTION search_organizations_ranked(
    p_query TEXT,
    p_limit INTEGER DEFAULT 10,
    p_offset INTEGER DEFAULT 0,
    p_org_types TEXT[] DEFAULT NULL,
    p_categories TEXT[] DEFAULT NULL
)
RETURNS TABLE(
    id TEXT,
    name TEXT,
    slug TEXT,
    org_type TEXT,
    categories TEXT[],
    neighborhood TEXT,
    description TEXT,
    logo_url TEXT,
    website TEXT,
    instagram TEXT,
    total_events_tracked INTEGER,
    ts_rank REAL,
    similarity_score REAL,
    combined_score REAL
) AS $$
DECLARE
    v_tsquery tsquery;
    v_search_terms TEXT;
BEGIN
    v_search_terms := regexp_replace(trim(COALESCE(p_query, '')), '\\s+', ' & ', 'g') || ':*';
    v_tsquery := to_tsquery('english', v_search_terms);

    RETURN QUERY
    WITH org_search AS (
      SELECT
        o.*,
        (
          setweight(to_tsvector('english', COALESCE(o.name, '')), 'A') ||
          setweight(to_tsvector('english', COALESCE(array_to_string(o.categories, ' '), '')), 'B') ||
          setweight(to_tsvector('english', COALESCE(o.org_type, '')), 'B') ||
          setweight(to_tsvector('english', COALESCE(o.neighborhood, '')), 'C') ||
          setweight(to_tsvector('english', COALESCE(o.description, '')), 'C')
        ) AS computed_vector
      FROM organizations o
      WHERE COALESCE(o.hidden, false) = false
    )
    SELECT
      os.id,
      os.name,
      os.slug,
      os.org_type,
      os.categories,
      os.neighborhood,
      os.description,
      os.logo_url,
      os.website,
      os.instagram,
      os.total_events_tracked,
      ts_rank_cd(os.computed_vector, v_tsquery, 32)::REAL AS ts_rank,
      similarity(os.name, p_query)::REAL AS similarity_score,
      (
        ts_rank_cd(os.computed_vector, v_tsquery, 32) * 0.5 +
        similarity(os.name, p_query) * 0.5 +
        CASE WHEN lower(os.name) = lower(p_query) THEN 1.0 ELSE 0 END +
        CASE WHEN lower(os.name) LIKE lower(p_query) || '%' THEN 0.5 ELSE 0 END
      )::REAL AS combined_score
    FROM org_search os
    WHERE
      (os.computed_vector @@ v_tsquery OR similarity(os.name, p_query) > 0.2)
      AND (p_org_types IS NULL OR os.org_type = ANY(p_org_types))
      AND (p_categories IS NULL OR os.categories && p_categories)
    ORDER BY combined_score DESC, os.total_events_tracked DESC NULLS LAST, os.name ASC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_organizations_ranked IS 'Full-text search for organizations/organizers with relevance ranking.';

-- Keep old RPC name working for legacy clients.
CREATE OR REPLACE FUNCTION search_producers_ranked(
    p_query TEXT,
    p_limit INTEGER DEFAULT 10,
    p_offset INTEGER DEFAULT 0,
    p_org_types TEXT[] DEFAULT NULL,
    p_categories TEXT[] DEFAULT NULL
)
RETURNS TABLE(
    id TEXT,
    name TEXT,
    slug TEXT,
    org_type TEXT,
    categories TEXT[],
    neighborhood TEXT,
    description TEXT,
    logo_url TEXT,
    website TEXT,
    instagram TEXT,
    total_events_tracked INTEGER,
    ts_rank REAL,
    similarity_score REAL,
    combined_score REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM search_organizations_ranked(
    p_query,
    p_limit,
    p_offset,
    p_org_types,
    p_categories
  );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_producers_ranked IS 'Backward-compatible alias for search_organizations_ranked.';
