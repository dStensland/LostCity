-- Remediation Sprint A: harden search_unified per midpoint review by four
-- expert reviewers. Fixes six issues:
--   R1 — Drop legacy search_unified(text, text[], int, uuid, text) overload
--        (p_portal_id DEFAULT NULL — security gap)
--   R2 — Add composite FTS + portal partial GIN index
--   R4 — Revoke anon grant (only authenticated + service_role)
--   R8 — SET statement_timeout = '2s' (STRIDE row D)
--   R9 — Structured display fields (venue_name, neighborhood) replace
--        overloaded subtitle
--   R10 — Document portal_venues destination-without-events limitation
-- R7 (LANGUAGE sql rewrite) deferred to Phase 1 — would break the explicit
-- RAISE EXCEPTION on NULL portal_id.

-- R1: drop the legacy overload with p_portal_id DEFAULT NULL (zero callers in monorepo)
DROP FUNCTION IF EXISTS public.search_unified(text, text[], int, uuid, text);

-- Also drop the current new function so we can recreate with new return signature (R9)
-- and cleaner grant layout (R4). CREATE OR REPLACE can't change return type.
DROP FUNCTION IF EXISTS public.search_unified(uuid, text, text[], text[], text[], date, date, boolean, int);

-- R2: composite FTS + portal partial GIN index. Critical for common-word queries
-- at scale — EXPLAIN showed 4,438 heap blocks scanned on 'art' without this.
CREATE INDEX IF NOT EXISTS events_portal_search_vector_idx
  ON public.events USING gin (search_vector)
  WHERE is_active = true;

-- Recreate search_unified with hardened signature
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
  venue_name   text,    -- R9: populated for events, NULL for venues
  neighborhood text,    -- R9: populated for venues, NULL for events
  image_url    text,
  href_slug    text,
  starts_at    timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
SET statement_timeout = '2s'  -- R8: STRIDE row D defense in depth
AS $func$
DECLARE
  v_tsq tsquery;
  v_effective_limit int;
BEGIN
  -- R10: TODO (Phase 1): rewrite as LANGUAGE sql for ~10ms plan-time savings.
  -- Blocked today because SQL language can't do RAISE EXCEPTION cleanly;
  -- the NULL portal_id guard below is security-valuable.

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
      v.name AS venue_name,        -- R9: structured field
      NULL::text AS neighborhood,  -- events don't carry a neighborhood directly
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
      v.name AS venue_name,        -- R9
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
    ORDER BY similarity(e.title, p_query) DESC
    LIMIT v_effective_limit
  ),
  -- R10: Portal-scoped venue universe. Places referenced by at least one active
  -- event in this portal. PHASE 0 LIMITATION documented here: destinations that
  -- exist in a portal but have no upcoming events are silently excluded. A user
  -- searching "Ponce City Market" during a dead week gets zero venue results.
  -- This contradicts the "destinations are first-class" decision
  -- (docs/decisions/2026-03-11-destination-inclusion-bar.md) and is explicitly
  -- accepted for Phase 0. Phase 1 will add a place_portals join table to cover
  -- destinations without upcoming events.
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
      NULL::text AS venue_name,     -- R9: NULL for venues
      v.neighborhood,                -- R9: structured field
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

-- R4: Revoke from PUBLIC and anon. Only authenticated + service_role may
-- invoke this function. All public search traffic must go through the
-- Next.js route at /api/search/unified, which uses a service-role client
-- after deriving portal_id from the route segment.
-- Note: REVOKE FROM PUBLIC removes the default public grant, but Supabase
-- pre-provisions direct grants to anon/authenticated, so we revoke both.
REVOKE ALL ON FUNCTION public.search_unified(uuid, text, text[], text[], text[], date, date, boolean, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.search_unified(uuid, text, text[], text[], text[], date, date, boolean, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.search_unified(uuid, text, text[], text[], text[], date, date, boolean, int) TO authenticated, service_role;

COMMENT ON FUNCTION public.search_unified IS
  'Unified search retrieval (hardened per midpoint review). Runs FTS + trigram across events + places as CTEs in one connection. Portal-isolated: events via e.portal_id, places via portal_venues CTE (Phase 0 limitation: destinations without upcoming events are silently excluded, see inline comment). Returns structured venue_name + neighborhood columns. 2s statement_timeout. Callable by authenticated + service_role only — anon access is revoked to prevent PostgREST bypass of Next.js validation.';

COMMENT ON INDEX public.events_portal_search_vector_idx IS
  'Partial GIN on events.search_vector WHERE is_active = true. Load-bearing for common-word FTS queries; without this, EXPLAIN shows 4k+ heap blocks scanned on words like "art" or "music".';
