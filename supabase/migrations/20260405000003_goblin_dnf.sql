-- Add "did not finish" flag to session movies.
-- DNF movies stay in the session watchlist but are excluded from the theme matrix.

ALTER TABLE goblin_session_movies
  ADD COLUMN IF NOT EXISTS dnf boolean NOT NULL DEFAULT false;
