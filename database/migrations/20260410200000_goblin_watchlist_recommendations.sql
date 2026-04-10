-- Goblin Day: Watchlist Recommendations
-- Visitors can recommend movies to a queue owner.

CREATE TABLE goblin_watchlist_recommendations (
  id serial PRIMARY KEY,
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_id integer NOT NULL REFERENCES goblin_movies(id),
  recommender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recommender_name text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'added', 'dismissed')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE goblin_watchlist_recommendations ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a recommendation (public endpoint)
CREATE POLICY "Public insert recommendations" ON goblin_watchlist_recommendations
  FOR INSERT WITH CHECK (true);

-- Queue owner can read their own recommendations
CREATE POLICY "Owner read recommendations" ON goblin_watchlist_recommendations
  FOR SELECT USING (auth.uid() = target_user_id);

-- Queue owner can update status (add/dismiss)
CREATE POLICY "Owner update recommendations" ON goblin_watchlist_recommendations
  FOR UPDATE USING (auth.uid() = target_user_id);

-- Partial unique index: authenticated recommenders can't double-recommend
CREATE UNIQUE INDEX idx_watchlist_rec_auth_unique
  ON goblin_watchlist_recommendations (target_user_id, movie_id, recommender_user_id)
  WHERE recommender_user_id IS NOT NULL;

-- Partial unique index: anonymous recommenders deduped by name
CREATE UNIQUE INDEX idx_watchlist_rec_anon_unique
  ON goblin_watchlist_recommendations (target_user_id, movie_id, recommender_name)
  WHERE recommender_user_id IS NULL;

-- Index for efficient pending queries
CREATE INDEX idx_watchlist_rec_pending
  ON goblin_watchlist_recommendations (target_user_id, status);
