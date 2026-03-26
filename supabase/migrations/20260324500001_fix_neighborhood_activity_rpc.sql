-- Neighborhood activity metrics for choropleth map feature.
-- Aggregates event counts, venue counts, editorial mentions, and occasion
-- diversity per neighborhood so the map can shade intensity accurately.
--
-- NOTE: events table uses `is_live` and `category_id` TEXT.
-- Sensitive events are filtered via `is_sensitive` and
-- the adult/lifestyle category values.

CREATE OR REPLACE FUNCTION get_neighborhood_activity(
  p_portal_id  UUID    DEFAULT NULL,
  p_city_names TEXT[]  DEFAULT ARRAY['Atlanta']
)
RETURNS TABLE(
  neighborhood          TEXT,
  events_today          BIGINT,
  events_week           BIGINT,
  venue_count           BIGINT,
  editorial_mention_count BIGINT,
  occasion_type_count   BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    v.neighborhood,

    -- Events today
    COUNT(DISTINCT e_today.id)::BIGINT AS events_today,

    -- Events in the next 7 days (inclusive of today)
    COUNT(DISTINCT e_week.id)::BIGINT  AS events_week,

    -- Distinct active venues in this neighborhood
    COUNT(DISTINCT v.id)::BIGINT       AS venue_count,

    -- Editorial mentions linked to venues in this neighborhood
    COUNT(DISTINCT em.id)::BIGINT      AS editorial_mention_count,

    -- Distinct occasion types tagged across venues in this neighborhood
    COUNT(DISTINCT vo.occasion)::BIGINT AS occasion_type_count

  FROM venues v

  -- Today's events
  LEFT JOIN events e_today
    ON  e_today.venue_id          = v.id
    AND e_today.is_live            = true
    AND e_today.canonical_event_id IS NULL
    AND (e_today.is_sensitive IS NULL OR e_today.is_sensitive = false)
    AND e_today.category_id NOT IN ('adult', 'lifestyle')
    AND e_today.start_date        = CURRENT_DATE
    AND (
      p_portal_id IS NULL
      OR e_today.portal_id = p_portal_id
      OR e_today.portal_id IS NULL
    )

  -- This week's events (today through today+7)
  LEFT JOIN events e_week
    ON  e_week.venue_id           = v.id
    AND e_week.is_live             = true
    AND e_week.canonical_event_id  IS NULL
    AND (e_week.is_sensitive IS NULL OR e_week.is_sensitive = false)
    AND e_week.category_id NOT IN ('adult', 'lifestyle')
    AND e_week.start_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
    AND (
      p_portal_id IS NULL
      OR e_week.portal_id = p_portal_id
      OR e_week.portal_id IS NULL
    )

  -- Editorial mentions
  LEFT JOIN editorial_mentions em
    ON em.venue_id = v.id

  -- Occasion types
  LEFT JOIN venue_occasions vo
    ON vo.venue_id = v.id

  WHERE COALESCE(v.active, true) = true
    AND v.city         = ANY(p_city_names)
    AND v.neighborhood IS NOT NULL

  GROUP BY v.neighborhood
  HAVING v.neighborhood IS NOT NULL
$$;

GRANT EXECUTE ON FUNCTION get_neighborhood_activity(UUID, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_neighborhood_activity(UUID, TEXT[]) TO service_role;

COMMENT ON FUNCTION get_neighborhood_activity(UUID, TEXT[]) IS
  'Aggregates event counts (today + 7-day), venue count, editorial mentions, '
  'and occasion diversity per neighborhood for choropleth map rendering. '
  'Sensitive events (is_sensitive=true, category adult/lifestyle) are excluded. '
  'Portal scope: when p_portal_id is set, includes portal-owned events plus '
  'unattributed (portal_id IS NULL) events per the standard federation pattern.';
