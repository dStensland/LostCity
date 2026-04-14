-- Migration: Search Events
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.

-- Search observability log. Records query telemetry without PII.
-- CRITICAL: this table does NOT store user_id. Only user_segment ('anon' | 'authed').
-- Justification: eliminates GDPR right-to-erasure cascade and insider-threat surface.

CREATE TABLE IF NOT EXISTS public.search_events (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at          timestamptz NOT NULL DEFAULT now(),
  portal_slug          text        NOT NULL,
  locale               text        NOT NULL DEFAULT 'en',
  user_segment         text        NOT NULL CHECK (user_segment IN ('anon', 'authed')),
  query_hash           bytea       NOT NULL,
  query_length         int         NOT NULL,
  query_word_count     int         NOT NULL,
  intent_type          text,
  filters_json         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  cache_hit            text        NOT NULL CHECK (cache_hit IN ('fresh', 'stale', 'miss')),
  degraded             boolean     NOT NULL DEFAULT false,
  retriever_breakdown  jsonb       NOT NULL DEFAULT '{}'::jsonb,
  result_count         int         NOT NULL,
  result_type_counts   jsonb       NOT NULL DEFAULT '{}'::jsonb,
  top_matches_types    text[]      NOT NULL DEFAULT ARRAY[]::text[],
  zero_result          boolean     NOT NULL,
  total_ms             int         NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_search_events_portal_time
  ON public.search_events (portal_slug, occurred_at DESC);

CREATE INDEX IF NOT EXISTS ix_search_events_hash
  ON public.search_events (query_hash);

CREATE INDEX IF NOT EXISTS ix_search_events_zero_result
  ON public.search_events (portal_slug, occurred_at DESC)
  WHERE zero_result = true;

COMMENT ON TABLE public.search_events IS
  'Search telemetry. 30-day retention. No user_id by design. See docs/superpowers/specs/2026-04-13-search-elevation-design.md §3.6';

-- Click events are a separate table: many clicks can follow one search
CREATE TABLE IF NOT EXISTS public.search_click_events (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  search_event_id   uuid        NOT NULL REFERENCES public.search_events(id) ON DELETE CASCADE,
  clicked_at        timestamptz NOT NULL DEFAULT now(),
  position          smallint    NOT NULL,
  result_type       text        NOT NULL,
  result_id         text        NOT NULL,
  primary_retriever text        NOT NULL,
  conversion_type   text        CHECK (conversion_type IN ('click', 'save', 'rsvp', 'plan')),
  dwell_ms          integer
);

CREATE INDEX IF NOT EXISTS ix_search_click_events_search_id
  ON public.search_click_events (search_event_id);

CREATE INDEX IF NOT EXISTS ix_search_click_events_time
  ON public.search_click_events (clicked_at DESC);
