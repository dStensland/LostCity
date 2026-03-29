-- Fix get_neighborhood_activity RPC to reference places table (renamed from venues)
-- and updated column names (place_id, is_active, place_occasions)

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
    p.neighborhood,

    -- Events today
    COUNT(DISTINCT e_today.id)::BIGINT AS events_today,

    -- Events in the next 7 days (inclusive of today)
    COUNT(DISTINCT e_week.id)::BIGINT  AS events_week,

    -- Distinct active places in this neighborhood
    COUNT(DISTINCT p.id)::BIGINT       AS venue_count,

    -- Editorial mentions linked to places in this neighborhood
    COUNT(DISTINCT em.id)::BIGINT      AS editorial_mention_count,

    -- Distinct occasion types tagged across places in this neighborhood
    COUNT(DISTINCT po.occasion)::BIGINT AS occasion_type_count

  FROM places p

  -- Today's events
  LEFT JOIN events e_today
    ON  e_today.place_id          = p.id
    AND e_today.is_active          = true
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
    ON  e_week.place_id           = p.id
    AND e_week.is_active           = true
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
    ON em.place_id = p.id

  -- Occasion types
  LEFT JOIN place_occasions po
    ON po.place_id = p.id

  WHERE COALESCE(p.is_active, true) = true
    AND p.city         = ANY(p_city_names)
    AND p.neighborhood IS NOT NULL

  GROUP BY p.neighborhood
  HAVING p.neighborhood IS NOT NULL
$$;
