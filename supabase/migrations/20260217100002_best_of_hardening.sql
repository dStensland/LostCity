-- ============================================================================
-- Best Of Hardening: RPCs for aggregation, matview refresh, nomination quota,
-- composite index, missing RLS policies
-- ============================================================================

-- 1. RPC: Vote counts grouped by category (replaces unbounded row scan)
CREATE OR REPLACE FUNCTION best_of_vote_counts_by_category(p_category_ids uuid[])
RETURNS TABLE(category_id uuid, vote_count bigint) AS $$
  SELECT v.category_id, COUNT(*) as vote_count
  FROM best_of_votes v
  WHERE v.category_id = ANY(p_category_ids)
  GROUP BY v.category_id;
$$ LANGUAGE sql STABLE;

-- 2. RPC: Vote counts grouped by venue for a single category
CREATE OR REPLACE FUNCTION best_of_vote_counts_by_venue(p_category_id uuid)
RETURNS TABLE(venue_id integer, vote_count bigint) AS $$
  SELECT v.venue_id, COUNT(*) as vote_count
  FROM best_of_votes v
  WHERE v.category_id = p_category_id
  GROUP BY v.venue_id;
$$ LANGUAGE sql STABLE;

-- 3. RPC: Total vote count for a category
CREATE OR REPLACE FUNCTION best_of_total_votes(p_category_id uuid)
RETURNS bigint AS $$
  SELECT COUNT(*) FROM best_of_votes WHERE category_id = p_category_id;
$$ LANGUAGE sql STABLE;

-- 4. RPC: Top case per venue (window function, returns only rank=1)
CREATE OR REPLACE FUNCTION best_of_top_cases(p_category_id uuid)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  venue_id integer,
  content text,
  upvote_count integer,
  created_at timestamptz
) AS $$
  SELECT c.id, c.user_id, c.venue_id, c.content, c.upvote_count, c.created_at
  FROM (
    SELECT *,
      ROW_NUMBER() OVER (PARTITION BY bc.venue_id ORDER BY bc.upvote_count DESC, bc.created_at ASC) as rn
    FROM best_of_cases bc
    WHERE bc.category_id = p_category_id AND bc.status = 'approved'
  ) c
  WHERE c.rn = 1;
$$ LANGUAGE sql STABLE;

-- 5. RPC: Case count per venue for a category
CREATE OR REPLACE FUNCTION best_of_case_counts(p_category_id uuid)
RETURNS TABLE(venue_id integer, case_count bigint, upvote_sum bigint) AS $$
  SELECT c.venue_id, COUNT(*) as case_count, COALESCE(SUM(c.upvote_count), 0) as upvote_sum
  FROM best_of_cases c
  WHERE c.category_id = p_category_id AND c.status = 'approved'
  GROUP BY c.venue_id;
$$ LANGUAGE sql STABLE;

-- 6. Composite index for sorted case retrieval
CREATE INDEX IF NOT EXISTS idx_best_of_cases_category_status_upvotes
  ON best_of_cases(category_id, status, upvote_count DESC);

-- 7. Missing RLS UPDATE policy for votes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'best_of_votes'
      AND policyname = 'best_of_votes_update'
  ) THEN
    CREATE POLICY best_of_votes_update ON best_of_votes
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- 8. Missing RLS UPDATE/DELETE policies for nominations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'best_of_nominations'
      AND policyname = 'best_of_nominations_update'
  ) THEN
    CREATE POLICY best_of_nominations_update ON best_of_nominations
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'best_of_nominations'
      AND policyname = 'best_of_nominations_delete'
  ) THEN
    CREATE POLICY best_of_nominations_delete ON best_of_nominations
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- 9. Index for per-user nomination quota check (category_id + user_id)
CREATE INDEX IF NOT EXISTS idx_best_of_nominations_user_category
  ON best_of_nominations(category_id, user_id);

-- 10. Matview refresh — schedule via pg_cron if available
-- Note: pg_cron must be enabled in Supabase dashboard (Database > Extensions)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM cron.job
      WHERE jobname = 'refresh-best-of-scores'
    ) THEN
      PERFORM cron.schedule(
        'refresh-best-of-scores',
        '*/30 * * * *',
        'REFRESH MATERIALIZED VIEW CONCURRENTLY best_of_venue_scores'
      );
    END IF;
  END IF;
END $$;
