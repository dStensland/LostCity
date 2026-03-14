-- Add venue-specific generic landmark aliases and prominence-aware weights to the
-- search corpus so broad destination nouns like "museum" and "garden" surface
-- flagship venues in instant search instead of raw taxonomy rows.

CREATE OR REPLACE FUNCTION venue_search_term_weight(
  p_has_active_children BOOLEAN,
  p_parent_venue_id BIGINT DEFAULT NULL,
  p_featured BOOLEAN DEFAULT FALSE,
  p_explore_featured BOOLEAN DEFAULT FALSE,
  p_data_quality SMALLINT DEFAULT NULL
)
RETURNS INTEGER AS $$
  SELECT
    (CASE
      WHEN p_has_active_children THEN 4
      WHEN p_parent_venue_id IS NOT NULL THEN 2
      ELSE 1
    END)
    + (CASE
      WHEN COALESCE(p_explore_featured, FALSE) THEN 6
      WHEN COALESCE(p_featured, FALSE) THEN 3
      ELSE 0
    END)
    + (CASE
      WHEN COALESCE(p_data_quality, 0) >= 90 THEN 4
      WHEN COALESCE(p_data_quality, 0) >= 85 THEN 3
      WHEN COALESCE(p_data_quality, 0) >= 80 THEN 2
      WHEN COALESCE(p_data_quality, 0) >= 75 THEN 1
      ELSE 0
    END);
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION venue_generic_search_term_candidates(
  p_display_term TEXT
)
RETURNS TEXT[] AS $$
  WITH normalized_name AS (
    SELECT normalize_search_term(p_display_term) AS base_term
  )
  SELECT COALESCE(
    array_agg(DISTINCT candidate) FILTER (
      WHERE candidate IS NOT NULL
        AND candidate <> normalized_name.base_term
    ),
    ARRAY[]::TEXT[]
  )
  FROM normalized_name
  CROSS JOIN LATERAL (
    VALUES
      (CASE WHEN normalized_name.base_term ~ '\mmuseum(s)?\M' THEN 'museum' END),
      (CASE WHEN normalized_name.base_term ~ '\mgarden(s)?\M' THEN 'garden' END),
      (CASE WHEN normalized_name.base_term ~ '\mpark\M' THEN 'park' END),
      (CASE WHEN normalized_name.base_term ~ '\mmarket\M' THEN 'market' END),
      (CASE WHEN normalized_name.base_term ~ '\mplayhouse\M' THEN 'playhouse' END),
      (CASE WHEN normalized_name.base_term ~ '\mtheat(er|re)\M' THEN 'theater' END),
      (CASE WHEN normalized_name.base_term ~ '\mtheat(er|re)\M' THEN 'theatre' END),
      (CASE WHEN normalized_name.base_term ~ '\mamphitheat(er|re)\M' THEN 'amphitheater' END),
      (CASE WHEN normalized_name.base_term ~ '\mamphitheat(er|re)\M' THEN 'amphitheatre' END),
      (CASE WHEN normalized_name.base_term ~ '\mhall\M' THEN 'hall' END),
      (CASE WHEN normalized_name.base_term ~ '\msquare\M' THEN 'square' END),
      (CASE WHEN normalized_name.base_term ~ '\mplaza\M' THEN 'plaza' END),
      (CASE WHEN normalized_name.base_term ~ '\mtrail\M' THEN 'trail' END),
      (CASE WHEN normalized_name.base_term ~ '\marboretum\M' THEN 'arboretum' END),
      (CASE WHEN normalized_name.base_term ~ '\mzoo\M' THEN 'zoo' END),
      (CASE WHEN normalized_name.base_term ~ '\maquarium\M' THEN 'aquarium' END),
      (CASE WHEN normalized_name.base_term ~ '\mstadium\M' THEN 'stadium' END)
  ) AS candidates(candidate);
$$ LANGUAGE sql IMMUTABLE;

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
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'venue', v.id::TEXT, 'venue', 'primary', v.name, normalize_search_term(v.name), v.city,
    venue_search_term_weight(
      EXISTS (
        SELECT 1
        FROM venues child
        WHERE child.parent_venue_id = v.id
          AND COALESCE(child.active, TRUE) = TRUE
      ),
      v.parent_venue_id,
      COALESCE(v.featured, FALSE),
      COALESCE(v.explore_featured, FALSE),
      v.data_quality
    ),
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
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'venue', v.id::TEXT, 'venue', 'alias', v.name, normalize_search_term(alias.term), v.city,
    venue_search_term_weight(
      EXISTS (
        SELECT 1
        FROM venues child
        WHERE child.parent_venue_id = v.id
          AND COALESCE(child.active, TRUE) = TRUE
      ),
      v.parent_venue_id,
      COALESCE(v.featured, FALSE),
      COALESCE(v.explore_featured, FALSE),
      v.data_quality
    ),
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
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'venue', v.id::TEXT, 'venue', 'alias', v.name, alias.term, v.city,
    venue_search_term_weight(
      EXISTS (
        SELECT 1
        FROM venues child
        WHERE child.parent_venue_id = v.id
          AND COALESCE(child.active, TRUE) = TRUE
      ),
      v.parent_venue_id,
      COALESCE(v.featured, FALSE),
      COALESCE(v.explore_featured, FALSE),
      v.data_quality
    ),
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
    'venue', v.id::TEXT, 'venue', 'alias', v.name, alias.term, v.city,
    venue_search_term_weight(
      EXISTS (
        SELECT 1
        FROM venues child
        WHERE child.parent_venue_id = v.id
          AND COALESCE(child.active, TRUE) = TRUE
      ),
      v.parent_venue_id,
      COALESCE(v.featured, FALSE),
      COALESCE(v.explore_featured, FALSE),
      v.data_quality
    ),
    'venues.generic_aliases'
  FROM venues v
  CROSS JOIN LATERAL unnest(venue_generic_search_term_candidates(v.name)) AS alias(term)
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
    'program', p.id::TEXT, 'event', 'primary', p.name, normalize_search_term(p.name), v.city, 1, 'programs.name'
  FROM programs p
  LEFT JOIN venues v ON v.id = p.venue_id
  WHERE p.status = 'active'
    AND normalize_search_term(p.name) IS NOT NULL
    AND (p_full OR p.updated_at >= v_effective_since)
    AND (v_metro_cities IS NULL OR v.city IS NULL OR v.city = ANY(v_metro_cities));

  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'program', p.id::TEXT, 'event', 'alias', p.name, alias.term, v.city, 1, 'programs.generated_aliases'
  FROM programs p
  LEFT JOIN venues v ON v.id = p.venue_id
  CROSS JOIN LATERAL unnest(search_term_alias_candidates(p.name, p.slug)) AS alias(term)
  WHERE p.status = 'active'
    AND normalize_search_term(p.name) IS NOT NULL
    AND (p_full OR p.updated_at >= v_effective_since)
    AND (v_metro_cities IS NULL OR v.city IS NULL OR v.city = ANY(v_metro_cities))
  ON CONFLICT DO NOTHING;

  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'program', p.id::TEXT, 'event', 'provider', p.name, normalize_search_term(p.provider_name), v.city, 1, 'programs.provider_name'
  FROM programs p
  LEFT JOIN venues v ON v.id = p.venue_id
  WHERE p.status = 'active'
    AND normalize_search_term(p.name) IS NOT NULL
    AND normalize_search_term(p.provider_name) IS NOT NULL
    AND normalize_search_term(p.provider_name) <> normalize_search_term(p.name)
    AND (p_full OR p.updated_at >= v_effective_since)
    AND (v_metro_cities IS NULL OR v.city IS NULL OR v.city = ANY(v_metro_cities))
  ON CONFLICT DO NOTHING;

  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'program', p.id::TEXT, 'event', 'venue', p.name, normalize_search_term(v.name), v.city, 1, 'programs.venue'
  FROM programs p
  JOIN venues v ON v.id = p.venue_id
  WHERE p.status = 'active'
    AND normalize_search_term(p.name) IS NOT NULL
    AND normalize_search_term(v.name) IS NOT NULL
    AND normalize_search_term(v.name) <> normalize_search_term(p.name)
    AND (p_full OR p.updated_at >= v_effective_since)
    AND (v_metro_cities IS NULL OR v.city IS NULL OR v.city = ANY(v_metro_cities))
  ON CONFLICT DO NOTHING;

  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'neighborhood',
    normalized_city || ':' || normalized_neighborhood,
    'neighborhood',
    'primary',
    display_term,
    normalized_neighborhood,
    city,
    frequency,
    'venues.neighborhood'
  FROM (
    SELECT
      MIN(v.neighborhood) AS display_term,
      MIN(v.city) AS city,
      normalize_search_term(v.city) AS normalized_city,
      normalize_search_term(v.neighborhood) AS normalized_neighborhood,
      COUNT(*)::INTEGER AS frequency
    FROM venues v
    WHERE COALESCE(v.active, TRUE) = TRUE
      AND normalize_search_term(v.neighborhood) IS NOT NULL
      AND normalize_search_term(v.city) IS NOT NULL
      AND (
        p_full OR COALESCE(
          (to_jsonb(v) ->> 'updated_at')::timestamptz,
          v.hours_updated_at,
          v.last_verified_at,
          v.created_at
        ) >= v_effective_since OR v_metro_cities IS NOT NULL
      )
      AND (v_metro_cities IS NULL OR v.city = ANY(v_metro_cities))
    GROUP BY normalize_search_term(v.city), normalize_search_term(v.neighborhood)
  ) neighborhoods;

  DELETE FROM entity_search_terms
  WHERE entity_type IN ('category', 'tag', 'vibe');

  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'category', normalize_search_term(e.category_id), 'category', 'primary',
    MIN(e.category_id), normalize_search_term(e.category_id), NULL, COUNT(*)::INTEGER, 'events.category_id'
  FROM events e
  WHERE e.start_date >= CURRENT_DATE
    AND COALESCE(e.is_active, TRUE) = TRUE
    AND e.category_id IS NOT NULL
    AND normalize_search_term(e.category_id) IS NOT NULL
  GROUP BY normalize_search_term(e.category_id);

  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'tag', normalize_search_term(tag.term), 'tag', 'tag',
    MIN(tag.term), normalize_search_term(tag.term), NULL, COUNT(*)::INTEGER, 'events.tags'
  FROM events e
  CROSS JOIN LATERAL unnest(COALESCE(e.tags, '{}'::TEXT[])) AS tag(term)
  WHERE e.start_date >= CURRENT_DATE
    AND COALESCE(e.is_active, TRUE) = TRUE
    AND normalize_search_term(tag.term) IS NOT NULL
  GROUP BY normalize_search_term(tag.term)
  HAVING COUNT(*) >= 3;

  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'tag', normalize_search_term(tag.term), 'tag', 'tag',
    MIN(tag.term), normalize_search_term(tag.term), NULL, COUNT(*)::INTEGER, 'programs.tags'
  FROM programs p
  CROSS JOIN LATERAL unnest(COALESCE(p.tags, '{}'::TEXT[])) AS tag(term)
  WHERE p.status = 'active'
    AND normalize_search_term(tag.term) IS NOT NULL
  GROUP BY normalize_search_term(tag.term)
  HAVING COUNT(*) >= 2
  ON CONFLICT DO NOTHING;

  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type, display_term, match_term, city, weight, source
  )
  SELECT
    'vibe', normalize_search_term(vibe.term), 'vibe', 'vibe',
    MIN(vibe.term), normalize_search_term(vibe.term), NULL, COUNT(*)::INTEGER, 'venues.vibes'
  FROM venues v
  CROSS JOIN LATERAL unnest(COALESCE(v.vibes, '{}'::TEXT[])) AS vibe(term)
  WHERE COALESCE(v.active, TRUE) = TRUE
    AND normalize_search_term(vibe.term) IS NOT NULL
  GROUP BY normalize_search_term(vibe.term)
  HAVING COUNT(*) >= 2;

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

SELECT refresh_search_suggestions();
