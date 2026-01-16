-- 014_friend_requests.sql
-- Friend invite system: friend requests with accept/decline workflow

-- ============================================================================
-- FRIEND REQUESTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The user who sent the invite (owner of the invite link)
  inviter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- The user who received/used the invite link
  invitee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Status of the request
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),

  -- Tracking
  created_at TIMESTAMPTZ DEFAULT now(),
  responded_at TIMESTAMPTZ,

  -- Prevent duplicate requests between same pair
  UNIQUE (inviter_id, invitee_id),

  -- Can't send request to self
  CONSTRAINT no_self_request CHECK (inviter_id != invitee_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_friend_requests_inviter ON friend_requests(inviter_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_invitee ON friend_requests(invitee_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_pending ON friend_requests(invitee_id) WHERE status = 'pending';

-- ============================================================================
-- UPDATE NOTIFICATION TYPES
-- ============================================================================

-- Drop the existing constraint and add new types
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'new_follower', 'friend_rsvp', 'recommendation', 'event_reminder',
  'friend_going', 'venue_event', 'system',
  -- New friend request types
  'friend_request', 'friend_request_accepted'
));

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

-- Users can see friend requests they sent or received
CREATE POLICY friend_requests_select ON friend_requests FOR SELECT
  USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

-- Users can create requests where they are the invitee (via invite link flow)
-- Or via direct friend request (inviter_id = auth.uid())
CREATE POLICY friend_requests_insert ON friend_requests FOR INSERT
  WITH CHECK (auth.uid() = invitee_id OR auth.uid() = inviter_id);

-- Users can update requests where they are the invitee (accept/decline)
CREATE POLICY friend_requests_update ON friend_requests FOR UPDATE
  USING (auth.uid() = invitee_id);

-- Users can delete their own sent or received requests
CREATE POLICY friend_requests_delete ON friend_requests FOR DELETE
  USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Function to create notification when friend request is created
CREATE OR REPLACE FUNCTION notify_friend_request()
RETURNS TRIGGER AS $$
BEGIN
  -- Create notification for the invitee (person who needs to accept)
  INSERT INTO notifications (user_id, type, actor_id)
  VALUES (NEW.invitee_id, 'friend_request', NEW.inviter_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new friend requests
DROP TRIGGER IF EXISTS friend_request_created ON friend_requests;
CREATE TRIGGER friend_request_created
  AFTER INSERT ON friend_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_friend_request();

-- Function to handle friend request acceptance
CREATE OR REPLACE FUNCTION handle_friend_request_response()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process when status changes to 'accepted'
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    -- Create mutual follows (both directions)
    -- First direction: inviter follows invitee
    INSERT INTO follows (follower_id, followed_user_id)
    VALUES (NEW.inviter_id, NEW.invitee_id)
    ON CONFLICT (follower_id, followed_user_id) DO NOTHING;

    -- Second direction: invitee follows inviter
    INSERT INTO follows (follower_id, followed_user_id)
    VALUES (NEW.invitee_id, NEW.inviter_id)
    ON CONFLICT (follower_id, followed_user_id) DO NOTHING;

    -- Update responded_at timestamp
    NEW.responded_at := now();

    -- Create notification for the inviter that their request was accepted
    INSERT INTO notifications (user_id, type, actor_id)
    VALUES (NEW.inviter_id, 'friend_request_accepted', NEW.invitee_id);
  END IF;

  -- Handle declined requests - just update timestamp
  IF NEW.status = 'declined' AND (OLD.status IS NULL OR OLD.status != 'declined') THEN
    NEW.responded_at := now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for friend request status changes
DROP TRIGGER IF EXISTS friend_request_status_change ON friend_requests;
CREATE TRIGGER friend_request_status_change
  BEFORE UPDATE ON friend_requests
  FOR EACH ROW
  EXECUTE FUNCTION handle_friend_request_response();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get pending friend request count for a user
CREATE OR REPLACE FUNCTION get_pending_friend_request_count(target_user_id UUID)
RETURNS INT AS $$
  SELECT COUNT(*)::INT
  FROM friend_requests
  WHERE invitee_id = target_user_id
    AND status = 'pending';
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Check if friend request exists between two users (in either direction)
CREATE OR REPLACE FUNCTION has_pending_friend_request(user_a UUID, user_b UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM friend_requests
    WHERE status = 'pending'
      AND ((inviter_id = user_a AND invitee_id = user_b)
        OR (inviter_id = user_b AND invitee_id = user_a))
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
