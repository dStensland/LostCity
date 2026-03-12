-- ============================================
-- MIGRATION 344: Profile Hang Stats + Expired Hang Cleanup
-- ============================================
-- Enhances get_public_profile RPC with:
--   - hang_count: lifetime hang total (always visible)
--   - friend_count: mutual follow count (always visible)
--   - current_hang: active hang with venue (privacy-gated)
-- Adds cleanup function for expired hangs (call via pg_cron).

-- ============================================================================
-- CLEANUP FUNCTION: expire stale active hangs
-- ============================================================================
-- Call via pg_cron every 15 minutes:
--   SELECT cron.schedule('expire-stale-hangs', '*/15 * * * *', 'SELECT cleanup_expired_hangs()');

CREATE OR REPLACE FUNCTION cleanup_expired_hangs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE hangs
  SET status = 'ended',
      ended_at = auto_expire_at,
      updated_at = NOW()
  WHERE status = 'active'
    AND auto_expire_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION cleanup_expired_hangs() IS
  'Marks expired active hangs as ended. Run via pg_cron every 15 minutes.';

-- ============================================================================
-- UPDATED get_public_profile RPC
-- ============================================================================
-- Adds: hang_count, friend_count, current_hang (privacy-gated by both
-- profile privacy_mode AND the hang's own visibility field).
--
-- Privacy rules for current_hang:
--   Owner: always sees their own active hang
--   open_book profile: follows hang visibility (public → anyone, friends → friends)
--   social profile: hangs visible to friends only (per PRIVACY_MODES description)
--   low_key profile: everything friends-only
--   private visibility hang: owner only, never shown to others

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
  v_profile       profiles%ROWTYPE;
  v_is_own        BOOLEAN := false;
  v_is_friend     BOOLEAN := false;
  v_interests     TEXT[];
  v_spots         JSONB;
  v_portals       JSONB;
  v_hang_count    BIGINT;
  v_friend_count  BIGINT;
  v_current_hang  JSONB;
  v_hang_vis      TEXT;
  v_show_hang     BOOLEAN := false;
  v_result        JSONB;
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

  -- Lifetime hang count (always visible — like follower count)
  SELECT COUNT(*) INTO v_hang_count
  FROM hangs
  WHERE hangs.user_id = v_profile.id
    AND hangs.status IN ('active', 'ended');

  -- Friend count via mutual follows (always visible)
  SELECT COUNT(*) INTO v_friend_count
  FROM follows f1
  JOIN follows f2
    ON f2.follower_id = f1.followed_user_id
   AND f2.followed_user_id = f1.follower_id
  WHERE f1.follower_id = v_profile.id
    AND f1.followed_user_id IS NOT NULL;

  -- Current active hang (gated below)
  SELECT jsonb_build_object(
    'venue_name', v.name,
    'venue_slug', v.slug,
    'venue_neighborhood', v.neighborhood,
    'started_at', h.started_at,
    'note', h.note,
    'visibility', h.visibility
  ), h.visibility
  INTO v_current_hang, v_hang_vis
  FROM hangs h
  JOIN venues v ON v.id = h.venue_id
  WHERE h.user_id = v_profile.id
    AND h.status = 'active'
    AND h.auto_expire_at > NOW()
  LIMIT 1;

  -- Determine if current_hang should be shown to this viewer
  IF v_current_hang IS NOT NULL THEN
    IF v_is_own THEN
      v_show_hang := true;
    ELSIF v_hang_vis = 'private' THEN
      v_show_hang := false;
    ELSIF v_profile.privacy_mode = 'open_book' THEN
      -- Follow hang visibility: public → anyone, friends → friends
      v_show_hang := (v_hang_vis = 'public') OR (v_hang_vis = 'friends' AND v_is_friend);
    ELSE
      -- social + low_key: hangs are friends-only on the profile
      v_show_hang := v_is_friend;
    END IF;
  END IF;

  -- Always-visible base fields (hang_count + friend_count are like follower counts)
  v_result := jsonb_build_object(
    'id',           v_profile.id,
    'username',     v_profile.username,
    'display_name', v_profile.display_name,
    'avatar_url',   v_profile.avatar_url,
    'privacy_mode', v_profile.privacy_mode,
    'created_at',   v_profile.created_at,
    'hang_count',   COALESCE(v_hang_count, 0),
    'friend_count', COALESCE(v_friend_count, 0)
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
    IF v_show_hang THEN
      v_result := v_result || jsonb_build_object('current_hang', v_current_hang);
    END IF;
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

  -- Append current_hang if viewer has access
  IF v_show_hang THEN
    v_result := v_result || jsonb_build_object('current_hang', v_current_hang);
  END IF;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_public_profile(TEXT, UUID) IS
  'Returns a privacy-filtered JSONB profile with hang_count, friend_count, '
  'and optional current_hang. Returns NULL if blocked.';
