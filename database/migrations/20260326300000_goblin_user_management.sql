-- Goblin Day user management
-- Adds per-user movie state, named lists, session membership, and migrates
-- goblin_sessions.is_active → status + invite_code.
-- NOTE: old proposed/watched/daniel_list/ashley_list columns on goblin_movies
-- are NOT dropped here — they will be removed in a follow-up migration after
-- data migration runs.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. goblin_user_movies — per-user movie state
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goblin_user_movies (
  user_id   uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_id  integer NOT NULL REFERENCES goblin_movies(id) ON DELETE CASCADE,
  bookmarked boolean NOT NULL DEFAULT false,
  watched   boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, movie_id)
);

ALTER TABLE goblin_user_movies ENABLE ROW LEVEL SECURITY;

-- Authenticated users read/write their own rows
CREATE POLICY "goblin_user_movies_own"
  ON goblin_user_movies
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Public SELECT (anon can read aggregate state if needed)
CREATE POLICY "goblin_user_movies_public_select"
  ON goblin_user_movies
  FOR SELECT
  USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. goblin_lists — named custom lists
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goblin_lists (
  id         serial PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE goblin_lists ENABLE ROW LEVEL SECURITY;

-- Users manage their own lists
CREATE POLICY "goblin_lists_own"
  ON goblin_lists
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Public SELECT
CREATE POLICY "goblin_lists_public_select"
  ON goblin_lists
  FOR SELECT
  USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. goblin_list_movies — join table for lists
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goblin_list_movies (
  list_id   integer NOT NULL REFERENCES goblin_lists(id) ON DELETE CASCADE,
  movie_id  integer NOT NULL REFERENCES goblin_movies(id) ON DELETE CASCADE,
  added_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, movie_id)
);

ALTER TABLE goblin_list_movies ENABLE ROW LEVEL SECURITY;

-- List owner manages entries (checked via parent goblin_lists row)
CREATE POLICY "goblin_list_movies_owner"
  ON goblin_list_movies
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM goblin_lists
      WHERE goblin_lists.id = goblin_list_movies.list_id
        AND goblin_lists.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM goblin_lists
      WHERE goblin_lists.id = goblin_list_movies.list_id
        AND goblin_lists.user_id = auth.uid()
    )
  );

-- Public SELECT
CREATE POLICY "goblin_list_movies_public_select"
  ON goblin_list_movies
  FOR SELECT
  USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. goblin_session_members — who's in a session
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goblin_session_members (
  id         serial PRIMARY KEY,
  session_id integer NOT NULL REFERENCES goblin_sessions(id) ON DELETE CASCADE,
  user_id    uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text    NOT NULL CHECK (role IN ('host', 'member')),
  joined_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id)
);

ALTER TABLE goblin_session_members ENABLE ROW LEVEL SECURITY;

-- Public SELECT
CREATE POLICY "goblin_session_members_public_select"
  ON goblin_session_members
  FOR SELECT
  USING (true);

-- Authenticated users can insert themselves
CREATE POLICY "goblin_session_members_self_insert"
  ON goblin_session_members
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. goblin_sessions — add created_by, invite_code, status; drop is_active
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE goblin_sessions
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS invite_code text,
  ADD COLUMN IF NOT EXISTS status text
    CHECK (status IN ('planning', 'live', 'ended'))
    DEFAULT 'ended';

-- Backfill status from is_active (only if is_active column still exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'goblin_sessions' AND column_name = 'is_active'
  ) THEN
    UPDATE goblin_sessions
    SET status = CASE WHEN is_active THEN 'live' ELSE 'ended' END
    WHERE status IS NULL;
  END IF;
END;
$$;

-- Generate invite_code for existing rows that don't have one (8 hex chars from md5 of id)
UPDATE goblin_sessions
SET invite_code = substring(md5(id::text || '-goblin'), 1, 8)
WHERE invite_code IS NULL;

-- Now safe to make invite_code NOT NULL + UNIQUE
ALTER TABLE goblin_sessions
  ALTER COLUMN invite_code SET NOT NULL;

ALTER TABLE goblin_sessions
  ADD CONSTRAINT goblin_sessions_invite_code_unique UNIQUE (invite_code);

-- Drop is_active (replaced by status)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'goblin_sessions' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE goblin_sessions DROP COLUMN is_active;
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. goblin_session_movies — add proposed_by
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE goblin_session_movies
  ADD COLUMN IF NOT EXISTS proposed_by uuid REFERENCES auth.users(id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. goblin_timeline — add user_id
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE goblin_timeline
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Indexes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_goblin_sessions_invite_code
  ON goblin_sessions (invite_code);

CREATE INDEX IF NOT EXISTS idx_goblin_user_movies_user
  ON goblin_user_movies (user_id);
