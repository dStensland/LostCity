-- Fix notification type mismatch
-- The trigger uses 'friend_request_accepted' but constraint only allows 'friend_accepted'
-- Adding both to be safe

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN (
    'event_reminder',
    'event_update',
    'event_cancelled',
    'new_follower',
    'friend_request',
    'friend_accepted',
    'friend_request_accepted',
    'friend_rsvp',
    'friend_going',
    'venue_event',
    'event_invite',
    'recommendation',
    'system'
  )
);
