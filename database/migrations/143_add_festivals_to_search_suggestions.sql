-- Migration: Add festival names to search_suggestions materialized view
-- This makes festivals discoverable via the unified search system

-- Recreate the materialized view with festival names added
DROP MATERIALIZED VIEW IF EXISTS search_suggestions;

CREATE MATERIALIZED VIEW search_suggestions AS
WITH
  -- Event titles (upcoming events only)
  event_titles AS (
    SELECT DISTINCT
      title AS text,
      'event' AS type,
      COUNT(*) AS frequency
    FROM events
    WHERE start_date >= CURRENT_DATE
      AND canonical_event_id IS NULL
    GROUP BY title
  ),

  -- Active venue names
  venue_names AS (
    SELECT
      name AS text,
      'venue' AS type,
      COUNT(*)::BIGINT AS frequency
    FROM venues
    WHERE active = true
    GROUP BY name
  ),

  -- Distinct neighborhoods from venues
  neighborhoods AS (
    SELECT DISTINCT
      neighborhood AS text,
      'neighborhood' AS type,
      COUNT(*) AS frequency
    FROM venues
    WHERE neighborhood IS NOT NULL
      AND active = true
    GROUP BY neighborhood
  ),

  -- Event producers (non-hidden)
  producers AS (
    SELECT
      name AS text,
      'organizer' AS type,
      COALESCE(total_events_tracked, 1) AS frequency
    FROM event_producers
    WHERE hidden = false
  ),

  -- Distinct categories from events
  categories AS (
    SELECT DISTINCT
      category AS text,
      'category' AS type,
      COUNT(*) AS frequency
    FROM events
    WHERE category IS NOT NULL
      AND start_date >= CURRENT_DATE
    GROUP BY category
  ),

  -- Tags from upcoming events (only those appearing 3+ times)
  tags AS (
    SELECT
      UNNEST(tags) AS text,
      'tag' AS type,
      COUNT(*) AS frequency
    FROM events
    WHERE start_date >= CURRENT_DATE
      AND tags IS NOT NULL
    GROUP BY 1
    HAVING COUNT(*) >= 3
  ),

  -- Venue vibes (for discovery)
  vibes AS (
    SELECT DISTINCT
      UNNEST(vibes) AS text,
      'vibe' AS type,
      COUNT(*) AS frequency
    FROM venues
    WHERE vibes IS NOT NULL
      AND active = true
    GROUP BY 1
    HAVING COUNT(*) >= 2
  ),

  -- Festival names
  festival_names AS (
    SELECT
      name AS text,
      'festival' AS type,
      1::BIGINT AS frequency
    FROM festivals
    WHERE is_deactivated IS NOT TRUE
  )

SELECT text, type, frequency FROM event_titles WHERE text IS NOT NULL AND length(text) > 0
UNION ALL
SELECT text, type, frequency FROM venue_names WHERE text IS NOT NULL AND length(text) > 0
UNION ALL
SELECT text, type, frequency FROM neighborhoods WHERE text IS NOT NULL AND length(text) > 0
UNION ALL
SELECT text, type, frequency FROM producers WHERE text IS NOT NULL AND length(text) > 0
UNION ALL
SELECT text, type, frequency FROM categories WHERE text IS NOT NULL AND length(text) > 0
UNION ALL
SELECT text, type, frequency FROM tags WHERE text IS NOT NULL AND length(text) > 0
UNION ALL
SELECT text, type, frequency FROM vibes WHERE text IS NOT NULL AND length(text) > 0
UNION ALL
SELECT text, type, frequency FROM festival_names WHERE text IS NOT NULL AND length(text) > 0;

-- Recreate indexes
CREATE INDEX idx_search_suggestions_text_trgm ON search_suggestions USING GIN(text gin_trgm_ops);
CREATE INDEX idx_search_suggestions_type ON search_suggestions(type);
CREATE INDEX idx_search_suggestions_frequency ON search_suggestions(frequency DESC);
CREATE UNIQUE INDEX idx_search_suggestions_unique ON search_suggestions(text, type);

-- Refresh function already exists from migration 048
REFRESH MATERIALIZED VIEW search_suggestions;
