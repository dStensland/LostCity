-- Event Invites: Allow users to invite friends to events
-- Migration 050

-- Create event_invites table
CREATE TABLE IF NOT EXISTS event_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'maybe')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  UNIQUE(event_id, inviter_id, invitee_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_event_invites_invitee ON event_invites(invitee_id, status);
CREATE INDEX IF NOT EXISTS idx_event_invites_inviter ON event_invites(inviter_id);
CREATE INDEX IF NOT EXISTS idx_event_invites_event ON event_invites(event_id);
CREATE INDEX IF NOT EXISTS idx_event_invites_created ON event_invites(created_at DESC);

-- RLS policies
ALTER TABLE event_invites ENABLE ROW LEVEL SECURITY;

-- Users can view invites they sent or received
CREATE POLICY "Users can view own invites"
  ON event_invites FOR SELECT
  USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

-- Users can create invites (but only as the inviter)
CREATE POLICY "Users can create invites"
  ON event_invites FOR INSERT
  WITH CHECK (auth.uid() = inviter_id);

-- Users can update invites they received (to accept/decline)
CREATE POLICY "Invitees can respond to invites"
  ON event_invites FOR UPDATE
  USING (auth.uid() = invitee_id)
  WITH CHECK (auth.uid() = invitee_id);

-- Users can delete invites they sent
CREATE POLICY "Inviters can cancel invites"
  ON event_invites FOR DELETE
  USING (auth.uid() = inviter_id);

-- Function to create notification when invite is sent
CREATE OR REPLACE FUNCTION notify_event_invite()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, type, actor_id, event_id, message)
  SELECT
    NEW.invitee_id,
    'event_invite',
    NEW.inviter_id,
    NEW.event_id,
    (SELECT username FROM profiles WHERE id = NEW.inviter_id) || ' invited you to an event';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to notify on new invite
DROP TRIGGER IF EXISTS trigger_notify_event_invite ON event_invites;
CREATE TRIGGER trigger_notify_event_invite
  AFTER INSERT ON event_invites
  FOR EACH ROW
  EXECUTE FUNCTION notify_event_invite();

-- Function to create notification when invite is accepted
CREATE OR REPLACE FUNCTION notify_invite_response()
RETURNS TRIGGER AS $$
BEGIN
  -- Only notify if status changed to accepted
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    INSERT INTO notifications (user_id, type, actor_id, event_id, message)
    SELECT
      NEW.inviter_id,
      'invite_accepted',
      NEW.invitee_id,
      NEW.event_id,
      (SELECT username FROM profiles WHERE id = NEW.invitee_id) || ' accepted your invite';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for invite responses
DROP TRIGGER IF EXISTS trigger_notify_invite_response ON event_invites;
CREATE TRIGGER trigger_notify_invite_response
  AFTER UPDATE ON event_invites
  FOR EACH ROW
  EXECUTE FUNCTION notify_invite_response();

COMMENT ON TABLE event_invites IS 'Event invitations between users';
