-- Theme tracking matrix: repurpose goblin_theme_movies for live check-offs
-- and extend timeline event types.

-- 1. Clear old rows (from broken pre-tagging flow, no real data)
TRUNCATE goblin_theme_movies;

-- 2. Add check-off metadata
ALTER TABLE goblin_theme_movies
  ADD COLUMN IF NOT EXISTS checked_by uuid NOT NULL REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS checked_at timestamptz NOT NULL DEFAULT now();

-- 3. Extend timeline event types
ALTER TABLE goblin_timeline
  DROP CONSTRAINT goblin_timeline_event_type_check;

ALTER TABLE goblin_timeline
  ADD CONSTRAINT goblin_timeline_event_type_check
    CHECK (event_type IN (
      'movie_started', 'movie_finished',
      'theme_added', 'theme_canceled',
      'theme_checked', 'theme_unchecked'
    ));
