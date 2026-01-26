-- Migration 059: Fix RLS policy for producer follows
-- The original follows_select_public policy didn't include followed_producer_id
-- This caused queries for producer follow status to fail silently

-- Drop and recreate the follows select policy to include producers
DROP POLICY IF EXISTS follows_select_public ON follows;

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
    -- Can see venue/org/producer follows
    OR followed_venue_id IS NOT NULL
    OR followed_org_id IS NOT NULL
    OR followed_producer_id IS NOT NULL
  );
