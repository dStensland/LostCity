-- Migration: Search Unified Filters
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.

-- Sprint E-1.1: Wire p_neighborhoods into the search_unified CTEs.
--
-- Root cause: the function accepted p_neighborhoods as a parameter but the
-- body never referenced it. Every neighborhood filter chip in the UI was a
-- silent no-op. The events CTEs already join to public.places (aliased v)
-- via e.place_id — neighborhood filtering adds one WHERE clause on v.neighborhood
-- in each event CTE, and the same clause on v.neighborhood in trgm_venues.
--
-- Verification: all other filter params (p_categories, p_date_from, p_date_to,
-- p_free_only) are confirmed present in migration 20260413000008 and are
-- preserved here without change. The signature, RAISE EXCEPTION guard,
-- plpgsql language, return type, and grant structure are unchanged.

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
  venue_name   text,    -- populated for events, NULL for venues
  neighborhood text,    -- populated for venues, NULL for events
  image_url    text,
  href_slug    text,
  starts_at    timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
SET statement_timeout = '2s'
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
      v.name AS venue_name,        -- structured field (R9)
      NULL::text AS neighborhood,  -- events don't carry neighborhood directly
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
      AND (p_neighborhoods IS NULL OR v.neighborhood = ANY(p_neighborhoods))
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
      v.name AS venue_name,        -- structured field (R9)
      NULL::text AS neighborhood,
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
      AND (p_neighborhoods IS NULL OR v.neighborhood = ANY(p_neighborhoods))
    ORDER BY similarity(e.title, p_query) DESC
    LIMIT v_effective_limit
  ),
  -- Portal-scoped venue universe. Places referenced by at least one active
  -- event in this portal. PHASE 0 LIMITATION: destinations without upcoming
  -- events are silently excluded. Phase 1 will add a place_portals join table.
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
      0.5::real AS quality,
      0::int AS days_out,
      v.name AS title,
      NULL::text AS venue_name,     -- NULL for venues
      v.neighborhood,               -- structured field (R9)
      v.image_url,
      v.slug AS href_slug,
      NULL::timestamptz AS starts_at
    FROM public.places v
    WHERE v.id IN (SELECT venue_id FROM portal_venues)
      AND 'venue' = ANY(p_types)
      AND p_query <> ''
      AND v.name % p_query
      AND (p_neighborhoods IS NULL OR v.neighborhood = ANY(p_neighborhoods))
    ORDER BY similarity(v.name, p_query) DESC
    LIMIT v_effective_limit
  )
  SELECT * FROM fts_events
  UNION ALL SELECT * FROM trgm_events
  UNION ALL SELECT * FROM trgm_venues;
END $func$;

-- Grants: preserve exactly from migration 20260413000008
REVOKE ALL ON FUNCTION public.search_unified(uuid, text, text[], text[], text[], date, date, boolean, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.search_unified(uuid, text, text[], text[], text[], date, date, boolean, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.search_unified(uuid, text, text[], text[], text[], date, date, boolean, int) TO authenticated, service_role;

COMMENT ON FUNCTION public.search_unified IS
  'Unified search retrieval. Runs FTS + trigram across events + places as CTEs in one connection. Portal-isolated: events via e.portal_id, places via portal_venues CTE. Returns structured venue_name + neighborhood columns. Filters: p_categories, p_neighborhoods (Sprint E-1.1 fix — was accepted but ignored before this migration), p_date_from, p_date_to, p_free_only, p_types. 2s statement_timeout. Callable by authenticated + service_role only.';
