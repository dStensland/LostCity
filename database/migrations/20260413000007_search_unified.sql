-- Migration: Search Unified
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.

-- Ensure pg_trgm is available for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram indexes on searchable text columns
CREATE INDEX IF NOT EXISTS events_title_trgm_idx
  ON public.events USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS places_name_trgm_idx
  ON public.places USING gin (name gin_trgm_ops);

-- Performance: speed up the venue portal-scoping subquery
CREATE INDEX IF NOT EXISTS events_portal_place_active_idx
  ON public.events (portal_id, place_id)
  WHERE is_active = true AND place_id IS NOT NULL;

-- The unified search RPC: runs all retrievers (FTS, trigram) for
-- event + venue entity types inside a SINGLE connection via CTEs. Returns
-- tagged rows for Node-side demultiplexing into per-retriever candidate sets.
--
-- CRITICAL: p_portal_id is REQUIRED and enforced inside every CTE. This is
-- the single point of portal isolation. Regression-tested via pgTAP in the
-- next task.
--
-- Schema notes (see plan Task 7 "CRITICAL SCHEMA NOTES"):
--   events.place_id (not venue_id), events.portal_id (nullable), events.category_id TEXT
--   places (not venues) has NO portal_id — venue scoping uses a subquery through events
--
-- SCHEMA DEVIATION from original spec: the table is "places" not "venues".
-- events.place_id REFERENCES places(id) (confirmed by FK events_place_id_fkey).
-- places also has search_vector (all 6785 rows populated) — Phase 1 can add
-- an fts_venues/fts_places CTE. Trigram index renamed places_name_trgm_idx.
--
-- Organizers, series, festivals, programs, neighborhoods can be added as
-- additional CTEs in Phase 0 follow-up commits. The structure is uniform.

CREATE OR REPLACE FUNCTION public.search_unified(
  p_portal_id            uuid,        -- REQUIRED, NOT NULL
  p_query                text,
  p_types                text[],
  p_categories           text[] DEFAULT NULL,
  p_neighborhoods        text[] DEFAULT NULL,
  p_date_from            date DEFAULT NULL,
  p_date_to              date DEFAULT NULL,
  p_free_only            boolean DEFAULT false,
  p_limit_per_retriever  int     DEFAULT 30
)
RETURNS TABLE (
  retriever_id text,
  entity_type  text,
  entity_id    text,
  raw_score    real,
  quality      real,
  days_out     int,
  title        text,
  subtitle     text,
  image_url    text,
  href_slug    text,
  starts_at    timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $func$
DECLARE
  v_tsq tsquery;
  v_effective_limit int;
BEGIN
  IF p_portal_id IS NULL THEN
    RAISE EXCEPTION 'search_unified: p_portal_id required';
  END IF;

  -- Guard: clamp limit to protect against DoS
  v_effective_limit := LEAST(GREATEST(COALESCE(p_limit_per_retriever, 30), 1), 80);

  v_tsq := websearch_to_tsquery('simple', COALESCE(p_query, ''));

  RETURN QUERY
  WITH fts_events AS (
    SELECT
      'fts'::text AS retriever_id,
      'event'::text AS entity_type,
      e.id::text AS entity_id,
      ts_rank_cd(e.search_vector, v_tsq)::real AS raw_score,
      COALESCE(e.data_quality::real, 0.5) AS quality,
      GREATEST(0, EXTRACT(EPOCH FROM (e.start_date::timestamptz - now())) / 86400)::int AS days_out,
      e.title,
      v.name AS subtitle,
      e.image_url,
      e.id::text AS href_slug,
      e.start_date::timestamptz AS starts_at
    FROM public.events e
    LEFT JOIN public.places v ON v.id = e.place_id
    WHERE e.portal_id = p_portal_id
      AND 'event' = ANY(p_types)
      AND e.is_active = true
      AND (p_query = '' OR e.search_vector @@ v_tsq)
      AND (p_date_from IS NULL OR e.start_date >= p_date_from)
      AND (p_date_to   IS NULL OR e.start_date <  p_date_to)
      AND (p_categories IS NULL OR e.category_id = ANY(p_categories))
      AND (NOT p_free_only OR e.is_free IS TRUE)
    ORDER BY ts_rank_cd(e.search_vector, v_tsq) DESC
    LIMIT v_effective_limit
  ),
  trgm_events AS (
    SELECT
      'trigram'::text AS retriever_id,
      'event'::text AS entity_type,
      e.id::text AS entity_id,
      similarity(e.title, p_query)::real AS raw_score,
      COALESCE(e.data_quality::real, 0.5) AS quality,
      GREATEST(0, EXTRACT(EPOCH FROM (e.start_date::timestamptz - now())) / 86400)::int AS days_out,
      e.title,
      v.name AS subtitle,
      e.image_url,
      e.id::text AS href_slug,
      e.start_date::timestamptz AS starts_at
    FROM public.events e
    LEFT JOIN public.places v ON v.id = e.place_id
    WHERE e.portal_id = p_portal_id
      AND 'event' = ANY(p_types)
      AND e.is_active = true
      AND p_query <> ''
      AND e.title % p_query
      AND (p_date_from IS NULL OR e.start_date >= p_date_from)
      AND (p_date_to   IS NULL OR e.start_date <  p_date_to)
      AND (p_categories IS NULL OR e.category_id = ANY(p_categories))
    ORDER BY similarity(e.title, p_query) DESC
    LIMIT v_effective_limit
  ),
  -- Portal-scoped place universe: places referenced by at least one active
  -- event in this portal. This is how we enforce portal isolation without
  -- a places.portal_id column.
  portal_venues AS (
    SELECT DISTINCT e.place_id AS venue_id
    FROM public.events e
    WHERE e.portal_id = p_portal_id
      AND e.is_active = true
      AND e.place_id IS NOT NULL
  ),
  trgm_venues AS (
    SELECT
      'trigram'::text AS retriever_id,
      'venue'::text AS entity_type,
      v.id::text AS entity_id,
      similarity(v.name, p_query)::real AS raw_score,
      0.5::real AS quality,  -- places don't have data_quality; use neutral default
      0::int AS days_out,
      v.name AS title,
      v.neighborhood AS subtitle,
      v.image_url,
      v.slug AS href_slug,
      NULL::timestamptz AS starts_at
    FROM public.places v
    WHERE v.id IN (SELECT venue_id FROM portal_venues)
      AND 'venue' = ANY(p_types)
      AND p_query <> ''
      AND v.name % p_query
    ORDER BY similarity(v.name, p_query) DESC
    LIMIT v_effective_limit
  )
  SELECT * FROM fts_events
  UNION ALL SELECT * FROM trgm_events
  UNION ALL SELECT * FROM trgm_venues;
END $func$;

REVOKE ALL ON FUNCTION public.search_unified(uuid, text, text[], text[], text[], date, date, boolean, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_unified(uuid, text, text[], text[], text[], date, date, boolean, int) TO authenticated, anon, service_role;

COMMENT ON FUNCTION public.search_unified(uuid, text, text[], text[], text[], date, date, boolean, int) IS
  'Unified search retrieval. Runs FTS + trigram across events + places as CTEs in one connection. Portal-isolated: events via e.portal_id, venues via portal_venues CTE (distinct place_ids from portal events). Table is "places" (not "venues") — schema deviation from original spec. Extend by adding CTEs + UNION ALL clauses.';
