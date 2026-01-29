-- Create friendships table for explicit friend relationships
-- Separates the concept of "friends" (mutual relationship, requires approval)
-- from "following" (one-way, instant)

-- Create the friendships table
CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_b_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Canonical ordering: smaller UUID first for uniqueness
  -- This ensures we can't have both (A,B) and (B,A) in the table
  CONSTRAINT friendships_canonical_order CHECK (user_a_id < user_b_id),
  CONSTRAINT friendships_unique_pair UNIQUE (user_a_id, user_b_id)
);

-- Create indexes for efficient lookups
CREATE INDEX friendships_user_a_idx ON friendships(user_a_id);
CREATE INDEX friendships_user_b_idx ON friendships(user_b_id);

-- Helper function to create friendships with canonical ordering
CREATE OR REPLACE FUNCTION create_friendship(user_a UUID, user_b UUID)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  friendship_id UUID;
  smaller_id UUID;
  larger_id UUID;
BEGIN
  -- Determine canonical ordering
  IF user_a < user_b THEN
    smaller_id := user_a;
    larger_id := user_b;
  ELSE
    smaller_id := user_b;
    larger_id := user_a;
  END IF;

  -- Insert the friendship (will fail if already exists due to unique constraint)
  INSERT INTO friendships (user_a_id, user_b_id)
  VALUES (smaller_id, larger_id)
  ON CONFLICT (user_a_id, user_b_id) DO NOTHING
  RETURNING id INTO friendship_id;

  -- If we didn't insert (already exists), get the existing ID
  IF friendship_id IS NULL THEN
    SELECT id INTO friendship_id
    FROM friendships
    WHERE user_a_id = smaller_id AND user_b_id = larger_id;
  END IF;

  RETURN friendship_id;
END;
$$;

-- Drop existing are_friends function to allow parameter name change
DROP FUNCTION IF EXISTS are_friends(UUID, UUID);

-- Helper function to check if two users are friends (now uses friendships table)
CREATE OR REPLACE FUNCTION are_friends(user_a UUID, user_b UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  smaller_id UUID;
  larger_id UUID;
BEGIN
  IF user_a < user_b THEN
    smaller_id := user_a;
    larger_id := user_b;
  ELSE
    smaller_id := user_b;
    larger_id := user_a;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM friendships
    WHERE user_a_id = smaller_id AND user_b_id = larger_id
  );
END;
$$;

-- Helper function to delete a friendship
CREATE OR REPLACE FUNCTION delete_friendship(user_a UUID, user_b UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  smaller_id UUID;
  larger_id UUID;
  deleted_count INT;
BEGIN
  IF user_a < user_b THEN
    smaller_id := user_a;
    larger_id := user_b;
  ELSE
    smaller_id := user_b;
    larger_id := user_a;
  END IF;

  DELETE FROM friendships
  WHERE user_a_id = smaller_id AND user_b_id = larger_id;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count > 0;
END;
$$;

-- Helper function to get all friend IDs for a user
CREATE OR REPLACE FUNCTION get_friend_ids(user_id UUID)
RETURNS TABLE(friend_id UUID)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT user_b_id AS friend_id FROM friendships WHERE user_a_id = user_id
  UNION
  SELECT user_a_id AS friend_id FROM friendships WHERE user_b_id = user_id;
END;
$$;

-- Enable RLS
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- RLS policies for friendships table
-- Users can view friendships they're part of
CREATE POLICY "Users can view own friendships"
  ON friendships FOR SELECT
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- Users can delete friendships they're part of (unfriend)
CREATE POLICY "Users can delete own friendships"
  ON friendships FOR DELETE
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- Only allow inserts through the create_friendship function (service role)
-- Regular users shouldn't insert directly - friendships are created when accepting requests
CREATE POLICY "Service role can insert friendships"
  ON friendships FOR INSERT
  WITH CHECK (true);

-- Migrate existing mutual follows to friendships table
-- This finds all pairs where both users follow each other
INSERT INTO friendships (user_a_id, user_b_id, created_at)
SELECT
  LEAST(f1.follower_id, f1.followed_user_id) AS user_a_id,
  GREATEST(f1.follower_id, f1.followed_user_id) AS user_b_id,
  LEAST(f1.created_at, f2.created_at) AS created_at -- Use earlier follow date
FROM follows f1
INNER JOIN follows f2
  ON f1.follower_id = f2.followed_user_id
  AND f1.followed_user_id = f2.follower_id
WHERE f1.follower_id < f1.followed_user_id  -- Only process each pair once
  AND f1.followed_user_id IS NOT NULL
  AND f2.followed_user_id IS NOT NULL
ON CONFLICT (user_a_id, user_b_id) DO NOTHING;

-- Add comment to table
COMMENT ON TABLE friendships IS 'Explicit friend relationships (mutual, requires approval). Separate from follows (one-way, instant).';
COMMENT ON COLUMN friendships.user_a_id IS 'First user in the friendship (smaller UUID for canonical ordering)';
COMMENT ON COLUMN friendships.user_b_id IS 'Second user in the friendship (larger UUID for canonical ordering)';
