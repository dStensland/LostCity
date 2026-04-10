-- Goblin Day: To-Watch List (The Queue)
-- New tables for personal watchlist with tags and ordering.
-- Backfills existing goblin_user_movies.bookmarked rows.

-- 1. Watchlist tags (separate from log tags)
CREATE TABLE goblin_watchlist_tags (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, name)
);

ALTER TABLE goblin_watchlist_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own watchlist tags" ON goblin_watchlist_tags
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Public read watchlist tags" ON goblin_watchlist_tags
  FOR SELECT USING (true);

CREATE INDEX idx_goblin_watchlist_tags_user ON goblin_watchlist_tags(user_id);

-- 2. Watchlist entries
CREATE TABLE goblin_watchlist_entries (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_id integer NOT NULL REFERENCES goblin_movies(id),
  note text,
  sort_order integer,
  added_at timestamptz DEFAULT now(),
  UNIQUE(user_id, movie_id)
);

ALTER TABLE goblin_watchlist_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own watchlist entries" ON goblin_watchlist_entries
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Public read watchlist entries" ON goblin_watchlist_entries
  FOR SELECT USING (true);

CREATE INDEX idx_goblin_watchlist_entries_user_order
  ON goblin_watchlist_entries(user_id, sort_order);

-- 3. Watchlist entry <-> tag join table
CREATE TABLE goblin_watchlist_entry_tags (
  entry_id integer NOT NULL REFERENCES goblin_watchlist_entries(id) ON DELETE CASCADE,
  tag_id integer NOT NULL REFERENCES goblin_watchlist_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, tag_id)
);

ALTER TABLE goblin_watchlist_entry_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own watchlist entry tags" ON goblin_watchlist_entry_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM goblin_watchlist_entries
      WHERE id = entry_id AND user_id = auth.uid()
    )
  );
CREATE POLICY "Public read watchlist entry tags" ON goblin_watchlist_entry_tags
  FOR SELECT USING (true);

-- 4. Backfill existing bookmarks into watchlist
INSERT INTO goblin_watchlist_entries (user_id, movie_id, sort_order, added_at)
SELECT user_id, movie_id,
  ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at),
  created_at
FROM goblin_user_movies
WHERE bookmarked = true
ON CONFLICT (user_id, movie_id) DO NOTHING;
