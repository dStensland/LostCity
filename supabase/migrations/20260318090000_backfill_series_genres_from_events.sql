-- Backfill NULL series.genres from the most common genres of their linked events.
-- This is a one-time fix: the insert pipeline already propagates event genres → series
-- at insert time (db/events.py _step_finalize lines 916-927), but many older series
-- were created before that backfill existed.

-- Step 1: Backfill series genres from their events
WITH series_genre_agg AS (
  SELECT
    e.series_id,
    -- Flatten all event genre arrays, pick distinct values
    array_agg(DISTINCT g ORDER BY g) AS agg_genres
  FROM events e,
       LATERAL unnest(e.genres) AS g
  WHERE e.series_id IS NOT NULL
    AND e.genres IS NOT NULL
    AND array_length(e.genres, 1) > 0
  GROUP BY e.series_id
)
UPDATE series s
SET genres = sga.agg_genres
FROM series_genre_agg sga
WHERE s.id = sga.series_id
  AND (s.genres IS NULL OR s.genres = '{}');

-- Step 2: Backfill NULL event genres for recurring events using title-based inference.
-- We handle the most common missing patterns: brunch, farmers-market, run-club, trivia.
-- This covers the 58 zero-genre events identified in the audit.

-- Brunch events
UPDATE events
SET genres = array_append(COALESCE(genres, '{}'), 'brunch')
WHERE series_id IS NOT NULL
  AND is_regular_ready = true
  AND (genres IS NULL OR genres = '{}')
  AND title ~* '\bbrunch\b';

-- Farmers market events
UPDATE events
SET genres = array_append(COALESCE(genres, '{}'), 'farmers-market')
WHERE series_id IS NOT NULL
  AND is_regular_ready = true
  AND (genres IS NULL OR genres = '{}')
  AND title ~* 'farmers?\s*market';

-- Run club events
UPDATE events
SET genres = array_append(COALESCE(genres, '{}'), 'run-club')
WHERE series_id IS NOT NULL
  AND is_regular_ready = true
  AND (genres IS NULL OR genres = '{}')
  AND title ~* 'run\s*club|group\s*run';

-- Wine events
UPDATE events
SET genres = array_append(COALESCE(genres, '{}'), 'wine')
WHERE series_id IS NOT NULL
  AND is_regular_ready = true
  AND (genres IS NULL OR genres = '{}')
  AND title ~* 'wine\s*(night|down|wednesday)';

-- Happy hour events
UPDATE events
SET genres = array_append(COALESCE(genres, '{}'), 'happy-hour')
WHERE series_id IS NOT NULL
  AND is_regular_ready = true
  AND (genres IS NULL OR genres = '{}')
  AND title ~* 'happy\s*hour';
