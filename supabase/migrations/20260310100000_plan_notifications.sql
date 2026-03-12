-- Migration: Add plan notification support
-- Adds itinerary_id column to notifications and expands type CHECK constraint

-- Add itinerary_id column (nullable FK to itineraries)
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS itinerary_id UUID REFERENCES itineraries(id) ON DELETE CASCADE;

-- Partial index for itinerary-related notifications
CREATE INDEX IF NOT EXISTS idx_notifications_itinerary
  ON notifications(itinerary_id)
  WHERE itinerary_id IS NOT NULL;

-- Expand CHECK constraint to include plan_join and plan_rsvp_change
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'new_follower', 'friend_rsvp', 'recommendation', 'event_reminder',
  'friend_going', 'venue_event', 'system', 'event_invite', 'invite_accepted',
  'submission_approved', 'submission_rejected', 'submission_needs_edit',
  'friend_request', 'friend_request_accepted',
  -- Plan notification types
  'plan_join', 'plan_rsvp_change'
));
