CREATE TABLE IF NOT EXISTS screening_titles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key TEXT NOT NULL UNIQUE,
  canonical_title TEXT NOT NULL,
  slug TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('film', 'screening_program', 'festival_screening_block')),
  poster_image_url TEXT,
  synopsis TEXT,
  genres TEXT[] NOT NULL DEFAULT '{}',
  tmdb_id INTEGER,
  imdb_id TEXT,
  festival_work_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS screening_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key TEXT NOT NULL UNIQUE,
  screening_title_id UUID NOT NULL REFERENCES screening_titles(id) ON DELETE CASCADE,
  place_id INTEGER REFERENCES places(id) ON DELETE SET NULL,
  festival_id TEXT REFERENCES festivals(id) ON DELETE SET NULL,
  source_id INTEGER REFERENCES sources(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  buy_url TEXT,
  info_url TEXT,
  is_special_event BOOLEAN NOT NULL DEFAULT FALSE,
  screen_name TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS screening_times (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key TEXT NOT NULL UNIQUE,
  screening_run_id UUID NOT NULL REFERENCES screening_runs(id) ON DELETE CASCADE,
  event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
  start_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  ticket_url TEXT,
  source_url TEXT,
  format_labels TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled', 'sold_out')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_screening_runs_place_start_date
  ON screening_runs (place_id, start_date);

CREATE INDEX IF NOT EXISTS idx_screening_runs_festival_start_date
  ON screening_runs (festival_id, start_date);

CREATE INDEX IF NOT EXISTS idx_screening_runs_source_id
  ON screening_runs (source_id);

CREATE INDEX IF NOT EXISTS idx_screening_times_run_start
  ON screening_times (screening_run_id, start_date, start_time);
