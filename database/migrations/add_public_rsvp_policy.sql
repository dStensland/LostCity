-- Migration: Add RLS policy to allow reading public RSVPs
-- This is needed for social proof counts to work (showing "X going" on event cards)

-- Allow anyone to read RSVPs marked as public
CREATE POLICY "Anyone can read public RSVPs"
ON event_rsvps
FOR SELECT
USING (visibility = 'public');

-- Allow anyone to read public recommendations
CREATE POLICY "Anyone can read public recommendations"
ON recommendations
FOR SELECT
USING (visibility = 'public');

-- Note: Run this in the Supabase SQL Editor
-- Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new
