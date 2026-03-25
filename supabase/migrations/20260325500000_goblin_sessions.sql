-- Goblin Day sessions — live movie watching with themes
CREATE TABLE goblin_sessions (
  id serial PRIMARY KEY,
  name text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE goblin_session_movies (
  id serial PRIMARY KEY,
  session_id integer NOT NULL REFERENCES goblin_sessions(id) ON DELETE CASCADE,
  movie_id integer NOT NULL REFERENCES goblin_movies(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  watch_order integer NOT NULL,
  UNIQUE(session_id, movie_id)
);

CREATE TABLE goblin_themes (
  id serial PRIMARY KEY,
  session_id integer NOT NULL REFERENCES goblin_sessions(id) ON DELETE CASCADE,
  label text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  canceled_at timestamptz
);

CREATE TABLE goblin_theme_movies (
  theme_id integer NOT NULL REFERENCES goblin_themes(id) ON DELETE CASCADE,
  movie_id integer NOT NULL REFERENCES goblin_movies(id) ON DELETE CASCADE,
  PRIMARY KEY (theme_id, movie_id)
);

CREATE TABLE goblin_timeline (
  id serial PRIMARY KEY,
  session_id integer NOT NULL REFERENCES goblin_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('movie_started', 'movie_finished', 'theme_added', 'theme_canceled')),
  movie_id integer REFERENCES goblin_movies(id),
  theme_id integer REFERENCES goblin_themes(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE goblin_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goblin_sessions_public" ON goblin_sessions FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE goblin_session_movies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goblin_session_movies_public" ON goblin_session_movies FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE goblin_themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goblin_themes_public" ON goblin_themes FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE goblin_theme_movies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goblin_theme_movies_public" ON goblin_theme_movies FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE goblin_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goblin_timeline_public" ON goblin_timeline FOR ALL USING (true) WITH CHECK (true);
