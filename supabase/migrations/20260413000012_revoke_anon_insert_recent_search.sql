-- =============================================================================
-- Belt-and-suspenders: explicit REVOKE EXECUTE FROM anon on insert_recent_search
--
-- Context: Finding 3 (docs/search-phase-0-crawler-findings.md) documents the
-- Supabase gotcha where `REVOKE ALL ON FUNCTION ... FROM PUBLIC` does NOT
-- remove the direct grant Supabase platform tooling pre-provisions to the
-- `anon` role. The fix is an explicit `REVOKE EXECUTE ... FROM anon`.
--
-- Migration 20260413000008 added this for `search_unified`. Migration 6, which
-- created `insert_recent_search`, predates the discovery and only includes
-- `REVOKE ALL FROM PUBLIC`. The anon grant was therefore still in place.
--
-- In-body impact is zero: the function RAISEs on `auth.uid() IS NULL` (from
-- migration 20260413000009), so anon callers hit the wall before any row is
-- written. This migration closes the outer grant for defense in depth and
-- brings insert_recent_search in line with the search_unified grant pattern.
--
-- Safe to apply at any time. No data changes. No downtime.
-- =============================================================================

REVOKE EXECUTE ON FUNCTION public.insert_recent_search(
  uuid, text, jsonb, int
) FROM anon;

COMMENT ON FUNCTION public.insert_recent_search(uuid, text, jsonb, int) IS
  'Write-once recent-search insertion. Enforces auth.uid() = p_user_id inside '
  'the function body (migration ...9). REVOKE EXECUTE FROM anon explicitly '
  'applied (migration ...12) to close the Supabase platform anon-grant default.';
