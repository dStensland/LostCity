-- Migration: User Recent Searches
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.

CREATE TABLE IF NOT EXISTS public.user_recent_searches (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query      text NOT NULL CHECK (char_length(query) BETWEEN 1 AND 120),
  filters    jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_user_recent_searches_user_created
  ON public.user_recent_searches (user_id, created_at DESC);

COMMENT ON TABLE public.user_recent_searches IS
  'Server-side recent searches for cross-device sync. GDPR: ON DELETE CASCADE on user_id FK to auth.users automatically wipes rows on account deletion.';

-- Atomic insert + rotation (keep last N per user, discard older)
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

REVOKE ALL ON FUNCTION public.insert_recent_search(uuid, text, jsonb, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_recent_search(uuid, text, jsonb, int) TO authenticated, service_role;

