-- Goblin Movie Log: personal diary, tags, public sharing
-- Depends on: goblin_movies, auth.users

-- 1. Relax year constraint on goblin_movies so users can log older films
ALTER TABLE goblin_movies DROP CONSTRAINT IF EXISTS goblin_movies_year_check;
ALTER TABLE goblin_movies ALTER COLUMN year DROP NOT NULL;

-- 2. Tags (user's personal tag library)
CREATE TABLE goblin_tags (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text, -- hex color, auto-assigned if null
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, name)
);

-- 3. Log entries (one per movie-watch event)
CREATE TABLE goblin_log_entries (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_id integer NOT NULL REFERENCES goblin_movies(id),
  watched_date date NOT NULL,
  note text,
  watched_with text,
  sort_order integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Log entry <-> tag join table
CREATE TABLE goblin_log_entry_tags (
  entry_id integer NOT NULL REFERENCES goblin_log_entries(id) ON DELETE CASCADE,
  tag_id integer NOT NULL REFERENCES goblin_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, tag_id)
);

-- 5. Indexes
CREATE INDEX idx_goblin_log_entries_user_date ON goblin_log_entries(user_id, watched_date DESC);
CREATE INDEX idx_goblin_tags_user ON goblin_tags(user_id);

-- 6. RLS
ALTER TABLE goblin_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE goblin_log_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE goblin_log_entry_tags ENABLE ROW LEVEL SECURITY;

-- goblin_tags: owner CRUD, public read
CREATE POLICY "Users manage own tags" ON goblin_tags
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Public read tags" ON goblin_tags
  FOR SELECT USING (true);

-- goblin_log_entries: owner CRUD, public read
CREATE POLICY "Users manage own log entries" ON goblin_log_entries
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Public read log entries" ON goblin_log_entries
  FOR SELECT USING (true);

-- goblin_log_entry_tags: follows entry ownership, public read
CREATE POLICY "Users manage own entry tags" ON goblin_log_entry_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM goblin_log_entries
      WHERE id = entry_id AND user_id = auth.uid()
    )
  );
CREATE POLICY "Public read entry tags" ON goblin_log_entry_tags
  FOR SELECT USING (true);
