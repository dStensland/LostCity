-- ============================================
-- MIGRATION 341: Profile + Hangs Expansion (Phase 1)
-- ============================================
-- Foundation for the social profile and hangs features:
--   - Privacy-tier system on profiles (low_key / social / open_book)
--   - user_regular_spots junction table (replaces denormalized array)
--   - user_portal_activity summary table (trigger-updated)
--   - get_public_profile RPC (privacy-filtered JSONB)
--   - is_profile_complete, is_blocked helpers
--   - enforce_block_unfriend trigger (block cascades to unfriend)
--   - Block propagation into hangs RLS policies

-- ============================================================================
-- PROFILE: privacy_mode column
-- ============================================================================
-- Supersedes is_public boolean with a 3-tier system.
-- interests are NOT stored on profiles — use user_preferences.favorite_categories.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS privacy_mode TEXT NOT NULL DEFAULT 'social'
  CHECK (privacy_mode IN ('low_key', 'social', 'open_book'));

-- Migrate existing is_public = false users to low_key privacy
UPDATE profiles SET privacy_mode = 'low_key' WHERE is_public = false;

-- Index for querying non-low_key profiles (social discovery)
CREATE INDEX IF NOT EXISTS idx_profiles_privacy_mode
  ON profiles (privacy_mode)
  WHERE privacy_mode != 'low_key';

COMMENT ON COLUMN profiles.privacy_mode IS
  'Supersedes is_public. low_key: friends-only; social: bio/interests public, spots to friends; open_book: everything public.';

-- ============================================================================
-- USER REGULAR SPOTS — junction table with referential integrity
-- ============================================================================
-- Replaces a denormalized INT[] on profiles. Proper FK to venues,
-- efficient bidirectional queries, max 10 per user via app-level check.

CREATE TABLE IF NOT EXISTS user_regular_spots (
  user_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  venue_id  INT  NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  added_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, venue_id)
);

CREATE INDEX IF NOT EXISTS idx_user_regular_spots_venue
  ON user_regular_spots (venue_id);

COMMENT ON TABLE user_regular_spots IS
  'Self-selected "my spots" for profile display. Max 10 per user (enforced in API).';

-- RLS: users manage their own spots, anyone can read (privacy filtered at API layer)
ALTER TABLE user_regular_spots ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_regular_spots_select ON user_regular_spots
  FOR SELECT TO authenticated USING (true);

CREATE POLICY user_regular_spots_insert ON user_regular_spots
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY user_regular_spots_delete ON user_regular_spots
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================================================
-- USER PORTAL ACTIVITY — trigger-updated summary table
-- ============================================================================
-- Avoids scanning hangs table at profile-view time.

CREATE TABLE IF NOT EXISTS user_portal_activity (
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  portal_id     UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hang_count    INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, portal_id)
);

COMMENT ON TABLE user_portal_activity IS
  'Aggregated per-user portal activity, updated via trigger on hangs.';

-- Trigger: update portal activity on hang creation
CREATE OR REPLACE FUNCTION update_user_portal_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only track hangs with a portal
  IF NEW.portal_id IS NOT NULL THEN
    INSERT INTO user_portal_activity (user_id, portal_id, last_active_at, hang_count)
    VALUES (NEW.user_id, NEW.portal_id, NOW(), 1)
    ON CONFLICT (user_id, portal_id)
    DO UPDATE SET
      last_active_at = GREATEST(user_portal_activity.last_active_at, NOW()),
      hang_count = user_portal_activity.hang_count + 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_portal_activity ON hangs;
CREATE TRIGGER trg_update_portal_activity
  AFTER INSERT ON hangs
  FOR EACH ROW
  EXECUTE FUNCTION update_user_portal_activity();

-- RLS: public read (privacy filtering done in get_public_profile)
ALTER TABLE user_portal_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_portal_activity_select ON user_portal_activity
  FOR SELECT USING (true);

-- ============================================================================
-- is_blocked HELPER
-- ============================================================================

CREATE OR REPLACE FUNCTION is_blocked(user_a UUID, user_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_blocks
    WHERE (blocker_id = user_a AND blocked_id = user_b)
       OR (blocker_id = user_b AND blocked_id = user_a)
  );
$$;

COMMENT ON FUNCTION is_blocked(UUID, UUID) IS
  'Returns true if either user has blocked the other.';

-- ============================================================================
-- is_profile_complete HELPER
-- ============================================================================

CREATE OR REPLACE FUNCTION is_profile_complete(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id
      AND display_name IS NOT NULL AND display_name != ''
      AND avatar_url   IS NOT NULL AND avatar_url   != ''
  );
$$;

COMMENT ON FUNCTION is_profile_complete(UUID) IS
  'Returns true when the profile has both a display_name and avatar_url set.';

-- ============================================================================
-- ENFORCE BLOCK → UNFRIEND
-- ============================================================================
-- When a user blocks someone, automatically delete friendship + mutual follows.
-- Without this, are_friends() returns true for blocked users, leaking hangs.

CREATE OR REPLACE FUNCTION enforce_block_unfriend()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete mutual follows (friendship = mutual follows in this schema)
  DELETE FROM follows
  WHERE (follower_id = NEW.blocker_id AND followed_user_id = NEW.blocked_id)
     OR (follower_id = NEW.blocked_id AND followed_user_id = NEW.blocker_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_unfriend ON user_blocks;
CREATE TRIGGER trg_block_unfriend
  AFTER INSERT ON user_blocks
  FOR EACH ROW
  EXECUTE FUNCTION enforce_block_unfriend();

-- ============================================================================
-- get_public_profile RPC
-- ============================================================================
-- Returns a privacy-filtered JSONB representation of a profile.
-- NULL is returned when the viewer is blocked by or has blocked the owner.
--
-- Interests come from user_preferences.favorite_categories (not a profile column).
-- Regular spots come from user_regular_spots junction table.
--
-- Field visibility follows three tiers:
--   always:     id, username, display_name, avatar_url, privacy_mode, created_at
--   open_book:  + bio, location, website, interests, regular_spots
--   social:     + bio, location, interests. Friends also get website, regular_spots
--   low_key:    friends get bio, location, interests, regular_spots
--               strangers get nothing extra

CREATE OR REPLACE FUNCTION get_public_profile(
  p_username  TEXT,
  p_viewer_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_profile   profiles%ROWTYPE;
  v_is_own    BOOLEAN := false;
  v_is_friend BOOLEAN := false;
  v_interests TEXT[];
  v_spots     JSONB;
  v_portals   JSONB;
  v_result    JSONB;
BEGIN
  -- Resolve the profile record
  SELECT * INTO v_profile
  FROM profiles
  WHERE username = p_username
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Block check: return NULL if either party has blocked the other
  IF p_viewer_id IS NOT NULL AND is_blocked(v_profile.id, p_viewer_id) THEN
    RETURN NULL;
  END IF;

  -- Determine relationship
  IF p_viewer_id IS NOT NULL THEN
    v_is_own    := (v_profile.id = p_viewer_id);
    v_is_friend := CASE WHEN v_is_own THEN false
                        ELSE are_friends(p_viewer_id, v_profile.id)
                   END;
  END IF;

  -- Fetch interests from user_preferences.favorite_categories
  SELECT favorite_categories INTO v_interests
  FROM user_preferences
  WHERE user_id = v_profile.id;

  -- Fetch regular spots as JSONB array
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'venue_id', v.id,
      'name', v.name,
      'slug', v.slug,
      'neighborhood', v.neighborhood,
      'image_url', v.image_url
    ) ORDER BY urs.added_at DESC
  ), '[]'::JSONB)
  INTO v_spots
  FROM user_regular_spots urs
  JOIN venues v ON v.id = urs.venue_id
  WHERE urs.user_id = v_profile.id;

  -- Fetch portal activity
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'portal_id', upa.portal_id,
      'portal_slug', p.slug,
      'portal_name', p.name,
      'hang_count', upa.hang_count
    ) ORDER BY upa.hang_count DESC
  ), '[]'::JSONB)
  INTO v_portals
  FROM user_portal_activity upa
  JOIN portals p ON p.id = upa.portal_id
  WHERE upa.user_id = v_profile.id;

  -- Always-visible base fields
  v_result := jsonb_build_object(
    'id',           v_profile.id,
    'username',     v_profile.username,
    'display_name', v_profile.display_name,
    'avatar_url',   v_profile.avatar_url,
    'privacy_mode', v_profile.privacy_mode,
    'created_at',   v_profile.created_at
  );

  -- Own profile: return everything
  IF v_is_own THEN
    v_result := v_result || jsonb_build_object(
      'bio',            v_profile.bio,
      'location',       v_profile.location,
      'website',        v_profile.website,
      'interests',      COALESCE(v_interests, '{}'),
      'regular_spots',  v_spots,
      'portal_activity', v_portals,
      'is_own',         true
    );
    RETURN v_result;
  END IF;

  -- Apply privacy tier
  IF v_profile.privacy_mode = 'open_book' THEN
    v_result := v_result || jsonb_build_object(
      'bio',            v_profile.bio,
      'location',       v_profile.location,
      'website',        v_profile.website,
      'interests',      COALESCE(v_interests, '{}'),
      'regular_spots',  v_spots,
      'portal_activity', v_portals
    );

  ELSIF v_profile.privacy_mode = 'social' THEN
    -- bio, location, interests, portal_activity always visible
    -- website + regular_spots only to friends
    v_result := v_result || jsonb_build_object(
      'bio',            v_profile.bio,
      'location',       v_profile.location,
      'interests',      COALESCE(v_interests, '{}'),
      'portal_activity', v_portals
    );
    IF v_is_friend THEN
      v_result := v_result || jsonb_build_object(
        'website',       v_profile.website,
        'regular_spots', v_spots
      );
    END IF;

  ELSIF v_profile.privacy_mode = 'low_key' THEN
    -- Friends only; strangers see nothing extra
    IF v_is_friend THEN
      v_result := v_result || jsonb_build_object(
        'bio',            v_profile.bio,
        'location',       v_profile.location,
        'interests',      COALESCE(v_interests, '{}'),
        'regular_spots',  v_spots,
        'portal_activity', v_portals
      );
    END IF;
  END IF;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_public_profile(TEXT, UUID) IS
  'Returns a privacy-filtered JSONB profile. Interests from user_preferences, '
  'spots from user_regular_spots junction table. Returns NULL if blocked.';

-- ============================================================================
-- BLOCK PROPAGATION: hangs RLS policies
-- ============================================================================

DROP POLICY IF EXISTS hangs_select_public_active ON hangs;
CREATE POLICY hangs_select_public_active ON hangs
  FOR SELECT TO authenticated
  USING (
    visibility = 'public'
    AND status = 'active'
    AND auto_expire_at > NOW()
    AND NOT EXISTS (
      SELECT 1 FROM user_blocks
      WHERE (blocker_id = auth.uid() AND blocked_id = hangs.user_id)
         OR (blocker_id = hangs.user_id AND blocked_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS hangs_select_friends_active ON hangs;
CREATE POLICY hangs_select_friends_active ON hangs
  FOR SELECT TO authenticated
  USING (
    visibility IN ('friends', 'public')
    AND status = 'active'
    AND auto_expire_at > NOW()
    AND are_friends(auth.uid(), user_id)
    AND NOT EXISTS (
      SELECT 1 FROM user_blocks
      WHERE (blocker_id = auth.uid() AND blocked_id = hangs.user_id)
         OR (blocker_id = hangs.user_id AND blocked_id = auth.uid())
    )
  );
