-- Migration: Source Quality Dashboard
-- PRD 027 Phase 5: Operational visibility layer for the feed quality gate.
--
-- Creates get_source_quality_metrics() RPC function that aggregates per-source
-- held-event rates and data-completeness stats for upcoming events.
-- Intended for the admin portal only — requires service role or admin auth.

-- DOWN: DROP FUNCTION IF EXISTS get_source_quality_metrics(integer, date);

CREATE OR REPLACE FUNCTION get_source_quality_metrics(
  p_min_events INTEGER DEFAULT 1,
  p_start_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  source_id        INTEGER,
  source_name      TEXT,
  source_slug      TEXT,
  is_active        BOOLEAN,
  total_events     BIGINT,
  held_events      BIGINT,
  held_pct         NUMERIC,
  avg_quality      NUMERIC,
  missing_description BIGINT,
  missing_image    BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    s.id                                                          AS source_id,
    s.name                                                        AS source_name,
    s.slug                                                        AS source_slug,
    s.is_active,
    COUNT(*)                                                      AS total_events,
    COUNT(*) FILTER (WHERE e.is_feed_ready = false)              AS held_events,
    ROUND(
      COUNT(*) FILTER (WHERE e.is_feed_ready = false)::NUMERIC
      / NULLIF(COUNT(*), 0) * 100,
      1
    )                                                             AS held_pct,
    ROUND(AVG(e.data_quality)::NUMERIC, 0)                       AS avg_quality,
    COUNT(*) FILTER (WHERE e.description IS NULL)                AS missing_description,
    COUNT(*) FILTER (WHERE e.image_url IS NULL)                  AS missing_image
  FROM events e
  JOIN sources s ON e.source_id = s.id
  WHERE e.start_date >= p_start_date
  GROUP BY s.id, s.name, s.slug, s.is_active
  HAVING COUNT(*) >= p_min_events
  ORDER BY
    COUNT(*) FILTER (WHERE e.is_feed_ready = false) DESC,
    COUNT(*) DESC;
$$;

COMMENT ON FUNCTION get_source_quality_metrics(integer, date)
IS 'Aggregates per-source held-event rates and completeness for upcoming events. Admin-only via source quality dashboard. PRD 027 Phase 5.';

-- Grant execute to service_role only (admin API uses service client)
REVOKE ALL ON FUNCTION get_source_quality_metrics(integer, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_source_quality_metrics(integer, date) TO service_role;
