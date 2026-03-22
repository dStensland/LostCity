-- Migration: search_programs_ranked RPC + 'program' suggestion type
--
-- Problem: 4,024 programs exist. Suggestions index them as suggestion_type='event',
-- so autocomplete shows program names but hitting Enter returns zero results because
-- there is no search_programs_ranked RPC. Users see stale smoke.
--
-- Fix:
--   1. Extend entity_search_terms CHECK to allow suggestion_type='program'
--   2. Extend search_term_overrides CHECK to allow suggestion_type='program'
--   3. Create search_programs_ranked RPC (portal-scoped, required)
--   4. Add tsvector index on programs for FTS
--   5. Update rebuild_entity_search_terms() to index programs as 'program' type
--   6. Rebuild materialized view
--
-- Portal scoping: programs.portal_id is REQUIRED for programs search.
-- Programs are family-portal entities and must not appear in base portal searches.
-- ============================================

-- -------------------------------------------------------
-- 1. Extend CHECK constraints to allow suggestion_type='program'
-- -------------------------------------------------------

ALTER TABLE entity_search_terms
  DROP CONSTRAINT IF EXISTS entity_search_terms_suggestion_type_check;

ALTER TABLE entity_search_terms
  ADD CONSTRAINT entity_search_terms_suggestion_type_check
  CHECK (suggestion_type IN (
    'event',
    'venue',
    'organizer',
    'category',
    'tag',
    'vibe',
    'festival',
    'neighborhood',
    'program'
  ));

ALTER TABLE search_term_overrides
  DROP CONSTRAINT IF EXISTS search_term_overrides_suggestion_type_check;

ALTER TABLE search_term_overrides
  ADD CONSTRAINT search_term_overrides_suggestion_type_check
  CHECK (suggestion_type IN (
    'event',
    'venue',
    'organizer',
    'category',
    'tag',
    'vibe',
    'festival',
    'neighborhood',
    'program'
  ));

-- -------------------------------------------------------
-- 2. Full-text search index on programs
-- -------------------------------------------------------

ALTER TABLE programs ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS idx_programs_search_vector
  ON programs USING GIN(search_vector);

-- Populate search_vector for existing rows
UPDATE programs
SET search_vector = to_tsvector('english',
  COALESCE(name, '') || ' ' ||
  COALESCE(description, '') || ' ' ||
  COALESCE(provider_name, '') || ' ' ||
  COALESCE(program_type, '')
)
WHERE status = 'active';

-- Trigger to keep search_vector current
CREATE OR REPLACE FUNCTION update_program_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    COALESCE(NEW.name, '') || ' ' ||
    COALESCE(NEW.description, '') || ' ' ||
    COALESCE(NEW.provider_name, '') || ' ' ||
    COALESCE(NEW.program_type, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_programs_search_vector ON programs;
CREATE TRIGGER trg_programs_search_vector
  BEFORE INSERT OR UPDATE ON programs
  FOR EACH ROW
  EXECUTE FUNCTION update_program_search_vector();

-- -------------------------------------------------------
-- 3. search_programs_ranked RPC
-- -------------------------------------------------------

CREATE OR REPLACE FUNCTION search_programs_ranked(
  p_query TEXT,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_portal_id UUID DEFAULT NULL,
  p_program_type TEXT DEFAULT NULL,
  p_age_min INTEGER DEFAULT NULL,
  p_age_max INTEGER DEFAULT NULL,
  p_categories TEXT[] DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  slug TEXT,
  description TEXT,
  program_type TEXT,
  provider_name TEXT,
  age_min INTEGER,
  age_max INTEGER,
  season TEXT,
  session_start DATE,
  session_end DATE,
  registration_status TEXT,
  registration_url TEXT,
  cost_amount NUMERIC,
  cost_period TEXT,
  tags TEXT[],
  venue_id INTEGER,
  venue_name TEXT,
  venue_neighborhood TEXT,
  venue_slug TEXT,
  portal_id UUID,
  image_url TEXT,
  ts_rank REAL,
  similarity_score REAL,
  combined_score REAL
) AS $$
DECLARE
  v_tsquery tsquery;
  v_search_terms TEXT;
BEGIN
  v_search_terms := regexp_replace(trim(p_query), '\s+', ' & ', 'g') || ':*';
  v_tsquery := to_tsquery('english', v_search_terms);

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.slug,
    p.description,
    p.program_type,
    p.provider_name,
    p.age_min,
    p.age_max,
    p.season,
    p.session_start,
    p.session_end,
    p.registration_status,
    p.registration_url,
    p.cost_amount,
    p.cost_period,
    p.tags,
    p.venue_id,
    v.name AS venue_name,
    v.neighborhood AS venue_neighborhood,
    v.slug AS venue_slug,
    p.portal_id,
    v.image_url AS image_url,
    ts_rank_cd(p.search_vector, v_tsquery, 32)::REAL AS ts_rank,
    similarity(p.name, p_query)::REAL AS similarity_score,
    (
      -- Base text relevance
      (
        ts_rank_cd(p.search_vector, v_tsquery, 32) * 0.7 +
        similarity(p.name, p_query) * 0.3 +
        CASE WHEN lower(p.name) = lower(p_query) THEN 1.0 ELSE 0 END +
        CASE WHEN lower(p.name) LIKE lower(p_query) || '%' THEN 0.5 ELSE 0 END
      )
      -- Registration urgency boost: open registration ranks higher
      * CASE p.registration_status
          WHEN 'open'     THEN 1.4
          WHEN 'upcoming' THEN 1.2
          WHEN 'waitlist' THEN 1.0
          WHEN 'walk_in'  THEN 1.0
          ELSE 0.7
        END
      -- Data completeness multiplier
      * (0.7
          + CASE WHEN p.description IS NOT NULL AND length(p.description) > 50 THEN 0.1 ELSE 0 END
          + CASE WHEN p.venue_id IS NOT NULL THEN 0.1 ELSE 0 END
          + CASE WHEN p.session_start IS NOT NULL THEN 0.1 ELSE 0 END
        )
    )::REAL AS combined_score
  FROM programs p
  LEFT JOIN venues v ON p.venue_id = v.id
  WHERE
    p.status = 'active'
    AND (
      p.search_vector @@ v_tsquery
      OR similarity(p.name, p_query) > 0.2
    )
    -- Portal scoping: REQUIRED for programs
    AND (
      p_portal_id IS NULL
      OR p.portal_id = p_portal_id
    )
    -- Optional filters
    AND (p_program_type IS NULL OR p.program_type = p_program_type)
    AND (p_categories IS NULL OR p.tags && p_categories)
    -- Age range overlap: requested age falls within program's age range
    AND (
      p_age_min IS NULL
      OR p.age_max IS NULL
      OR p.age_max >= p_age_min
    )
    AND (
      p_age_max IS NULL
      OR p.age_min IS NULL
      OR p.age_min <= p_age_max
    )
  ORDER BY combined_score DESC, p.session_start ASC NULLS LAST, p.name ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_programs_ranked(text, integer, integer, uuid, text, integer, integer, text[])
IS 'Full-text search for programs with registration-urgency and data-quality scoring. Portal-scoped. 2026-03-21.';

-- -------------------------------------------------------
-- 4. Update rebuild_entity_search_terms() to use 'program' suggestion_type
-- -------------------------------------------------------
-- Programs were previously indexed as suggestion_type='event', causing
-- autocomplete selections to navigate to event searches with zero results.
-- Now indexed as 'program' so the search layer can route correctly.

CREATE OR REPLACE FUNCTION rebuild_entity_search_terms()
RETURNS void AS $$
BEGIN
  TRUNCATE TABLE entity_search_terms;

  -- Events: primary title
  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type,
    display_term, match_term, city, weight, source
  )
  SELECT
    'event', e.id::TEXT, 'event', 'primary',
    e.title, normalize_search_term(e.title),
    v.city, 1, 'events.title'
  FROM events e
  LEFT JOIN venues v ON v.id = e.venue_id
  WHERE e.start_date >= CURRENT_DATE
    AND COALESCE(e.is_active, TRUE) = TRUE
    AND e.canonical_event_id IS NULL
    AND normalize_search_term(e.title) IS NOT NULL;

  -- Events: artist names
  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type,
    display_term, match_term, city, weight, source
  )
  SELECT
    'event', e.id::TEXT, 'event', 'artist',
    e.title, normalize_search_term(ea.name),
    v.city, 1, 'event_artists.name'
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

  -- Venues: primary name
  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type,
    display_term, match_term, city, weight, source
  )
  SELECT
    'venue', v.id::TEXT, 'venue', 'primary',
    v.name, normalize_search_term(v.name),
    v.city, 1, 'venues.name'
  FROM venues v
  WHERE COALESCE(v.active, TRUE) = TRUE
    AND normalize_search_term(v.name) IS NOT NULL;

  -- Venues: aliases
  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type,
    display_term, match_term, city, weight, source
  )
  SELECT
    'venue', v.id::TEXT, 'venue', 'alias',
    v.name, normalize_search_term(alias.term),
    v.city, 1, 'venues.aliases'
  FROM venues v
  CROSS JOIN LATERAL unnest(COALESCE(v.aliases, '{}'::TEXT[])) AS alias(term)
  WHERE COALESCE(v.active, TRUE) = TRUE
    AND normalize_search_term(v.name) IS NOT NULL
    AND normalize_search_term(alias.term) IS NOT NULL
    AND normalize_search_term(alias.term) <> normalize_search_term(v.name)
  ON CONFLICT DO NOTHING;

  -- Organizers
  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type,
    display_term, match_term, city, weight, source
  )
  SELECT
    'organizer', o.id::TEXT, 'organizer', 'primary',
    o.name, normalize_search_term(o.name),
    o.city, GREATEST(COALESCE(o.total_events_tracked, 1), 1), 'organizations.name'
  FROM organizations o
  WHERE COALESCE(o.hidden, FALSE) = FALSE
    AND normalize_search_term(o.name) IS NOT NULL;

  -- Programs: primary name (NOW as suggestion_type='program', was 'event')
  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type,
    display_term, match_term, city, weight, source
  )
  SELECT
    'program', p.id::TEXT, 'program', 'primary',
    p.name, normalize_search_term(p.name),
    v.city, 1, 'programs.name'
  FROM programs p
  LEFT JOIN venues v ON v.id = p.venue_id
  WHERE p.status = 'active'
    AND normalize_search_term(p.name) IS NOT NULL;

  -- Programs: provider name as alternate match term
  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type,
    display_term, match_term, city, weight, source
  )
  SELECT
    'program', p.id::TEXT, 'program', 'provider',
    p.name, normalize_search_term(p.provider_name),
    v.city, 1, 'programs.provider_name'
  FROM programs p
  LEFT JOIN venues v ON v.id = p.venue_id
  WHERE p.status = 'active'
    AND normalize_search_term(p.name) IS NOT NULL
    AND normalize_search_term(p.provider_name) IS NOT NULL
    AND normalize_search_term(p.provider_name) <> normalize_search_term(p.name)
  ON CONFLICT DO NOTHING;

  -- Programs: venue name as alternate match term
  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type,
    display_term, match_term, city, weight, source
  )
  SELECT
    'program', p.id::TEXT, 'program', 'venue',
    p.name, normalize_search_term(v.name),
    v.city, 1, 'programs.venue'
  FROM programs p
  JOIN venues v ON v.id = p.venue_id
  WHERE p.status = 'active'
    AND normalize_search_term(p.name) IS NOT NULL
    AND normalize_search_term(v.name) IS NOT NULL
    AND normalize_search_term(v.name) <> normalize_search_term(p.name)
  ON CONFLICT DO NOTHING;

  -- Neighborhoods
  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type,
    display_term, match_term, city, weight, source
  )
  SELECT
    'neighborhood',
    normalized_city || ':' || normalized_neighborhood,
    'neighborhood', 'primary',
    display_term, normalized_neighborhood,
    city, frequency, 'venues.neighborhood'
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

  -- Categories from events
  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type,
    display_term, match_term, city, weight, source
  )
  SELECT
    'category', normalize_search_term(e.category_id),
    'category', 'primary',
    MIN(e.category_id), normalize_search_term(e.category_id),
    NULL, COUNT(*)::INTEGER, 'events.category_id'
  FROM events e
  WHERE e.start_date >= CURRENT_DATE
    AND COALESCE(e.is_active, TRUE) = TRUE
    AND e.category_id IS NOT NULL
    AND normalize_search_term(e.category_id) IS NOT NULL
  GROUP BY normalize_search_term(e.category_id);

  -- Tags from events
  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type,
    display_term, match_term, city, weight, source
  )
  SELECT
    'tag', normalize_search_term(tag.term),
    'tag', 'tag',
    MIN(tag.term), normalize_search_term(tag.term),
    NULL, COUNT(*)::INTEGER, 'events.tags'
  FROM events e
  CROSS JOIN LATERAL unnest(COALESCE(e.tags, '{}'::TEXT[])) AS tag(term)
  WHERE e.start_date >= CURRENT_DATE
    AND COALESCE(e.is_active, TRUE) = TRUE
    AND normalize_search_term(tag.term) IS NOT NULL
  GROUP BY normalize_search_term(tag.term)
  HAVING COUNT(*) >= 3;

  -- Tags from programs
  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type,
    display_term, match_term, city, weight, source
  )
  SELECT
    'tag', normalize_search_term(tag.term),
    'tag', 'tag',
    MIN(tag.term), normalize_search_term(tag.term),
    NULL, COUNT(*)::INTEGER, 'programs.tags'
  FROM programs p
  CROSS JOIN LATERAL unnest(COALESCE(p.tags, '{}'::TEXT[])) AS tag(term)
  WHERE p.status = 'active'
    AND normalize_search_term(tag.term) IS NOT NULL
  GROUP BY normalize_search_term(tag.term)
  HAVING COUNT(*) >= 2
  ON CONFLICT DO NOTHING;

  -- Vibes from venues
  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type,
    display_term, match_term, city, weight, source
  )
  SELECT
    'vibe', normalize_search_term(vibe.term),
    'vibe', 'vibe',
    MIN(vibe.term), normalize_search_term(vibe.term),
    NULL, COUNT(*)::INTEGER, 'venues.vibes'
  FROM venues v
  CROSS JOIN LATERAL unnest(COALESCE(v.vibes, '{}'::TEXT[])) AS vibe(term)
  WHERE COALESCE(v.active, TRUE) = TRUE
    AND normalize_search_term(vibe.term) IS NOT NULL
  GROUP BY normalize_search_term(vibe.term)
  HAVING COUNT(*) >= 2;

  -- Festivals
  INSERT INTO entity_search_terms (
    entity_type, entity_id, suggestion_type, term_type,
    display_term, match_term, city, weight, source
  )
  SELECT
    'festival', f.id, 'festival', 'primary',
    f.name, normalize_search_term(f.name),
    NULL, 1, 'festivals.name'
  FROM festivals f
  WHERE normalize_search_term(f.name) IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- -------------------------------------------------------
-- 5. Update search_suggestions materialized view to include 'program' type
-- -------------------------------------------------------

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
  'Autocomplete term index with canonical display text and alias-aware match text. Includes program type.';

-- -------------------------------------------------------
-- 6. Update get_similar_suggestions() to handle 'program' type priority
-- -------------------------------------------------------

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
    v_is_category_like_query := v_query ~ '\m(music|comedy|theater|theatre|art|film|sports|food|drink|brunch|nightlife|fitness|family|free|pottery|ceramics|yoga|camp|class|classes|swim|dance|dj|karaoke|trivia|gymnastics|soccer|baseball|basketball|league|lessons)\M';

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
              WHEN 'program' THEN 280
              WHEN 'category' THEN 180
              WHEN 'vibe' THEN 140
              WHEN 'tag' THEN 80
              ELSE 100
            END
          WHEN v_has_multiple_words OR v_is_category_like_query THEN
            CASE ss.type
              WHEN 'event' THEN 720
              WHEN 'festival' THEN 620
              WHEN 'program' THEN 580
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
              WHEN 'program' THEN 340
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
  'City-scoped canonical suggestions using alias-aware match terms. Includes program type.';

-- -------------------------------------------------------
-- 7. Rebuild corpus + refresh materialized view
-- -------------------------------------------------------

SELECT rebuild_entity_search_terms();
REFRESH MATERIALIZED VIEW search_suggestions;
