-- ============================================
-- MIGRATION 294: Hangs (Social Check-In)
-- ============================================

CREATE TABLE hangs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
  portal_id UUID REFERENCES portals(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'planned', 'ended')),
  visibility TEXT NOT NULL DEFAULT 'friends' CHECK (visibility IN ('private', 'friends', 'public')),
  note TEXT CHECK (length(note) <= 280),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  planned_for TIMESTAMPTZ,
  auto_expire_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '4 hours'),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (planned_for IS NULL OR status = 'planned'),
  CHECK (ended_at IS NULL OR status = 'ended')
);

CREATE UNIQUE INDEX idx_hangs_user_active ON hangs (user_id) WHERE status = 'active';
CREATE INDEX idx_hangs_venue_active ON hangs (venue_id, status) WHERE status = 'active';
CREATE INDEX idx_hangs_user_status ON hangs (user_id, status, started_at DESC);
CREATE INDEX idx_hangs_auto_expire ON hangs (auto_expire_at) WHERE status = 'active';
CREATE INDEX idx_hangs_portal_status ON hangs (portal_id, status, started_at DESC);

CREATE TRIGGER update_hangs_updated_at
  BEFORE UPDATE ON hangs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE hangs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hangs' AND policyname = 'hangs_select_own'
  ) THEN
    CREATE POLICY hangs_select_own ON hangs
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hangs' AND policyname = 'hangs_select_public_active'
  ) THEN
    CREATE POLICY hangs_select_public_active ON hangs
      FOR SELECT TO authenticated
      USING (visibility = 'public' AND status = 'active' AND auto_expire_at > NOW());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hangs' AND policyname = 'hangs_select_friends_active'
  ) THEN
    CREATE POLICY hangs_select_friends_active ON hangs
      FOR SELECT TO authenticated
      USING (
        visibility IN ('friends', 'public')
        AND status = 'active'
        AND auto_expire_at > NOW()
        AND are_friends(auth.uid(), user_id)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hangs' AND policyname = 'hangs_service_role_all'
  ) THEN
    CREATE POLICY hangs_service_role_all ON hangs
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hangs' AND policyname = 'hangs_insert_own'
  ) THEN
    CREATE POLICY hangs_insert_own ON hangs
      FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hangs' AND policyname = 'hangs_update_own'
  ) THEN
    CREATE POLICY hangs_update_own ON hangs
      FOR UPDATE TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION get_friends_active_hangs(p_user_id UUID)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  venue_id INTEGER,
  event_id INTEGER,
  portal_id UUID,
  status TEXT,
  visibility TEXT,
  note TEXT,
  started_at TIMESTAMPTZ,
  planned_for TIMESTAMPTZ,
  auto_expire_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  profile_display_name TEXT,
  profile_username TEXT,
  profile_avatar_url TEXT,
  venue_name TEXT,
  venue_slug TEXT,
  venue_image_url TEXT,
  venue_neighborhood TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    h.id,
    h.user_id,
    h.venue_id,
    h.event_id,
    h.portal_id,
    h.status,
    h.visibility,
    h.note,
    h.started_at,
    h.planned_for,
    h.auto_expire_at,
    h.ended_at,
    h.created_at,
    h.updated_at,
    p.display_name AS profile_display_name,
    p.username AS profile_username,
    p.avatar_url AS profile_avatar_url,
    v.name AS venue_name,
    v.slug AS venue_slug,
    v.image_url AS venue_image_url,
    v.neighborhood AS venue_neighborhood
  FROM hangs h
  JOIN get_friend_ids(p_user_id) f ON f.friend_id = h.user_id
  JOIN profiles p ON p.id = h.user_id
  JOIN venues v ON v.id = h.venue_id
  WHERE h.status = 'active'
    AND h.auto_expire_at > NOW()
    AND h.visibility IN ('friends', 'public')
  ORDER BY h.started_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION get_venue_hang_counts(p_venue_ids INT[], p_portal_id UUID)
RETURNS TABLE(
  venue_id INTEGER,
  active_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    h.venue_id,
    COUNT(*)::BIGINT AS active_count
  FROM hangs h
  WHERE h.venue_id = ANY(p_venue_ids)
    AND h.status = 'active'
    AND h.auto_expire_at > NOW()
    AND h.visibility IN ('friends', 'public')
    AND (p_portal_id IS NULL OR h.portal_id = p_portal_id)
  GROUP BY h.venue_id;
END;
$$;

CREATE OR REPLACE FUNCTION get_hot_venues(p_portal_id UUID, p_limit INT DEFAULT 8)
RETURNS TABLE(
  venue_id INTEGER,
  venue_name TEXT,
  venue_slug TEXT,
  venue_image_url TEXT,
  venue_neighborhood TEXT,
  active_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id AS venue_id,
    v.name AS venue_name,
    v.slug AS venue_slug,
    v.image_url AS venue_image_url,
    v.neighborhood AS venue_neighborhood,
    COUNT(h.id)::BIGINT AS active_count
  FROM hangs h
  JOIN venues v ON v.id = h.venue_id
  WHERE h.status = 'active'
    AND h.auto_expire_at > NOW()
    AND h.visibility IN ('friends', 'public')
    AND (p_portal_id IS NULL OR h.portal_id = p_portal_id)
  GROUP BY v.id, v.name, v.slug, v.image_url, v.neighborhood
  ORDER BY active_count DESC
  LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION end_and_start_hang(
  p_user_id UUID,
  p_venue_id INT,
  p_event_id INT,
  p_portal_id UUID,
  p_visibility TEXT,
  p_note TEXT,
  p_auto_expire_at TIMESTAMPTZ
)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  venue_id INTEGER,
  event_id INTEGER,
  portal_id UUID,
  status TEXT,
  visibility TEXT,
  note TEXT,
  started_at TIMESTAMPTZ,
  planned_for TIMESTAMPTZ,
  auto_expire_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_id UUID;
BEGIN
  UPDATE hangs
  SET status = 'ended',
      ended_at = NOW(),
      updated_at = NOW()
  WHERE hangs.user_id = p_user_id
    AND hangs.status = 'active';

  INSERT INTO hangs (
    user_id,
    venue_id,
    event_id,
    portal_id,
    status,
    visibility,
    note,
    started_at,
    auto_expire_at
  ) VALUES (
    p_user_id,
    p_venue_id,
    p_event_id,
    p_portal_id,
    'active',
    COALESCE(p_visibility, 'friends'),
    p_note,
    NOW(),
    COALESCE(p_auto_expire_at, NOW() + INTERVAL '4 hours')
  )
  RETURNING hangs.id INTO v_new_id;

  RETURN QUERY
  SELECT
    h.id,
    h.user_id,
    h.venue_id,
    h.event_id,
    h.portal_id,
    h.status,
    h.visibility,
    h.note,
    h.started_at,
    h.planned_for,
    h.auto_expire_at,
    h.ended_at,
    h.created_at,
    h.updated_at
  FROM hangs h
  WHERE h.id = v_new_id;
END;
$$;

COMMENT ON TABLE hangs IS 'Social check-ins: users broadcasting their presence at a venue to friends.';
COMMENT ON COLUMN hangs.status IS 'active = currently there, planned = going later, ended = left or expired.';
COMMENT ON COLUMN hangs.visibility IS 'private = only self, friends = mutual friends, public = anyone.';
COMMENT ON COLUMN hangs.auto_expire_at IS 'Hang auto-ends at this time if not manually ended. Default 4 hours.';
COMMENT ON COLUMN hangs.planned_for IS 'Only set when status=planned. Indicates when user intends to arrive.';
