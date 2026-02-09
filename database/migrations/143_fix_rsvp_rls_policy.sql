-- Fix: event_rsvps RLS policy for public visibility
-- The original migration (011_users.sql) defined this policy but it was never applied.
-- RLS was enabled but no SELECT policy existed, blocking all reads for non-service clients.

-- Drop existing select policy if it exists
DROP POLICY IF EXISTS "event_rsvps_select" ON event_rsvps;
DROP POLICY IF EXISTS "Anyone can read public RSVPs" ON event_rsvps;

-- Recreate: public RSVPs visible to all, friends-only to friends, private only to self
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
