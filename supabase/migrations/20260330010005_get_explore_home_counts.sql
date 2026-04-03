-- Migration: get_explore_home_counts
--
-- Single-scan SQL function that replaces ~18 individual Supabase REST queries
-- for the Explore Home lane counts. Uses COUNT(*) FILTER (WHERE ...) for
-- conditional aggregation across lanes.
--
-- Parameters:
--   p_portal_id    – portal UUID for scoping (NULL = public/no-portal)
--   p_source_ids   – array of source IDs the portal can see (federation)
--   p_today        – today's date in portal-local time
--   p_week_end     – end of 7-day lookahead window
--   p_weekend_start – Friday date for weekend range (NULL = skip weekend counts)
--   p_weekend_end   – Sunday date for weekend range (NULL = skip weekend counts)
--   p_city_filter   – city ILIKE pattern for places lane (e.g. 'Atlanta%')
--
-- Returns a JSONB object keyed by lane slug with count/count_today/count_weekend.
--
-- Keep this file mirrored in database/migrations and supabase/migrations.

CREATE OR REPLACE FUNCTION get_explore_home_counts(
  p_portal_id     UUID     DEFAULT NULL,
  p_source_ids    INT[]    DEFAULT NULL,
  p_today         DATE     DEFAULT CURRENT_DATE,
  p_week_end      DATE     DEFAULT NULL,
  p_weekend_start DATE     DEFAULT NULL,
  p_weekend_end   DATE     DEFAULT NULL,
  p_city_filter   TEXT     DEFAULT 'Atlanta%'
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  -- =========================================================================
  -- 1. Main event scan: covers events/shows/game-day/calendar/regulars lanes
  --    Two base predicates:
  --      "feed" = is_active + (is_feed_ready true/null) + canonical null + date range + portal
  --      "regular" = is_active + is_regular_ready + series_id not null + canonical null + date range + portal
  -- =========================================================================
  WITH base AS (
    SELECT
      category_id,
      start_date,
      COALESCE(is_class, false) AS is_class,
      COALESCE(is_regular_ready, false) AS is_regular_ready,
      series_id,
      -- Mark rows that pass the "feed-ready" gate
      (COALESCE(is_feed_ready, true) = true) AS is_feed_eligible,
      place_id
    FROM events
    WHERE is_active = true
      AND canonical_event_id IS NULL
      AND start_date >= p_today
      AND start_date <= COALESCE(p_week_end, p_today + 7)
      -- Portal scoping: when portal provided, see portal's own + federated sources.
      -- When no portal, see only public (portal_id IS NULL) events.
      AND (
        CASE
          WHEN p_portal_id IS NOT NULL AND p_source_ids IS NOT NULL THEN
            (portal_id = p_portal_id OR source_id = ANY(p_source_ids))
          WHEN p_portal_id IS NOT NULL THEN
            portal_id = p_portal_id
          ELSE
            portal_id IS NULL
        END
      )
  ),

  -- Category sets as arrays for use in ANY() checks
  show_cats AS (
    SELECT ARRAY['film','music','theater','comedy','dance'] AS cats
  ),
  exclude_cats AS (
    SELECT ARRAY['film','theater','education','support','support_group',
                  'civic','volunteer','religious','community','family','learning'] AS cats
  ),

  -- =========================================================================
  -- 2. Aggregate event counts per lane
  -- =========================================================================
  event_counts AS (
    SELECT
      -- Events lane: feed-eligible, not a show category, not a class.
      -- category_id NOT IN (...) excludes NULLs in SQL — matches PostgREST .not("category_id","in",...)
      COUNT(*) FILTER (WHERE
        is_feed_eligible
        AND NOT is_class
        AND category_id IS NOT NULL
        AND category_id <> ALL((SELECT cats FROM show_cats))
      ) AS events_total,

      COUNT(*) FILTER (WHERE
        is_feed_eligible
        AND NOT is_class
        AND category_id IS NOT NULL
        AND category_id <> ALL((SELECT cats FROM show_cats))
        AND start_date = p_today
      ) AS events_today,

      COUNT(*) FILTER (WHERE
        is_feed_eligible
        AND NOT is_class
        AND category_id IS NOT NULL
        AND category_id <> ALL((SELECT cats FROM show_cats))
        AND p_weekend_start IS NOT NULL
        AND start_date >= p_weekend_start
        AND start_date <= p_weekend_end
      ) AS events_weekend,

      -- Shows lane: feed-eligible, in show categories, not a class
      COUNT(*) FILTER (WHERE
        is_feed_eligible
        AND NOT is_class
        AND category_id = ANY((SELECT cats FROM show_cats))
      ) AS shows_total,

      COUNT(*) FILTER (WHERE
        is_feed_eligible
        AND NOT is_class
        AND category_id = ANY((SELECT cats FROM show_cats))
        AND start_date = p_today
      ) AS shows_today,

      COUNT(*) FILTER (WHERE
        is_feed_eligible
        AND NOT is_class
        AND category_id = ANY((SELECT cats FROM show_cats))
        AND p_weekend_start IS NOT NULL
        AND start_date >= p_weekend_start
        AND start_date <= p_weekend_end
      ) AS shows_weekend,

      -- Game Day lane: feed-eligible, sports category, not a class
      COUNT(*) FILTER (WHERE
        is_feed_eligible
        AND NOT is_class
        AND category_id = 'sports'
      ) AS gameday_total,

      COUNT(*) FILTER (WHERE
        is_feed_eligible
        AND NOT is_class
        AND category_id = 'sports'
        AND start_date = p_today
      ) AS gameday_today,

      COUNT(*) FILTER (WHERE
        is_feed_eligible
        AND NOT is_class
        AND category_id = 'sports'
        AND p_weekend_start IS NOT NULL
        AND start_date >= p_weekend_start
        AND start_date <= p_weekend_end
      ) AS gameday_weekend,

      -- Regulars lane: is_regular_ready, has series, not class, not in exclude cats.
      -- category_id NOT IN (...) excludes NULLs — matches PostgREST behavior.
      COUNT(*) FILTER (WHERE
        is_regular_ready
        AND NOT is_class
        AND series_id IS NOT NULL
        AND category_id IS NOT NULL
        AND category_id <> ALL((SELECT cats FROM exclude_cats))
      ) AS regulars_total,

      COUNT(*) FILTER (WHERE
        is_regular_ready
        AND NOT is_class
        AND series_id IS NOT NULL
        AND category_id IS NOT NULL
        AND category_id <> ALL((SELECT cats FROM exclude_cats))
        AND start_date = p_today
      ) AS regulars_today,

      COUNT(*) FILTER (WHERE
        is_regular_ready
        AND NOT is_class
        AND series_id IS NOT NULL
        AND category_id IS NOT NULL
        AND category_id <> ALL((SELECT cats FROM exclude_cats))
        AND p_weekend_start IS NOT NULL
        AND start_date >= p_weekend_start
        AND start_date <= p_weekend_end
      ) AS regulars_weekend,

      -- Classes lane: is_class = true, feed-eligible
      -- Note: today/weekend use the 7-day window from the base CTE.
      -- Total count is computed separately below without the 7-day cap.
      COUNT(*) FILTER (WHERE
        is_class
        AND is_feed_eligible
      ) AS classes_total_7d,

      COUNT(*) FILTER (WHERE
        is_class
        AND is_feed_eligible
        AND start_date = p_today
      ) AS classes_today,

      COUNT(*) FILTER (WHERE
        is_class
        AND is_feed_eligible
        AND p_weekend_start IS NOT NULL
        AND start_date >= p_weekend_start
        AND start_date <= p_weekend_end
      ) AS classes_weekend,

      -- Calendar lane: all feed-eligible events (no category filter)
      COUNT(*) FILTER (WHERE is_feed_eligible) AS calendar_total,

      -- Map lane: feed-eligible events with a place that has lat/lng
      COUNT(*) FILTER (WHERE
        is_feed_eligible
        AND place_id IS NOT NULL
      ) AS map_candidates
    FROM base
  ),

  -- =========================================================================
  -- 3. Classes total without 7-day cap (matches existing behavior)
  -- =========================================================================
  classes_uncapped AS (
    SELECT COUNT(*) AS total
    FROM events
    WHERE is_class = true
      AND is_active = true
      AND COALESCE(is_feed_ready, true) = true
      AND canonical_event_id IS NULL
      AND start_date >= p_today
      AND (
        CASE
          WHEN p_portal_id IS NOT NULL AND p_source_ids IS NOT NULL THEN
            (portal_id = p_portal_id OR source_id = ANY(p_source_ids))
          WHEN p_portal_id IS NOT NULL THEN
            portal_id = p_portal_id
          ELSE
            portal_id IS NULL
        END
      )
  ),

  -- =========================================================================
  -- 4. Map lane: need to verify place has lat/lng via join
  -- =========================================================================
  map_count AS (
    SELECT COUNT(*) AS total
    FROM base b
    JOIN places p ON p.id = b.place_id
    WHERE b.is_feed_eligible
      AND p.lat IS NOT NULL
      AND p.lng IS NOT NULL
  ),

  -- =========================================================================
  -- 5. Places lane: count from places table (not events)
  -- =========================================================================
  places_count AS (
    SELECT COUNT(*) AS total
    FROM places
    WHERE COALESCE(is_active, true) != false
      AND city ILIKE p_city_filter
  )

  -- =========================================================================
  -- 6. Assemble the JSONB result
  -- =========================================================================
  SELECT jsonb_build_object(
    'events', jsonb_build_object(
      'count',         ec.events_total,
      'count_today',   ec.events_today,
      'count_weekend', CASE WHEN p_weekend_start IS NOT NULL THEN ec.events_weekend ELSE NULL END
    ),
    'shows', jsonb_build_object(
      'count',         ec.shows_total,
      'count_today',   ec.shows_today,
      'count_weekend', CASE WHEN p_weekend_start IS NOT NULL THEN ec.shows_weekend ELSE NULL END
    ),
    'game-day', jsonb_build_object(
      'count',         ec.gameday_total,
      'count_today',   ec.gameday_today,
      'count_weekend', CASE WHEN p_weekend_start IS NOT NULL THEN ec.gameday_weekend ELSE NULL END
    ),
    'regulars', jsonb_build_object(
      'count',         ec.regulars_total,
      'count_today',   ec.regulars_today,
      'count_weekend', CASE WHEN p_weekend_start IS NOT NULL THEN ec.regulars_weekend ELSE NULL END
    ),
    'classes', jsonb_build_object(
      'count',         cu.total,
      'count_today',   ec.classes_today,
      'count_weekend', CASE WHEN p_weekend_start IS NOT NULL THEN ec.classes_weekend ELSE NULL END
    ),
    'calendar', jsonb_build_object(
      'count',         ec.calendar_total,
      'count_today',   NULL::bigint,
      'count_weekend', NULL::bigint
    ),
    'map', jsonb_build_object(
      'count',         mc.total,
      'count_today',   NULL::bigint,
      'count_weekend', NULL::bigint
    ),
    'places', jsonb_build_object(
      'count',         pc.total,
      'count_today',   NULL::bigint,
      'count_weekend', NULL::bigint
    )
  )
  FROM event_counts ec
  CROSS JOIN classes_uncapped cu
  CROSS JOIN map_count mc
  CROSS JOIN places_count pc
$$;

COMMENT ON FUNCTION get_explore_home_counts IS
  'Single-scan conditional aggregation for Explore Home lane counts. '
  'Replaces ~18 individual Supabase REST queries with one function call. '
  'Supports portal scoping via portal_id + source_id array.';
