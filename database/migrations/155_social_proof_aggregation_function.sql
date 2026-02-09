-- Migration: Add database function for efficient social proof aggregation
-- Replaces N individual row fetches with a single aggregated query
-- Performance: Reduces DB load from 2 queries fetching all rows to 1 query returning counts

-- Function to get social proof counts for multiple events in a single query
CREATE OR REPLACE FUNCTION get_social_proof_counts(event_ids int[])
RETURNS TABLE(
  event_id int,
  going_count bigint,
  interested_count bigint,
  recommendation_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH rsvp_counts AS (
    SELECT
      event_id,
      COUNT(*) FILTER (WHERE status = 'going') as going_count,
      COUNT(*) FILTER (WHERE status = 'interested') as interested_count
    FROM event_rsvps
    WHERE event_id = ANY(event_ids)
      AND status IN ('going', 'interested')
      AND visibility = 'public'
    GROUP BY event_id
  ),
  rec_counts AS (
    SELECT
      event_id,
      COUNT(*) as recommendation_count
    FROM recommendations
    WHERE event_id = ANY(event_ids)
      AND event_id IS NOT NULL
      AND visibility = 'public'
    GROUP BY event_id
  )
  SELECT
    e.id as event_id,
    COALESCE(r.going_count, 0) as going_count,
    COALESCE(r.interested_count, 0) as interested_count,
    COALESCE(rec.recommendation_count, 0) as recommendation_count
  FROM unnest(event_ids) e(id)
  LEFT JOIN rsvp_counts r ON r.event_id = e.id
  LEFT JOIN rec_counts rec ON rec.event_id = e.id
$$;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION get_social_proof_counts(int[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_social_proof_counts(int[]) TO service_role;

-- Add comment explaining the function
COMMENT ON FUNCTION get_social_proof_counts(int[]) IS
'Efficiently aggregates social proof counts (RSVPs and recommendations) for multiple events.
Returns going_count, interested_count, and recommendation_count per event.
Used to replace N+1 query pattern in enrichEventsWithSocialProof.';
