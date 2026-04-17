-- Migration: Film Editorial Fields
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.

-- ─── places: film programming + format capability ────────────────────────────
DO $$ BEGIN
  CREATE TYPE programming_style_enum AS ENUM
    ('repertory', 'indie', 'arthouse', 'drive_in', 'festival');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE places
  ADD COLUMN IF NOT EXISTS programming_style programming_style_enum,
  ADD COLUMN IF NOT EXISTS venue_formats TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS founding_year INTEGER;

COMMENT ON COLUMN places.programming_style IS
  'NULL = not an editorial programmer. Set for repertory, arthouse, drive-in, festival, and indie venues to trigger full Programmer''s Board treatment in /explore/film.';

COMMENT ON COLUMN places.venue_formats IS
  'Array of premium-format capability tokens: true_imax, imax, dolby_cinema, 4dx, screenx, rpx, 70mm, 35mm, atmos. Empty array = no premium formats (standard venue or editorial programmer without format specialization).';

COMMENT ON COLUMN places.founding_year IS
  'Displayed as gold accent on editorial program cards (e.g., "Plaza Theatre · 1939"). Set on places with programming_style.';

-- ─── screening_titles: editorial content + premiere flags ───────────────────
DO $$ BEGIN
  CREATE TYPE premiere_scope_enum AS ENUM ('atl', 'us', 'world');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE screening_titles
  ADD COLUMN IF NOT EXISTS editorial_blurb TEXT,
  ADD COLUMN IF NOT EXISTS film_press_quote TEXT,
  ADD COLUMN IF NOT EXISTS film_press_source TEXT,
  ADD COLUMN IF NOT EXISTS is_premiere BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS premiere_scope premiere_scope_enum;

COMMENT ON COLUMN screening_titles.editorial_blurb IS
  'One-line CM-written description reused across all runs of this film. Editorial voice (Programmer''s Board style), not marketing synopsis.';

COMMENT ON COLUMN screening_titles.film_press_quote IS
  'Optional press quote. Named film_* to distinguish from places.editorial_mentions which serves venue reviews.';

COMMENT ON COLUMN screening_titles.film_press_source IS
  'Attribution for film_press_quote — typically a publication name (e.g., ''Little White Lies''). CM-only field; no crawler source.';

COMMENT ON COLUMN screening_titles.is_premiere IS
  'CM-editable flag indicating this film is a premiere in the scope defined by premiere_scope. No crawler source — editorial call.';

COMMENT ON COLUMN screening_titles.premiere_scope IS
  'Scope of the premiere: atl (Atlanta), us (US), world. Only meaningful when is_premiere = true. CM-only.';

-- ─── screening_runs: per-week curator pick flag ─────────────────────────────
ALTER TABLE screening_runs
  ADD COLUMN IF NOT EXISTS is_curator_pick BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS curator_pick_week DATE;

COMMENT ON COLUMN screening_runs.is_curator_pick IS
  'CM-editable weekly pick. Primary editorial signal for the hero cascade in /api/film/this-week.';

COMMENT ON COLUMN screening_runs.curator_pick_week IS
  'ISO week Monday date. When set with is_curator_pick=true, pick is active for that week only. NULL + is_curator_pick=true = ongoing pick until cleared.';

-- ─── indexes for the new query surface ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_places_programming_style
  ON places (programming_style) WHERE programming_style IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_places_venue_formats
  ON places USING GIN (venue_formats);

CREATE INDEX IF NOT EXISTS idx_screening_runs_curator_pick_week
  ON screening_runs (curator_pick_week)
  WHERE is_curator_pick = TRUE;

-- ─── CHECK constraints ───────────────────────────────────────────────────────

-- Invariant: premiere_scope is only set when is_premiere is true
DO $$ BEGIN
  ALTER TABLE screening_titles
    ADD CONSTRAINT check_premiere_scope_requires_flag
    CHECK (premiere_scope IS NULL OR is_premiere = TRUE);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Invariant: curator_pick_week is only set when is_curator_pick is true
DO $$ BEGIN
  ALTER TABLE screening_runs
    ADD CONSTRAINT check_curator_week_requires_pick
    CHECK (curator_pick_week IS NULL OR is_curator_pick = TRUE);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
