-- Migration: Add friend_joining notification type + performance indexes
-- Your People — notification type + performance indexes
-- 1. Add friend_joining notification type for "I'm in" feature
-- 2. Composite index on event_rsvps for friend-signal query
-- 3. Index on saved_items(event_id) — currently missing, causes table scan
-- 4. Partial index on notifications for throttle lookups

-- 1. Notification type
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'new_follower', 'friend_rsvp', 'recommendation', 'event_reminder',
  'friend_going', 'venue_event', 'system', 'event_invite', 'invite_accepted',
  'submission_approved', 'submission_rejected', 'submission_needs_edit',
  'friend_request', 'friend_request_accepted',
  'plan_join', 'plan_rsvp_change',
  -- Your People: "I'm in" notification
  'friend_joining'
));

-- 2. Composite index: friend-signal query scans rsvps by user+status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_rsvps_user_status_event
  ON event_rsvps(user_id, status, event_id);

-- 3. saved_items event_id index (currently only has user_id index)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_saved_items_event_id
  ON saved_items(event_id) WHERE event_id IS NOT NULL;

-- 4. Notification throttle: quick "was this person notified in last 24h?"
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_friend_joining_throttle
  ON notifications(event_id, user_id, created_at DESC)
  WHERE type = 'friend_joining';
