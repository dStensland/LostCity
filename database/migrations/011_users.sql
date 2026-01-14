-- 011_users.sql
-- User Management System: profiles, preferences, social graph, RSVPs, recommendations, activities

-- ============================================================================
-- CORE USER TABLES
-- ============================================================================

-- User profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  location TEXT,  -- e.g., "Atlanta, GA"
  website TEXT,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Validate username format (lowercase alphanumeric, underscores, 3-30 chars)
ALTER TABLE profiles ADD CONSTRAINT username_format
  CHECK (username ~ '^[a-z0-9_]{3,30}$');

-- User preferences for personalization
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  favorite_categories TEXT[],       -- ['music', 'comedy', 'art']
  favorite_neighborhoods TEXT[],    -- ['East Atlanta', 'Midtown']
  favorite_vibes TEXT[],            -- ['divey', 'late-night']
  price_preference TEXT,            -- 'free', 'budget', 'any'
  notification_settings JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- SOCIAL GRAPH
-- ============================================================================

-- Follows (users, venues, organizations)
CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Polymorphic: exactly one of these will be set
  followed_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  followed_venue_id INT REFERENCES venues(id) ON DELETE CASCADE,
  followed_org_id INT REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Ensure exactly one follow target
  CONSTRAINT one_follow_target CHECK (
    (followed_user_id IS NOT NULL)::int +
    (followed_venue_id IS NOT NULL)::int +
    (followed_org_id IS NOT NULL)::int = 1
  ),
  -- Prevent self-follows
  CONSTRAINT no_self_follow CHECK (follower_id != followed_user_id),
  -- Prevent duplicate follows
  UNIQUE (follower_id, followed_user_id),
  UNIQUE (follower_id, followed_venue_id),
  UNIQUE (follower_id, followed_org_id)
);

-- Block/mute users
CREATE TABLE IF NOT EXISTS user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_muted BOOLEAN DEFAULT false,  -- Mute = hide from feed, Block = full block
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (blocker_id, blocked_id),
  CONSTRAINT no_self_block CHECK (blocker_id != blocked_id)
);

-- ============================================================================
-- USER ACTIONS ON EVENTS/VENUES
-- ============================================================================

-- Event RSVPs / attendance
CREATE TABLE IF NOT EXISTS event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('going', 'interested', 'went')),
  visibility TEXT DEFAULT 'friends' CHECK (visibility IN ('public', 'friends', 'private')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, event_id)
);

-- Recommendations (user endorses something)
CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Polymorphic target
  event_id INT REFERENCES events(id) ON DELETE CASCADE,
  venue_id INT REFERENCES venues(id) ON DELETE CASCADE,
  org_id INT REFERENCES organizations(id) ON DELETE CASCADE,
  note TEXT,  -- Optional comment/reason
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'friends', 'private')),
  created_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT one_rec_target CHECK (
    (event_id IS NOT NULL)::int +
    (venue_id IS NOT NULL)::int +
    (org_id IS NOT NULL)::int = 1
  )
);

-- Saved/bookmarked items
CREATE TABLE IF NOT EXISTS saved_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id INT REFERENCES events(id) ON DELETE CASCADE,
  venue_id INT REFERENCES venues(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT one_saved_target CHECK (
    (event_id IS NOT NULL)::int +
    (venue_id IS NOT NULL)::int = 1
  ),
  -- Prevent duplicate saves
  UNIQUE (user_id, event_id),
  UNIQUE (user_id, venue_id)
);

-- ============================================================================
-- ACTIVITY FEED & NOTIFICATIONS
-- ============================================================================

-- Activity items for feed
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'rsvp', 'recommendation', 'follow_user', 'follow_venue', 'follow_org', 'check_in', 'save'
  )),
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'friends', 'private')),
  -- Polymorphic references (what the activity is about)
  event_id INT REFERENCES events(id) ON DELETE CASCADE,
  venue_id INT REFERENCES venues(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  org_id INT REFERENCES organizations(id) ON DELETE CASCADE,
  metadata JSONB DEFAULT '{}',  -- Additional context (e.g., RSVP status, note text)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'new_follower', 'friend_rsvp', 'recommendation', 'event_reminder',
    'friend_going', 'venue_event', 'system'
  )),
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  event_id INT REFERENCES events(id) ON DELETE CASCADE,
  venue_id INT REFERENCES venues(id) ON DELETE CASCADE,
  message TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Follows indexes
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_user ON follows(followed_user_id) WHERE followed_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_follows_venue ON follows(followed_venue_id) WHERE followed_venue_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_follows_org ON follows(followed_org_id) WHERE followed_org_id IS NOT NULL;

-- RSVP indexes
CREATE INDEX IF NOT EXISTS idx_event_rsvps_event ON event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_user ON event_rsvps(user_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_status ON event_rsvps(status) WHERE status = 'going';

-- Activity indexes
CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(activity_type);

-- Notification indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;

-- Profile indexes
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_public ON profiles(is_public) WHERE is_public = true;

-- Saved items indexes
CREATE INDEX IF NOT EXISTS idx_saved_items_user ON saved_items(user_id);

-- Recommendations indexes
CREATE INDEX IF NOT EXISTS idx_recommendations_user ON recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_event ON recommendations(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recommendations_venue ON recommendations(venue_id) WHERE venue_id IS NOT NULL;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROFILES POLICIES
-- ============================================================================

-- Anyone can view public profiles
CREATE POLICY profiles_select_public ON profiles FOR SELECT
  USING (is_public = true);

-- Users can always view their own profile
CREATE POLICY profiles_select_own ON profiles FOR SELECT
  USING (id = auth.uid());

-- Users can only update their own profile
CREATE POLICY profiles_update_own ON profiles FOR UPDATE
  USING (id = auth.uid());

-- Users can insert their own profile (on signup)
CREATE POLICY profiles_insert_own ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- ============================================================================
-- USER PREFERENCES POLICIES
-- ============================================================================

-- Users can only view their own preferences
CREATE POLICY user_preferences_select_own ON user_preferences FOR SELECT
  USING (user_id = auth.uid());

-- Users can only update their own preferences
CREATE POLICY user_preferences_update_own ON user_preferences FOR UPDATE
  USING (user_id = auth.uid());

-- Users can insert their own preferences
CREATE POLICY user_preferences_insert_own ON user_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- FOLLOWS POLICIES
-- ============================================================================

-- Anyone can see who follows public users
CREATE POLICY follows_select_public ON follows FOR SELECT
  USING (
    -- Can see own follows
    follower_id = auth.uid()
    -- Can see follows of users we follow
    OR followed_user_id = auth.uid()
    -- Can see all follows to public users
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = follows.followed_user_id
      AND profiles.is_public = true
    )
    -- Can see venue/org follows
    OR followed_venue_id IS NOT NULL
    OR followed_org_id IS NOT NULL
  );

-- Users can create their own follows
CREATE POLICY follows_insert_own ON follows FOR INSERT
  WITH CHECK (follower_id = auth.uid());

-- Users can delete their own follows
CREATE POLICY follows_delete_own ON follows FOR DELETE
  USING (follower_id = auth.uid());

-- ============================================================================
-- USER BLOCKS POLICIES
-- ============================================================================

-- Users can only see their own blocks
CREATE POLICY user_blocks_select_own ON user_blocks FOR SELECT
  USING (blocker_id = auth.uid());

-- Users can create their own blocks
CREATE POLICY user_blocks_insert_own ON user_blocks FOR INSERT
  WITH CHECK (blocker_id = auth.uid());

-- Users can delete their own blocks
CREATE POLICY user_blocks_delete_own ON user_blocks FOR DELETE
  USING (blocker_id = auth.uid());

-- ============================================================================
-- EVENT RSVPS POLICIES
-- ============================================================================

-- Public RSVPs visible to all, friends-only to friends, private only to self
CREATE POLICY event_rsvps_select ON event_rsvps FOR SELECT
  USING (
    -- Own RSVPs always visible
    user_id = auth.uid()
    -- Public RSVPs visible to all
    OR visibility = 'public'
    -- Friends-only RSVPs visible to mutual followers
    OR (
      visibility = 'friends'
      AND EXISTS (
        SELECT 1 FROM follows f1
        JOIN follows f2 ON f1.follower_id = f2.followed_user_id
          AND f1.followed_user_id = f2.follower_id
        WHERE f1.follower_id = auth.uid()
        AND f1.followed_user_id = event_rsvps.user_id
      )
    )
  );

-- Users can create their own RSVPs
CREATE POLICY event_rsvps_insert_own ON event_rsvps FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own RSVPs
CREATE POLICY event_rsvps_update_own ON event_rsvps FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own RSVPs
CREATE POLICY event_rsvps_delete_own ON event_rsvps FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- RECOMMENDATIONS POLICIES
-- ============================================================================

-- Similar visibility rules as RSVPs
CREATE POLICY recommendations_select ON recommendations FOR SELECT
  USING (
    user_id = auth.uid()
    OR visibility = 'public'
    OR (
      visibility = 'friends'
      AND EXISTS (
        SELECT 1 FROM follows f1
        JOIN follows f2 ON f1.follower_id = f2.followed_user_id
          AND f1.followed_user_id = f2.follower_id
        WHERE f1.follower_id = auth.uid()
        AND f1.followed_user_id = recommendations.user_id
      )
    )
  );

CREATE POLICY recommendations_insert_own ON recommendations FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY recommendations_update_own ON recommendations FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY recommendations_delete_own ON recommendations FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- SAVED ITEMS POLICIES
-- ============================================================================

-- Saved items are private to each user
CREATE POLICY saved_items_select_own ON saved_items FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY saved_items_insert_own ON saved_items FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY saved_items_delete_own ON saved_items FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- ACTIVITIES POLICIES
-- ============================================================================

-- Activities follow same visibility pattern
CREATE POLICY activities_select ON activities FOR SELECT
  USING (
    user_id = auth.uid()
    OR visibility = 'public'
    OR (
      visibility = 'friends'
      AND EXISTS (
        SELECT 1 FROM follows f1
        JOIN follows f2 ON f1.follower_id = f2.followed_user_id
          AND f1.followed_user_id = f2.follower_id
        WHERE f1.follower_id = auth.uid()
        AND f1.followed_user_id = activities.user_id
      )
    )
  );

CREATE POLICY activities_insert_own ON activities FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- NOTIFICATIONS POLICIES
-- ============================================================================

-- Users can only see their own notifications
CREATE POLICY notifications_select_own ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- System can insert notifications (via service role)
CREATE POLICY notifications_insert_system ON notifications FOR INSERT
  WITH CHECK (true);  -- Will be restricted by service role usage

-- Users can update their own notifications (mark as read)
CREATE POLICY notifications_update_own ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to check if two users are friends (mutual followers)
CREATE OR REPLACE FUNCTION are_friends(user_a UUID, user_b UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM follows f1
    JOIN follows f2 ON f1.follower_id = f2.followed_user_id
      AND f1.followed_user_id = f2.follower_id
    WHERE f1.follower_id = user_a
    AND f1.followed_user_id = user_b
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get follower count for a user
CREATE OR REPLACE FUNCTION get_follower_count(target_user_id UUID)
RETURNS INT AS $$
BEGIN
  RETURN (
    SELECT COUNT(*) FROM follows
    WHERE followed_user_id = target_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get following count for a user
CREATE OR REPLACE FUNCTION get_following_count(target_user_id UUID)
RETURNS INT AS $$
BEGIN
  RETURN (
    SELECT COUNT(*) FROM follows
    WHERE follower_id = target_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get friend count (mutual follows)
CREATE OR REPLACE FUNCTION get_friend_count(target_user_id UUID)
RETURNS INT AS $$
BEGIN
  RETURN (
    SELECT COUNT(*) FROM follows f1
    JOIN follows f2 ON f1.follower_id = f2.followed_user_id
      AND f1.followed_user_id = f2.follower_id
    WHERE f1.follower_id = target_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update profiles.updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER event_rsvps_updated_at
  BEFORE UPDATE ON event_rsvps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- ACTIVITY TRIGGER (auto-create activities on actions)
-- ============================================================================

-- Auto-create activity when RSVP is created
CREATE OR REPLACE FUNCTION create_rsvp_activity()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO activities (user_id, activity_type, visibility, event_id, metadata)
  VALUES (
    NEW.user_id,
    'rsvp',
    NEW.visibility,
    NEW.event_id,
    jsonb_build_object('status', NEW.status)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER event_rsvps_activity
  AFTER INSERT ON event_rsvps
  FOR EACH ROW
  EXECUTE FUNCTION create_rsvp_activity();

-- Auto-create activity when recommendation is created
CREATE OR REPLACE FUNCTION create_recommendation_activity()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO activities (
    user_id, activity_type, visibility, event_id, venue_id, org_id, metadata
  )
  VALUES (
    NEW.user_id,
    'recommendation',
    NEW.visibility,
    NEW.event_id,
    NEW.venue_id,
    NEW.org_id,
    CASE WHEN NEW.note IS NOT NULL
      THEN jsonb_build_object('note', NEW.note)
      ELSE '{}'
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER recommendations_activity
  AFTER INSERT ON recommendations
  FOR EACH ROW
  EXECUTE FUNCTION create_recommendation_activity();

-- Auto-create activity when follow is created
CREATE OR REPLACE FUNCTION create_follow_activity()
RETURNS TRIGGER AS $$
DECLARE
  activity_type_val TEXT;
BEGIN
  -- Determine activity type based on what's being followed
  IF NEW.followed_user_id IS NOT NULL THEN
    activity_type_val := 'follow_user';
  ELSIF NEW.followed_venue_id IS NOT NULL THEN
    activity_type_val := 'follow_venue';
  ELSE
    activity_type_val := 'follow_org';
  END IF;

  INSERT INTO activities (
    user_id, activity_type, visibility, target_user_id, venue_id, org_id
  )
  VALUES (
    NEW.follower_id,
    activity_type_val,
    'public',  -- Follows are public by default
    NEW.followed_user_id,
    NEW.followed_venue_id,
    NEW.followed_org_id
  );

  -- Create notification for followed user
  IF NEW.followed_user_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, actor_id)
    VALUES (NEW.followed_user_id, 'new_follower', NEW.follower_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER follows_activity
  AFTER INSERT ON follows
  FOR EACH ROW
  EXECUTE FUNCTION create_follow_activity();
