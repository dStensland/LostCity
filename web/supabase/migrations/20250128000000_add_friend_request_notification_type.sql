-- Add friend_request to the allowed notification types
-- The existing trigger on friend_requests table creates notifications with type 'friend_request'
-- but this type wasn't in the check constraint

-- Drop and recreate the check constraint with the new type
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN (
    'event_reminder',
    'event_update',
    'event_cancelled',
    'new_follower',
    'friend_request',
    'friend_accepted',
    'event_invite',
    'recommendation',
    'system'
  )
);
