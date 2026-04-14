-- Remediation Sprint B (R3): Close self-auth gap in insert_recent_search.
-- Security reviewer finding: the function is SECURITY DEFINER and granted to
-- `authenticated`, but never checks auth.uid() against p_user_id. A malicious
-- authenticated JWT could write recent-search history for any user via
-- direct PostgREST call to /rest/v1/rpc/insert_recent_search.
--
-- Fix: verify the authenticated caller is writing their OWN history. This is
-- defense in depth — the route handler (Task 29) is also expected to enforce
-- this, but the function should not trust its caller.

CREATE OR REPLACE FUNCTION public.insert_recent_search(
  p_user_id  uuid,
  p_query    text,
  p_filters  jsonb,
  p_max_rows int
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Defense in depth: only the authenticated user may write their own history.
  -- auth.uid() reads the `sub` claim from the current session's JWT. We
  -- explicitly REJECT (not bypass) any caller without a JWT — including
  -- service_role, which has no `sub` claim and therefore returns NULL from
  -- auth.uid(). If trusted backend code ever needs to seed rows, it must do
  -- a direct INSERT into user_recent_searches rather than calling this RPC.
  -- The Phase 0 caller is /api/user/recent-searches, which goes through
  -- withAuth and passes the verified user.id as p_user_id.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'insert_recent_search: unauthenticated caller';
  END IF;
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'insert_recent_search: caller may only write own history';
  END IF;

  -- Existing bounds checks
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'insert_recent_search: p_user_id required';
  END IF;
  IF char_length(p_query) < 1 OR char_length(p_query) > 120 THEN
    RAISE EXCEPTION 'insert_recent_search: query length out of bounds';
  END IF;
  IF p_max_rows < 1 OR p_max_rows > 100 THEN
    RAISE EXCEPTION 'insert_recent_search: p_max_rows out of bounds';
  END IF;

  INSERT INTO public.user_recent_searches (user_id, query, filters)
  VALUES (p_user_id, p_query, p_filters);

  DELETE FROM public.user_recent_searches
  WHERE user_id = p_user_id
    AND id NOT IN (
      SELECT id FROM public.user_recent_searches
      WHERE user_id = p_user_id
      ORDER BY created_at DESC
      LIMIT p_max_rows
    );
END $$;

-- Grants are preserved from the original migration (authenticated, service_role).
-- Note: this does NOT relax the grant — any caller without auth.uid() is
-- rejected at the top of the function body.
