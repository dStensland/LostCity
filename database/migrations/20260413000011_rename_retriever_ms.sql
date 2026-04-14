-- Migration: Add retrieve_total_ms scalar column to search_events
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
--
-- Context: the original schema (20260413000005) stored retrieval timing in
-- `retriever_breakdown jsonb` plus the mis-named diagnostic scalar
-- `retriever_ms` which the service was stuffing into the jsonb as
-- `{ fts: <total> }` — misleading because the number is the TOTAL of all
-- retriever work, not an fts-only measure.
--
-- Sprint E-3.1 fixes the TypeScript field to `retrieve_total_ms` and adds
-- a scalar column here so we can chart aggregate retrieval latency directly
-- without jsonb path extraction. The old `retriever_breakdown` jsonb column
-- is retained for future per-retriever measurements (currently unused in
-- Phase 0 — emits an empty {} object).
--
-- Nullable to allow streaming reads from pre-migration rows without backfill.

ALTER TABLE public.search_events
  ADD COLUMN IF NOT EXISTS retrieve_total_ms int;

COMMENT ON COLUMN public.search_events.retrieve_total_ms IS
  'Total wall-clock ms spent in the retrieval phase (sum of all retriever + RPC work). Scalar replacement for the old retriever_ms-as-map anti-pattern.';
