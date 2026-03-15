-- Favor canonical parent venues over child room rows in search suggestions and
-- committed venue search. This improves multi-room venues like The Masquerade
-- without relying on title-specific heuristics.

CREATE OR REPLACE FUNCTION rebuild_entity_search_terms_scoped(
  p_city TEXT DEFAULT NULL,
  p_since TIMESTAMPTZ DEFAULT NULL,
  p_full BOOLEAN DEFAULT FALSE
)
RETURNS void AS $$
DECLARE
  v_metro_cities TEXT[];
  v_effective_since TIMESTAMPTZ;
BEGIN
  v_metro_cities := get_metro_cities(p_city);
  v_effective_since := CASE
    WHEN p_full THEN NULL
    ELSE COALESCE(p_since, now() - INTERVAL '6 hours')
  END;

  IF p_full THEN
    TRUNCATE TABLE entity_search_terms;
  ELSE
    DELETE FROM entity_search_terms est
    WHERE est.entity_type IN ('category', 'tag', 'vibe', 'neighborhood')
      OR (
        est.entity_type = 'event'
        AND EXISTS (
          SELECT 1
          FROM events e
          LEFT JOIN venues v ON v.id = e.venue_id
          WHERE e.id::TEXT = est.entity_id
            AND e.updated_at >= v_effective_since
            AND (v_metro_cities IS NULL OR v.city IS NULL OR v.city = ANY(v_metro_cities))
        )
      )
      OR (
        est.entity_type = 'venue'
        AND EXISTS (
          SELECT 1
          FROM venues v
          WHERE v.id::TEXT = est.entity_id
            AND COALESCE(
              (to_jsonb(v) ->> 'updated_at')::timestamptz,
              v.hours_updated_at,
              v.last_verified_at,
              v.created_at
            ) >= v_effective_since
            AND (v_metro_cities IS NULL OR v.city IS NULL OR v.city = ANY(v_metro_cities))
        )
      )
      OR (
        est.entity_type = 'organizer'
        AND EXISTS (
          SELECT 1
          FROM organizations o
          WHERE o.id::TEXT = est.entity_id
            AND o.updated_at >= v_effective_since
            AND (v_metro_cities IS NULL OR o.city IS NULL OR o.city = ANY(v_metro_cities))
        )
      )
      OR (
        est.entity_type = 'program'
        AND EXISTS (
          SELECT 1
          FROM programs p
          LEFT JOIN venues v ON v.id = p.venue_id
          WHERE p.id::TEXT = est.entity_id
            AND p.updated_at >= v_effective_since
            AND (v_metro_cities IS NULL OR v.city IS NULL OR v.city = ANY(v_metro_cities))
        )
      )
      OR (
        est.entity_type = 'festival'
        AND EXISTS (
          SELECT 1
          FROM festivals f
          WHERE f.id = est.entity_id
            AND f.updated_at >= v_effective_since
        )
      );
  END IF;

  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'event', e.id::TEXT, 'event', 'primary', e.title, normalize_search_term(e.title), v.city, 1, 'events.title'
  FROM events e
  LEFT JOIN venues v ON v.id = e.venue_id
  WHERE e.start_date >= CURRENT_DATE
    AND COALESCE(e.is_active, TRUE) = TRUE
    AND e.canonical_event_id IS NULL
    AND normalize_search_term(e.title) IS NOT NULL
    AND (p_full OR e.updated_at >= v_effective_since)
    AND (v_metro_cities IS NULL OR v.city IS NULL OR v.city = ANY(v_metro_cities));

  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'event', e.id::TEXT, 'event', 'artist', e.title, normalize_search_term(ea.name), v.city, 1, 'event_artists.name'
  FROM events e
  JOIN event_artists ea ON ea.event_id = e.id
  LEFT JOIN venues v ON v.id = e.venue_id
  WHERE e.start_date >= CURRENT_DATE
    AND COALESCE(e.is_active, TRUE) = TRUE
    AND e.canonical_event_id IS NULL
    AND normalize_search_term(e.title) IS NOT NULL
    AND normalize_search_term(ea.name) IS NOT NULL
    AND normalize_search_term(ea.name) <> normalize_search_term(e.title)
    AND (p_full OR e.updated_at >= v_effective_since)
    AND (v_metro_cities IS NULL OR v.city IS NULL OR v.city = ANY(v_metro_cities))
  ON CONFLICT DO NOTHING;

  INSERT INTO entity_search_terms (
    entity_type,
    entity_id,
    suggestion_type,
    term_type,
    display_term,
    match_term,
    city,
    weight,
    source
  )
  SELECT
    'venue',
    v.id::TEXT,
    'venue',
    'primary',
    v.name,
    normalize_search_term(v.name),
    v.city,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM venues child
        WHERE child.parent_venue_id = v.id
          AND COALESCE(child.active, TRUE) = TRUE
      ) THEN 4
      WHEN v.parent_venue_id IS NOT NULL THEN 2
      ELSE 1
    END,
    'venues.name'
  FROM venues v
  WHERE COALESCE(v.active, TRUE) = TRUE
    AND normalize_search_term(v.name) IS NOT NULL
    AND (p_full OR COALESCE(
      (to_jsonb(v) ->> 'updated_at')::timestamptz,
      v.hours_updated_at,
      v.last_verified_at,
      v.created_at
    ) >= v_effective_since)
    AND (v_metro_cities IS NULL OR v.city IS NULL OR v.city = ANY(v_metro_cities));

  INSERT INTO entity_search_terms (
    entity_type,
    entity_id,
    suggestion_type,
    term_type,
    display_term,
    match_term,
    city,
    weight,
    source
  )
  SELECT
    'venue',
    v.id::TEXT,
    'venue',
    'alias',
    v.name,
    normalize_search_term(alias.term),
    v.city,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM venues child
        WHERE child.parent_venue_id = v.id
          AND COALESCE(child.active, TRUE) = TRUE
      ) THEN 4
      WHEN v.parent_venue_id IS NOT NULL THEN 2
      ELSE 1
    END,
    'venues.aliases'
  FROM venues v
  CROSS JOIN LATERAL unnest(COALESCE(v.aliases, '{}'::TEXT[])) AS alias(term)
  WHERE COALESCE(v.active, TRUE) = TRUE
    AND normalize_search_term(v.name) IS NOT NULL
    AND normalize_search_term(alias.term) IS NOT NULL
    AND normalize_search_term(alias.term) <> normalize_search_term(v.name)
    AND (p_full OR COALESCE(
      (to_jsonb(v) ->> 'updated_at')::timestamptz,
      v.hours_updated_at,
      v.last_verified_at,
      v.created_at
    ) >= v_effective_since)
    AND (v_metro_cities IS NULL OR v.city IS NULL OR v.city = ANY(v_metro_cities))
  ON CONFLICT DO NOTHING;

  INSERT INTO entity_search_terms (
    entity_type,
    entity_id,
    suggestion_type,
    term_type,
    display_term,
    match_term,
    city,
    weight,
    source
  )
  SELECT
    'venue',
    v.id::TEXT,
    'venue',
    'alias',
    v.name,
    alias.term,
    v.city,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM venues child
        WHERE child.parent_venue_id = v.id
          AND COALESCE(child.active, TRUE) = TRUE
      ) THEN 4
      WHEN v.parent_venue_id IS NOT NULL THEN 2
      ELSE 1
    END,
    'venues.generated_aliases'
  FROM venues v
  CROSS JOIN LATERAL unnest(search_term_alias_candidates(v.name, v.slug)) AS alias(term)
  WHERE COALESCE(v.active, TRUE) = TRUE
    AND normalize_search_term(v.name) IS NOT NULL
    AND (p_full OR COALESCE(
      (to_jsonb(v) ->> 'updated_at')::timestamptz,
      v.hours_updated_at,
      v.last_verified_at,
      v.created_at
    ) >= v_effective_since)
    AND (v_metro_cities IS NULL OR v.city IS NULL OR v.city = ANY(v_metro_cities))
  ON CONFLICT DO NOTHING;

  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'organizer', o.id::TEXT, 'organizer', 'primary', o.name, normalize_search_term(o.name), o.city,
    GREATEST(COALESCE(o.total_events_tracked, 1), 1), 'organizations.name'
  FROM organizations o
  WHERE COALESCE(o.hidden, FALSE) = FALSE
    AND normalize_search_term(o.name) IS NOT NULL
    AND (p_full OR o.updated_at >= v_effective_since)
    AND (v_metro_cities IS NULL OR o.city IS NULL OR o.city = ANY(v_metro_cities));

  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'organizer', o.id::TEXT, 'organizer', 'alias', o.name, alias.term, o.city,
    GREATEST(COALESCE(o.total_events_tracked, 1), 1), 'organizations.generated_aliases'
  FROM organizations o
  CROSS JOIN LATERAL unnest(search_term_alias_candidates(o.name, o.slug)) AS alias(term)
  WHERE COALESCE(o.hidden, FALSE) = FALSE
    AND normalize_search_term(o.name) IS NOT NULL
    AND (p_full OR o.updated_at >= v_effective_since)
    AND (v_metro_cities IS NULL OR o.city IS NULL OR o.city = ANY(v_metro_cities))
  ON CONFLICT DO NOTHING;

  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'program', p.id::TEXT, 'event', 'primary', p.title, normalize_search_term(p.title), v.city, 2, 'programs.title'
  FROM programs p
  LEFT JOIN venues v ON v.id = p.venue_id
  WHERE COALESCE(p.status, 'active') = 'active'
    AND normalize_search_term(p.title) IS NOT NULL
    AND (p_full OR p.updated_at >= v_effective_since)
    AND (v_metro_cities IS NULL OR v.city IS NULL OR v.city = ANY(v_metro_cities));

  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'program', p.id::TEXT, 'event', 'alias', p.title, alias.term, v.city, 2, 'programs.generated_aliases'
  FROM programs p
  LEFT JOIN venues v ON v.id = p.venue_id
  CROSS JOIN LATERAL unnest(search_term_alias_candidates(p.title, p.slug)) AS alias(term)
  WHERE COALESCE(p.status, 'active') = 'active'
    AND normalize_search_term(p.title) IS NOT NULL
    AND (p_full OR p.updated_at >= v_effective_since)
    AND (v_metro_cities IS NULL OR v.city IS NULL OR v.city = ANY(v_metro_cities))
  ON CONFLICT DO NOTHING;

  DELETE FROM entity_search_terms
  WHERE entity_type = 'neighborhood'
    AND (v_metro_cities IS NULL OR city IS NULL OR city = ANY(v_metro_cities));

  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'neighborhood', lower(n.name), 'neighborhood', 'primary', n.name, normalize_search_term(n.name), n.city, 3, 'neighborhoods.name'
  FROM neighborhoods n
  WHERE normalize_search_term(n.name) IS NOT NULL
    AND (v_metro_cities IS NULL OR n.city IS NULL OR n.city = ANY(v_metro_cities))
  ON CONFLICT DO NOTHING;

  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'category', normalize_search_term(t.tag_name), 'category', 'primary', t.display_name, normalize_search_term(t.tag_name), NULL,
    GREATEST(COALESCE(tc.usage_count, 1), 1), 'taxonomy_tags.category'
  FROM taxonomy_tags t
  LEFT JOIN tag_catalog tc ON normalize_search_term(tc.name) = normalize_search_term(t.tag_name)
  WHERE t.tag_type = 'category'
    AND normalize_search_term(t.tag_name) IS NOT NULL
  ON CONFLICT DO NOTHING;

  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'tag', normalize_search_term(t.tag_name), 'tag', 'primary', t.display_name, normalize_search_term(t.tag_name), NULL,
    GREATEST(COALESCE(tc.usage_count, 1), 1), 'taxonomy_tags.tag'
  FROM taxonomy_tags t
  LEFT JOIN tag_catalog tc ON normalize_search_term(tc.name) = normalize_search_term(t.tag_name)
  WHERE t.tag_type = 'tag'
    AND normalize_search_term(t.tag_name) IS NOT NULL
  ON CONFLICT DO NOTHING;

  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'vibe', normalize_search_term(t.tag_name), 'vibe', 'primary', t.display_name, normalize_search_term(t.tag_name), NULL,
    GREATEST(COALESCE(tc.usage_count, 1), 1), 'taxonomy_tags.vibe'
  FROM taxonomy_tags t
  LEFT JOIN tag_catalog tc ON normalize_search_term(tc.name) = normalize_search_term(t.tag_name)
  WHERE t.tag_type = 'vibe'
    AND normalize_search_term(t.tag_name) IS NOT NULL
  ON CONFLICT DO NOTHING;

  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'festival', f.id, 'festival', 'primary', f.name, normalize_search_term(f.name), NULL, 1, 'festivals.name'
  FROM festivals f
  WHERE normalize_search_term(f.name) IS NOT NULL
    AND (p_full OR f.updated_at >= v_effective_since);

  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'festival', f.id, 'festival', 'alias', f.name, alias.term, NULL, 1, 'festivals.generated_aliases'
  FROM festivals f
  CROSS JOIN LATERAL unnest(search_term_alias_candidates(f.name, f.slug)) AS alias(term)
  WHERE normalize_search_term(f.name) IS NOT NULL
    AND (p_full OR f.updated_at >= v_effective_since)
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS search_venues_ranked(TEXT, INTEGER, INTEGER, TEXT[], TEXT[], TEXT[], TEXT);

CREATE OR REPLACE FUNCTION search_venues_ranked(
    p_query TEXT,
    p_limit INTEGER DEFAULT 10,
    p_offset INTEGER DEFAULT 0,
    p_neighborhoods TEXT[] DEFAULT NULL,
    p_spot_types TEXT[] DEFAULT NULL,
    p_vibes TEXT[] DEFAULT NULL,
    p_city TEXT DEFAULT NULL
)
RETURNS TABLE(
    id INTEGER,
    name TEXT,
    slug TEXT,
    address TEXT,
    neighborhood TEXT,
    spot_type TEXT,
    spot_types TEXT[],
    vibes TEXT[],
    description TEXT,
    short_description TEXT,
    lat DECIMAL,
    lng DECIMAL,
    image_url TEXT,
    website TEXT,
    ts_rank REAL,
    similarity_score REAL,
    combined_score REAL,
    featured BOOLEAN,
    explore_featured BOOLEAN,
    data_quality INTEGER,
    is_event_venue BOOLEAN
) AS $$
DECLARE
    v_tsquery tsquery;
    v_search_terms TEXT;
    v_normalized_query TEXT;
    v_is_short_query BOOLEAN;
BEGIN
    v_search_terms := regexp_replace(trim(p_query), '\s+', ' & ', 'g') || ':*';
    v_tsquery := to_tsquery('english', v_search_terms);
    v_normalized_query := lower(trim(p_query));
    v_is_short_query := array_length(regexp_split_to_array(v_normalized_query, '\s+'), 1) = 1
      AND char_length(v_normalized_query) <= 5;

    RETURN QUERY
    SELECT
        v.id,
        v.name,
        v.slug,
        v.address,
        v.neighborhood,
        v.spot_type,
        v.spot_types,
        v.vibes,
        v.description,
        v.short_description,
        v.lat,
        v.lng,
        v.image_url,
        v.website,
        ts_rank_cd(v.search_vector, v_tsquery, 32)::REAL AS ts_rank,
        similarity(v.name, p_query)::REAL AS similarity_score,
        (
            (
                ts_rank_cd(v.search_vector, v_tsquery, 32) * 0.55 +
                similarity(v.name, p_query) * 0.35 +
                CASE WHEN lower(v.name) = v_normalized_query THEN 1.0 ELSE 0 END +
                CASE
                    WHEN lower(v.name) = v_normalized_query
                      OR lower(v.name) LIKE v_normalized_query || ' %'
                    THEN 0.65
                    ELSE 0
                END +
                CASE
                    WHEN lower(v.name) LIKE '% ' || v_normalized_query || ' %'
                      OR lower(v.name) LIKE '% ' || v_normalized_query
                    THEN 0.15
                    ELSE 0
                END +
                CASE
                    WHEN v_is_short_query
                      AND lower(v.name) LIKE v_normalized_query || '%'
                      AND lower(v.name) <> v_normalized_query
                      AND lower(v.name) NOT LIKE v_normalized_query || ' %'
                    THEN -0.18
                    ELSE 0
                END
            )
            * (0.7
                + CASE WHEN v.image_url IS NOT NULL AND v.image_url != '' THEN 0.1 ELSE 0 END
                + CASE WHEN v.description IS NOT NULL AND length(v.description) > 50 THEN 0.1 ELSE 0 END
                + CASE WHEN v.neighborhood IS NOT NULL AND v.neighborhood != '' THEN 0.1 ELSE 0 END
              )
            + CASE WHEN COALESCE(v.is_event_venue, false) THEN 0.18 ELSE 0 END
            + CASE
                WHEN COALESCE(v.featured, false) OR COALESCE(v.explore_featured, false)
                THEN 0.08
                ELSE 0
              END
            + CASE
                WHEN v_is_short_query
                  AND v.parent_venue_id IS NULL
                  AND EXISTS (
                    SELECT 1
                    FROM venues child
                    WHERE child.parent_venue_id = v.id
                      AND COALESCE(child.active, TRUE) = TRUE
                  )
                THEN 0.18
                WHEN v_is_short_query AND v.parent_venue_id IS NOT NULL
                THEN -0.08
                ELSE 0
              END
            + LEAST(0.08, GREATEST(0, COALESCE(v.data_quality, 0) - 70)::REAL / 100.0)
        )::REAL AS combined_score,
        COALESCE(v.featured, false) AS featured,
        COALESCE(v.explore_featured, false) AS explore_featured,
        v.data_quality::INTEGER,
        COALESCE(v.is_event_venue, false) AS is_event_venue
    FROM venues v
    WHERE
        v.active = true
        AND (v.search_vector @@ v_tsquery OR similarity(v.name, p_query) > 0.2)
        AND (p_city IS NULL OR v.city = p_city)
        AND (p_neighborhoods IS NULL OR v.neighborhood = ANY(p_neighborhoods))
        AND (p_spot_types IS NULL OR v.spot_type = ANY(p_spot_types) OR v.spot_types && p_spot_types)
        AND (p_vibes IS NULL OR v.vibes && p_vibes)
    ORDER BY combined_score DESC, v.name ASC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_venues_ranked IS
  'Full-text search for venues with short-query whole-token boosts, venue-family preference, and modest prominence signals. v4 2026-03-14.';

SELECT refresh_search_suggestions();
