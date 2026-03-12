-- Search term corpus for autocomplete.
-- Moves alias/synonym generation into the data layer so suggestions stay fresh
-- as crawlers add venues, artists, programs, and other entities.

CREATE OR REPLACE FUNCTION normalize_search_term(p_input TEXT)
RETURNS TEXT AS $$
  SELECT NULLIF(
    regexp_replace(lower(trim(COALESCE(p_input, ''))), '\s+', ' ', 'g'),
    ''
  );
$$ LANGUAGE sql IMMUTABLE;

CREATE TABLE IF NOT EXISTS entity_search_terms (
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  suggestion_type TEXT NOT NULL CHECK (
    suggestion_type IN (
      'event',
      'venue',
      'organizer',
      'category',
      'tag',
      'vibe',
      'festival',
      'neighborhood'
    )
  ),
  term_type TEXT NOT NULL CHECK (
    term_type IN (
      'primary',
      'alias',
      'artist',
      'provider',
      'venue',
      'category',
      'tag',
      'vibe',
      'neighborhood'
    )
  ),
  display_term TEXT NOT NULL,
  match_term TEXT NOT NULL,
  city TEXT,
  weight INTEGER NOT NULL DEFAULT 1 CHECK (weight >= 1),
  source TEXT NOT NULL DEFAULT 'generated',
  confidence NUMERIC(3, 2) NOT NULL DEFAULT 1.00 CHECK (confidence >= 0 AND confidence <= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_type, entity_id, suggestion_type, term_type, match_term)
);

CREATE INDEX IF NOT EXISTS idx_entity_search_terms_match_term
  ON entity_search_terms(match_term);

CREATE INDEX IF NOT EXISTS idx_entity_search_terms_city_type
  ON entity_search_terms(city, suggestion_type);

CREATE INDEX IF NOT EXISTS idx_entity_search_terms_display_term
  ON entity_search_terms(display_term);

DROP TRIGGER IF EXISTS update_entity_search_terms_updated_at ON entity_search_terms;
CREATE TRIGGER update_entity_search_terms_updated_at
  BEFORE UPDATE ON entity_search_terms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS search_term_overrides (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  suggestion_type TEXT NOT NULL CHECK (
    suggestion_type IN (
      'event',
      'venue',
      'organizer',
      'category',
      'tag',
      'vibe',
      'festival',
      'neighborhood'
    )
  ),
  term_type TEXT NOT NULL DEFAULT 'alias' CHECK (
    term_type IN ('alias', 'abbreviation', 'nickname', 'synonym')
  ),
  display_term TEXT NOT NULL,
  match_term TEXT NOT NULL,
  city TEXT,
  weight INTEGER NOT NULL DEFAULT 2 CHECK (weight >= 1),
  confidence NUMERIC(3, 2) NOT NULL DEFAULT 1.00 CHECK (confidence >= 0 AND confidence <= 1),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, suggestion_type, match_term)
);

CREATE INDEX IF NOT EXISTS idx_search_term_overrides_match_term
  ON search_term_overrides(match_term)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_search_term_overrides_city_type
  ON search_term_overrides(city, suggestion_type)
  WHERE is_active = TRUE;

DROP TRIGGER IF EXISTS update_search_term_overrides_updated_at ON search_term_overrides;
CREATE TRIGGER update_search_term_overrides_updated_at
  BEFORE UPDATE ON search_term_overrides
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

INSERT INTO search_term_overrides (
  entity_type,
  entity_id,
  suggestion_type,
  term_type,
  display_term,
  match_term,
  city,
  weight,
  notes
)
VALUES
  ('neighborhood', 'atlanta:old fourth ward', 'neighborhood', 'abbreviation', 'Old Fourth Ward', normalize_search_term('o4w'), 'Atlanta', 3, 'Common neighborhood abbreviation'),
  ('neighborhood', 'atlanta:little five points', 'neighborhood', 'abbreviation', 'Little Five Points', normalize_search_term('l5p'), 'Atlanta', 3, 'Common neighborhood abbreviation'),
  ('neighborhood', 'atlanta:virginia highland', 'neighborhood', 'abbreviation', 'Virginia Highland', normalize_search_term('va-hi'), 'Atlanta', 3, 'Common neighborhood abbreviation'),
  ('neighborhood', 'atlanta:virginia highland', 'neighborhood', 'abbreviation', 'Virginia Highland', normalize_search_term('va hi'), 'Atlanta', 3, 'Common neighborhood abbreviation'),
  ('category', 'music', 'category', 'synonym', 'music', normalize_search_term('live music'), NULL, 2, 'Common category synonym'),
  ('category', 'comedy', 'category', 'synonym', 'comedy', normalize_search_term('stand-up'), NULL, 2, 'Common category synonym'),
  ('vibe', 'rooftop', 'vibe', 'synonym', 'rooftop', normalize_search_term('rooftop bar'), NULL, 2, 'Common vibe synonym'),
  ('vibe', 'rooftop', 'vibe', 'synonym', 'rooftop', normalize_search_term('rooftop bars'), NULL, 2, 'Common vibe synonym')
ON CONFLICT (entity_type, entity_id, suggestion_type, match_term) DO UPDATE
SET
  display_term = EXCLUDED.display_term,
  term_type = EXCLUDED.term_type,
  city = EXCLUDED.city,
  weight = EXCLUDED.weight,
  notes = EXCLUDED.notes,
  is_active = TRUE,
  updated_at = now();

CREATE OR REPLACE FUNCTION rebuild_entity_search_terms()
RETURNS void AS $$
BEGIN
  TRUNCATE TABLE entity_search_terms;

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
    'event',
    e.id::TEXT,
    'event',
    'primary',
    e.title,
    normalize_search_term(e.title),
    v.city,
    1,
    'events.title'
  FROM events e
  LEFT JOIN venues v ON v.id = e.venue_id
  WHERE e.start_date >= CURRENT_DATE
    AND COALESCE(e.is_active, TRUE) = TRUE
    AND e.canonical_event_id IS NULL
    AND normalize_search_term(e.title) IS NOT NULL;

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
    'event',
    e.id::TEXT,
    'event',
    'artist',
    e.title,
    normalize_search_term(ea.name),
    v.city,
    1,
    'event_artists.name'
  FROM events e
  JOIN event_artists ea ON ea.event_id = e.id
  LEFT JOIN venues v ON v.id = e.venue_id
  WHERE e.start_date >= CURRENT_DATE
    AND COALESCE(e.is_active, TRUE) = TRUE
    AND e.canonical_event_id IS NULL
    AND normalize_search_term(e.title) IS NOT NULL
    AND normalize_search_term(ea.name) IS NOT NULL
    AND normalize_search_term(ea.name) <> normalize_search_term(e.title)
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
    1,
    'venues.name'
  FROM venues v
  WHERE COALESCE(v.active, TRUE) = TRUE
    AND normalize_search_term(v.name) IS NOT NULL;

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
    1,
    'venues.aliases'
  FROM venues v
  CROSS JOIN LATERAL unnest(COALESCE(v.aliases, '{}'::TEXT[])) AS alias(term)
  WHERE COALESCE(v.active, TRUE) = TRUE
    AND normalize_search_term(v.name) IS NOT NULL
    AND normalize_search_term(alias.term) IS NOT NULL
    AND normalize_search_term(alias.term) <> normalize_search_term(v.name)
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
    'organizer',
    o.id::TEXT,
    'organizer',
    'primary',
    o.name,
    normalize_search_term(o.name),
    o.city,
    GREATEST(COALESCE(o.total_events_tracked, 1), 1),
    'organizations.name'
  FROM organizations o
  WHERE COALESCE(o.hidden, FALSE) = FALSE
    AND normalize_search_term(o.name) IS NOT NULL;

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
    'program',
    p.id::TEXT,
    'event',
    'primary',
    p.name,
    normalize_search_term(p.name),
    v.city,
    1,
    'programs.name'
  FROM programs p
  LEFT JOIN venues v ON v.id = p.venue_id
  WHERE p.status = 'active'
    AND normalize_search_term(p.name) IS NOT NULL;

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
    'program',
    p.id::TEXT,
    'event',
    'provider',
    p.name,
    normalize_search_term(p.provider_name),
    v.city,
    1,
    'programs.provider_name'
  FROM programs p
  LEFT JOIN venues v ON v.id = p.venue_id
  WHERE p.status = 'active'
    AND normalize_search_term(p.name) IS NOT NULL
    AND normalize_search_term(p.provider_name) IS NOT NULL
    AND normalize_search_term(p.provider_name) <> normalize_search_term(p.name)
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
    'program',
    p.id::TEXT,
    'event',
    'venue',
    p.name,
    normalize_search_term(v.name),
    v.city,
    1,
    'programs.venue'
  FROM programs p
  JOIN venues v ON v.id = p.venue_id
  WHERE p.status = 'active'
    AND normalize_search_term(p.name) IS NOT NULL
    AND normalize_search_term(v.name) IS NOT NULL
    AND normalize_search_term(v.name) <> normalize_search_term(p.name)
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
    GROUP BY
      normalize_search_term(v.city),
      normalize_search_term(v.neighborhood)
  ) neighborhoods;

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
    'category',
    normalize_search_term(e.category_id),
    'category',
    'primary',
    MIN(e.category_id),
    normalize_search_term(e.category_id),
    NULL,
    COUNT(*)::INTEGER,
    'events.category_id'
  FROM events e
  WHERE e.start_date >= CURRENT_DATE
    AND COALESCE(e.is_active, TRUE) = TRUE
    AND e.category_id IS NOT NULL
    AND normalize_search_term(e.category_id) IS NOT NULL
  GROUP BY normalize_search_term(e.category_id);

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
    'tag',
    normalize_search_term(tag.term),
    'tag',
    'tag',
    MIN(tag.term),
    normalize_search_term(tag.term),
    NULL,
    COUNT(*)::INTEGER,
    'events.tags'
  FROM events e
  CROSS JOIN LATERAL unnest(COALESCE(e.tags, '{}'::TEXT[])) AS tag(term)
  WHERE e.start_date >= CURRENT_DATE
    AND COALESCE(e.is_active, TRUE) = TRUE
    AND normalize_search_term(tag.term) IS NOT NULL
  GROUP BY normalize_search_term(tag.term)
  HAVING COUNT(*) >= 3;

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
    'tag',
    normalize_search_term(tag.term),
    'tag',
    'tag',
    MIN(tag.term),
    normalize_search_term(tag.term),
    NULL,
    COUNT(*)::INTEGER,
    'programs.tags'
  FROM programs p
  CROSS JOIN LATERAL unnest(COALESCE(p.tags, '{}'::TEXT[])) AS tag(term)
  WHERE p.status = 'active'
    AND normalize_search_term(tag.term) IS NOT NULL
  GROUP BY normalize_search_term(tag.term)
  HAVING COUNT(*) >= 2
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
    'vibe',
    normalize_search_term(vibe.term),
    'vibe',
    'vibe',
    MIN(vibe.term),
    normalize_search_term(vibe.term),
    NULL,
    COUNT(*)::INTEGER,
    'venues.vibes'
  FROM venues v
  CROSS JOIN LATERAL unnest(COALESCE(v.vibes, '{}'::TEXT[])) AS vibe(term)
  WHERE COALESCE(v.active, TRUE) = TRUE
    AND normalize_search_term(vibe.term) IS NOT NULL
  GROUP BY normalize_search_term(vibe.term)
  HAVING COUNT(*) >= 2;

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
    'festival',
    f.id,
    'festival',
    'primary',
    f.name,
    normalize_search_term(f.name),
    NULL,
    1,
    'festivals.name'
  FROM festivals f
  WHERE normalize_search_term(f.name) IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

DROP MATERIALIZED VIEW IF EXISTS search_suggestions;

CREATE MATERIALIZED VIEW search_suggestions AS
WITH combined_terms AS (
  SELECT
    est.entity_type,
    est.entity_id,
    est.display_term AS text,
    est.match_term AS match_text,
    est.suggestion_type AS type,
    est.weight::BIGINT AS frequency,
    est.city
  FROM entity_search_terms est
  UNION ALL
  SELECT
    sto.entity_type,
    sto.entity_id,
    sto.display_term AS text,
    sto.match_term AS match_text,
    sto.suggestion_type AS type,
    sto.weight::BIGINT AS frequency,
    sto.city
  FROM search_term_overrides sto
  WHERE sto.is_active = TRUE
)
SELECT
  ct.entity_type,
  ct.entity_id,
  ct.text,
  ct.match_text,
  ct.type,
  MAX(ct.frequency)::BIGINT AS frequency,
  ct.city
FROM combined_terms ct
GROUP BY
  ct.entity_type,
  ct.entity_id,
  ct.text,
  ct.match_text,
  ct.type,
  ct.city;

CREATE INDEX idx_search_suggestions_match_trgm
  ON search_suggestions USING GIN(match_text gin_trgm_ops);

CREATE INDEX idx_search_suggestions_type
  ON search_suggestions(type);

CREATE INDEX idx_search_suggestions_frequency
  ON search_suggestions(frequency DESC);

CREATE INDEX idx_search_suggestions_city
  ON search_suggestions(city);

CREATE UNIQUE INDEX idx_search_suggestions_unique
  ON search_suggestions(entity_type, entity_id, type, match_text, COALESCE(city, ''));

COMMENT ON MATERIALIZED VIEW search_suggestions IS
  'Autocomplete term index with canonical display text and alias-aware match text.';

CREATE OR REPLACE FUNCTION refresh_search_suggestions()
RETURNS void AS $$
BEGIN
  PERFORM rebuild_entity_search_terms();
  REFRESH MATERIALIZED VIEW CONCURRENTLY search_suggestions;
END;
$$ LANGUAGE plpgsql;

SELECT rebuild_entity_search_terms();
REFRESH MATERIALIZED VIEW search_suggestions;

CREATE OR REPLACE FUNCTION get_similar_suggestions(
    p_query TEXT,
    p_limit INTEGER DEFAULT 8,
    p_min_similarity REAL DEFAULT 0.3,
    p_city TEXT DEFAULT NULL
)
RETURNS TABLE(
    suggestion TEXT,
    type TEXT,
    frequency BIGINT,
    similarity_score REAL
) AS $$
DECLARE
    v_metro_cities TEXT[];
    v_query TEXT;
    v_has_multiple_words BOOLEAN;
    v_is_short_alias_query BOOLEAN;
    v_is_category_like_query BOOLEAN;
BEGIN
    v_query := normalize_search_term(p_query);
    v_metro_cities := get_metro_cities(p_city);

    IF v_query IS NULL THEN
      RETURN;
    END IF;

    v_has_multiple_words := position(' ' in v_query) > 0;
    v_is_short_alias_query := NOT v_has_multiple_words AND char_length(v_query) <= 4;
    v_is_category_like_query := v_query ~ '\m(music|comedy|theater|theatre|art|film|sports|food|drink|brunch|nightlife|fitness|family|free|pottery|ceramics|yoga|camp|class|classes|swim|dance|dj|karaoke|trivia)\M';

    RETURN QUERY
    WITH matched_terms AS (
      SELECT
        ss.entity_type,
        ss.entity_id,
        ss.text,
        ss.type AS suggestion_type,
        ss.frequency AS suggestion_frequency,
        CASE
          WHEN v_is_short_alias_query THEN
            CASE ss.type
              WHEN 'neighborhood' THEN 700
              WHEN 'venue' THEN 560
              WHEN 'event' THEN 420
              WHEN 'organizer' THEN 360
              WHEN 'festival' THEN 320
              WHEN 'category' THEN 180
              WHEN 'vibe' THEN 140
              WHEN 'tag' THEN 80
              ELSE 100
            END
          WHEN v_has_multiple_words OR v_is_category_like_query THEN
            CASE ss.type
              WHEN 'event' THEN 720
              WHEN 'festival' THEN 620
              WHEN 'venue' THEN 480
              WHEN 'organizer' THEN 420
              WHEN 'neighborhood' THEN 320
              WHEN 'category' THEN 220
              WHEN 'vibe' THEN 120
              WHEN 'tag' THEN 90
              ELSE 100
            END
          ELSE
            CASE ss.type
              WHEN 'event' THEN 480
              WHEN 'venue' THEN 450
              WHEN 'organizer' THEN 400
              WHEN 'festival' THEN 360
              WHEN 'neighborhood' THEN 300
              WHEN 'category' THEN 220
              WHEN 'vibe' THEN 160
              WHEN 'tag' THEN 140
              ELSE 100
            END
        END AS type_priority,
        GREATEST(
          similarity(ss.match_text, v_query),
          similarity(normalize_search_term(ss.text), v_query)
        )::REAL AS query_similarity,
        CASE
          WHEN ss.match_text = v_query THEN 0
          WHEN ss.match_text LIKE v_query || '%' THEN 1
          WHEN normalize_search_term(ss.text) LIKE v_query || '%' THEN 2
          WHEN ss.match_text LIKE '%' || v_query || '%' THEN 3
          ELSE 4
        END AS match_rank
      FROM search_suggestions ss
      WHERE
        (
          similarity(ss.match_text, v_query) >= p_min_similarity
          OR ss.match_text LIKE '%' || v_query || '%'
          OR normalize_search_term(ss.text) LIKE '%' || v_query || '%'
        )
        AND (v_metro_cities IS NULL OR ss.city IS NULL OR ss.city = ANY(v_metro_cities))
    ),
    deduped_entities AS (
      SELECT
        entity_type,
        entity_id,
        text,
        suggestion_type,
        MAX(suggestion_frequency)::BIGINT AS entity_frequency,
        MAX(type_priority) AS best_type_priority,
        MAX(query_similarity)::REAL AS best_similarity,
        MIN(match_rank) AS match_rank
      FROM matched_terms
      GROUP BY entity_type, entity_id, text, suggestion_type
    ),
    deduped_suggestions AS (
      SELECT
        text,
        suggestion_type,
        SUM(entity_frequency)::BIGINT AS frequency,
        MAX(best_type_priority) AS best_type_priority,
        MAX(best_similarity)::REAL AS best_similarity,
        MIN(match_rank) AS match_rank
      FROM deduped_entities
      GROUP BY text, suggestion_type
    )
    SELECT
      ds.text AS suggestion,
      ds.suggestion_type AS type,
      ds.frequency,
      ds.best_similarity AS similarity_score
    FROM deduped_suggestions ds
    ORDER BY
      ds.match_rank,
      ds.best_type_priority DESC,
      ds.best_similarity DESC,
      ds.frequency DESC,
      ds.text ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_similar_suggestions IS
  'City-scoped canonical suggestions using alias-aware match terms.';

CREATE OR REPLACE FUNCTION get_spelling_suggestions(
    p_query TEXT,
    p_limit INTEGER DEFAULT 3,
    p_city TEXT DEFAULT NULL
)
RETURNS TABLE(
    suggestion TEXT,
    type TEXT,
    similarity_score REAL
) AS $$
DECLARE
    v_metro_cities TEXT[];
    v_query TEXT;
    v_has_multiple_words BOOLEAN;
    v_is_short_alias_query BOOLEAN;
    v_is_category_like_query BOOLEAN;
BEGIN
    v_query := normalize_search_term(p_query);
    v_metro_cities := get_metro_cities(p_city);

    IF v_query IS NULL THEN
      RETURN;
    END IF;

    v_has_multiple_words := position(' ' in v_query) > 0;
    v_is_short_alias_query := NOT v_has_multiple_words AND char_length(v_query) <= 4;
    v_is_category_like_query := v_query ~ '\m(music|comedy|theater|theatre|art|film|sports|food|drink|brunch|nightlife|fitness|family|free|pottery|ceramics|yoga|camp|class|classes|swim|dance|dj|karaoke|trivia)\M';

    IF EXISTS (
        SELECT 1
        FROM search_suggestions
        WHERE (
            match_text = v_query
            OR normalize_search_term(text) = v_query
        )
          AND (v_metro_cities IS NULL OR city IS NULL OR city = ANY(v_metro_cities))
    ) THEN
        RETURN;
    END IF;

    RETURN QUERY
    WITH candidate_terms AS (
      SELECT
        ss.entity_type,
        ss.entity_id,
        ss.text,
        ss.type AS suggestion_type,
        CASE
          WHEN v_is_short_alias_query THEN
            CASE ss.type
              WHEN 'neighborhood' THEN 700
              WHEN 'venue' THEN 560
              WHEN 'event' THEN 420
              WHEN 'organizer' THEN 360
              WHEN 'festival' THEN 320
              WHEN 'category' THEN 180
              WHEN 'vibe' THEN 140
              WHEN 'tag' THEN 80
              ELSE 100
            END
          WHEN v_has_multiple_words OR v_is_category_like_query THEN
            CASE ss.type
              WHEN 'event' THEN 720
              WHEN 'festival' THEN 620
              WHEN 'venue' THEN 480
              WHEN 'organizer' THEN 420
              WHEN 'neighborhood' THEN 320
              WHEN 'category' THEN 220
              WHEN 'vibe' THEN 120
              WHEN 'tag' THEN 90
              ELSE 100
            END
          ELSE
            CASE ss.type
              WHEN 'event' THEN 480
              WHEN 'venue' THEN 450
              WHEN 'organizer' THEN 400
              WHEN 'festival' THEN 360
              WHEN 'neighborhood' THEN 300
              WHEN 'category' THEN 220
              WHEN 'vibe' THEN 160
              WHEN 'tag' THEN 140
              ELSE 100
            END
        END AS type_priority,
        GREATEST(
          similarity(ss.match_text, v_query),
          similarity(normalize_search_term(ss.text), v_query)
        )::REAL AS query_similarity,
        ss.frequency AS suggestion_frequency
      FROM search_suggestions ss
      WHERE
        similarity(ss.match_text, v_query) >= 0.4
        AND ss.match_text <> v_query
        AND (v_metro_cities IS NULL OR ss.city IS NULL OR ss.city = ANY(v_metro_cities))
    ),
    deduped_entities AS (
      SELECT
        entity_type,
        entity_id,
        text,
        suggestion_type,
        MAX(type_priority) AS best_type_priority,
        MAX(query_similarity)::REAL AS best_similarity,
        MAX(suggestion_frequency)::BIGINT AS frequency
      FROM candidate_terms
      GROUP BY entity_type, entity_id, text, suggestion_type
    ),
    deduped_suggestions AS (
      SELECT
        text,
        suggestion_type,
        MAX(best_type_priority) AS best_type_priority,
        MAX(best_similarity)::REAL AS best_similarity,
        SUM(frequency)::BIGINT AS frequency
      FROM deduped_entities
      GROUP BY text, suggestion_type
    )
    SELECT
      ds.text AS suggestion,
      ds.suggestion_type AS type,
      ds.best_similarity AS similarity_score
    FROM deduped_suggestions ds
    ORDER BY
      ds.best_type_priority DESC,
      ds.best_similarity DESC,
      ds.frequency DESC,
      ds.text ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_spelling_suggestions IS
  'Canonical "Did you mean?" suggestions using alias-aware match terms.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM cron.job
      WHERE jobname = 'refresh-search-suggestions'
    ) THEN
      PERFORM cron.schedule(
        'refresh-search-suggestions',
        '*/15 * * * *',
        'SELECT refresh_search_suggestions()'
      );
    END IF;
  END IF;
END $$;
