-- =============================================================================
-- Fix RPCs that still reference the old venues table after the places rename.
--
-- The final rename migration (20260328200000) renamed:
--   venues → places
--   places.venue_type → place_type
--   places.active → is_active
--   events.venue_id → place_id
--
-- The following RPCs were not updated in that migration and are now broken:
--   1. get_spot_event_counts       — FROM events JOIN venues; e.venue_id
--   2. get_venue_type_counts       — FROM venues; v.active; v.venue_type
--   3. count_open_spots            — FROM venues; active; venue_type
--   4. get_hot_venues              — JOIN venues v ON v.id = h.venue_id
--   5. get_friends_active_hangs    — JOIN venues v ON v.id = h.venue_id
--   6. get_public_profile          — two JOIN venues v ON v.id = urs/h.venue_id
--
-- Note on hangs.venue_id and user_regular_spots.venue_id:
--   These FK columns were NOT renamed (they are not on the places table itself).
--   Only the table name (venues → places) needs updating in JOIN clauses.
--
-- Note on best_of RPCs (best_of_vote_counts_by_venue, best_of_top_cases):
--   These reference best_of_votes.venue_id and best_of_cases.venue_id —
--   columns on those tables that were also NOT renamed. Those RPCs are fine.
-- =============================================================================

-- ============================================================
-- 1. get_spot_event_counts
--    events.venue_id → events.place_id
--    JOIN venues → JOIN places
--    Return column: venue_id → place_id
-- ============================================================

CREATE OR REPLACE FUNCTION get_spot_event_counts(
  p_start_date DATE,
  p_end_date DATE,
  p_portal_id UUID DEFAULT NULL,
  p_city_names TEXT[] DEFAULT NULL,
  p_limit INTEGER DEFAULT 480
)
RETURNS TABLE(
  place_id INTEGER,
  event_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    e.place_id,
    COUNT(*)::BIGINT AS event_count
  FROM events e
  JOIN places p ON p.id = e.place_id
  WHERE e.place_id IS NOT NULL
    AND e.start_date >= p_start_date
    AND e.start_date <= p_end_date
    AND e.is_active = true
    AND e.canonical_event_id IS NULL
    AND (e.is_sensitive IS NULL OR e.is_sensitive = false)
    AND (e.is_feed_ready IS NULL OR e.is_feed_ready = true)
    AND (
      (p_portal_id IS NOT NULL AND e.portal_id = p_portal_id)
      OR (p_portal_id IS NULL AND e.portal_id IS NULL)
    )
    AND (
      p_city_names IS NULL
      OR array_length(p_city_names, 1) IS NULL
      OR p.city = ANY(p_city_names)
    )
  GROUP BY e.place_id
  ORDER BY event_count DESC, e.place_id ASC
  LIMIT GREATEST(COALESCE(p_limit, 480), 1);
$$;

GRANT EXECUTE ON FUNCTION get_spot_event_counts(DATE, DATE, UUID, TEXT[], INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_spot_event_counts(DATE, DATE, UUID, TEXT[], INTEGER) TO service_role;


-- ============================================================
-- 2. get_venue_type_counts
--    FROM venues v → FROM places p
--    v.active → p.is_active
--    v.venue_type → p.place_type
--    Return column: venue_type → place_type
-- ============================================================

CREATE OR REPLACE FUNCTION get_venue_type_counts(p_city TEXT DEFAULT NULL)
RETURNS TABLE(place_type TEXT, cnt BIGINT)
LANGUAGE sql
STABLE
AS $$
  SELECT p.place_type, COUNT(*) AS cnt
  FROM places p
  WHERE p.is_active = true
    AND p.place_type IS NOT NULL
    AND (p_city IS NULL OR p.city ILIKE '%' || p_city || '%')
  GROUP BY p.place_type;
$$;


-- ============================================================
-- 3. count_open_spots
--    FROM venues → FROM places
--    active → is_active
--    venue_type → place_type
-- ============================================================

CREATE OR REPLACE FUNCTION count_open_spots(
  p_venue_types TEXT[]  DEFAULT NULL,
  p_city        TEXT    DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_now      TIMESTAMPTZ := now() AT TIME ZONE 'America/New_York';
  v_day      TEXT        := LOWER(trim(to_char(v_now, 'Day')));
  v_time     TIME        := v_now::TIME;
  v_count    INT         := 0;
  v_hours    JSONB;
  v_day_hrs  JSONB;
  v_open     TIME;
  v_close    TIME;
BEGIN
  FOR v_hours IN
    SELECT hours
    FROM places
    WHERE is_active = true
      AND hours IS NOT NULL
      AND (p_city IS NULL OR city ILIKE '%' || p_city || '%')
      AND (p_venue_types IS NULL OR place_type = ANY(p_venue_types))
  LOOP
    v_day_hrs := v_hours->v_day;

    CONTINUE WHEN v_day_hrs IS NULL;
    CONTINUE WHEN v_day_hrs->>'open'  IS NULL;
    CONTINUE WHEN v_day_hrs->>'close' IS NULL;

    v_open  := (v_day_hrs->>'open')::TIME;
    v_close := (v_day_hrs->>'close')::TIME;

    IF v_close > v_open THEN
      -- Normal hours: open and close both on the same calendar day
      IF v_time >= v_open AND v_time <= v_close THEN
        v_count := v_count + 1;
      END IF;
    ELSE
      -- Midnight-crossing hours (e.g. open=20:00, close=02:00)
      IF v_time >= v_open OR v_time <= v_close THEN
        v_count := v_count + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;


-- ============================================================
-- 4. get_hot_venues  (defined in hangs migration)
--    JOIN venues v ON v.id = h.venue_id → JOIN places p ON p.id = h.venue_id
--    Return column names kept as venue_* for TS caller compatibility
--    (hangs.venue_id column was NOT renamed — only the table was)
-- ============================================================

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
    p.id AS venue_id,
    p.name AS venue_name,
    p.slug AS venue_slug,
    p.image_url AS venue_image_url,
    p.neighborhood AS venue_neighborhood,
    COUNT(h.id)::BIGINT AS active_count
  FROM hangs h
  JOIN places p ON p.id = h.venue_id
  WHERE h.status = 'active'
    AND h.auto_expire_at > NOW()
    AND h.visibility IN ('friends', 'public')
    AND (p_portal_id IS NULL OR h.portal_id = p_portal_id)
  GROUP BY p.id, p.name, p.slug, p.image_url, p.neighborhood
  ORDER BY active_count DESC
  LIMIT p_limit;
END;
$$;


-- ============================================================
-- 5. get_friends_active_hangs  (defined in hangs migration)
--    JOIN venues v ON v.id = h.venue_id → JOIN places p ON p.id = h.venue_id
--    Return column names kept as venue_* for TS caller compatibility
-- ============================================================

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
    pr.display_name AS profile_display_name,
    pr.username AS profile_username,
    pr.avatar_url AS profile_avatar_url,
    p.name AS venue_name,
    p.slug AS venue_slug,
    p.image_url AS venue_image_url,
    p.neighborhood AS venue_neighborhood
  FROM hangs h
  JOIN get_friend_ids(p_user_id) f ON f.friend_id = h.user_id
  JOIN profiles pr ON pr.id = h.user_id
  JOIN places p ON p.id = h.venue_id
  WHERE h.status = 'active'
    AND h.auto_expire_at > NOW()
    AND h.visibility IN ('friends', 'public')
  ORDER BY h.started_at DESC;
END;
$$;


-- ============================================================
-- 6. get_public_profile  (latest version from migration 353)
--    Two JOIN venues v → JOIN places p
--    (user_regular_spots.venue_id was NOT renamed — only the table)
-- ============================================================

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
  -- Note: user_regular_spots.venue_id was not renamed; join to places table
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'venue_id', p.id,
      'name', p.name,
      'slug', p.slug,
      'neighborhood', p.neighborhood,
      'image_url', p.image_url
    ) ORDER BY urs.added_at DESC
  ), '[]'::JSONB)
  INTO v_spots
  FROM user_regular_spots urs
  JOIN places p ON p.id = urs.venue_id
  WHERE urs.user_id = v_profile.id;

  -- Fetch portal activity (capped at 10 most active portals)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'portal_id', upa.portal_id,
      'portal_slug', por.slug,
      'portal_name', por.name,
      'hang_count', upa.hang_count
    ) ORDER BY upa.hang_count DESC
  ), '[]'::JSONB)
  INTO v_portals
  FROM (
    SELECT portal_id, hang_count
    FROM user_portal_activity
    WHERE user_id = v_profile.id
    ORDER BY hang_count DESC
    LIMIT 10
  ) upa
  JOIN portals por ON por.id = upa.portal_id;

  -- Lifetime hang count (always visible — like follower count)
  SELECT COUNT(*) INTO v_hang_count
  FROM hangs
  WHERE hangs.user_id = v_profile.id
    AND hangs.status IN ('active', 'ended');

  -- Friend count via existing helper (mutual follows)
  v_friend_count := get_friend_count(v_profile.id);

  -- Current active hang (gated below)
  -- Note: hangs.venue_id was not renamed; join to places table
  SELECT jsonb_build_object(
    'venue_name', p.name,
    'venue_slug', p.slug,
    'venue_neighborhood', p.neighborhood,
    'started_at', h.started_at,
    'note', h.note,
    'visibility', h.visibility
  ), h.visibility
  INTO v_current_hang, v_hang_vis
  FROM hangs h
  JOIN places p ON p.id = h.venue_id
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
  'and optional current_hang. Returns NULL if blocked. '
  'Updated in places rename to reference places table instead of venues.';
