-- Migration 018: Add producer following support
-- Allows users to follow event producers (organizers)

-- Add producer column to follows table
ALTER TABLE follows ADD COLUMN IF NOT EXISTS followed_producer_id TEXT REFERENCES event_producers(id) ON DELETE CASCADE;

-- Update the constraint to include producers
ALTER TABLE follows DROP CONSTRAINT IF EXISTS one_follow_target;
ALTER TABLE follows ADD CONSTRAINT one_follow_target CHECK (
  (followed_user_id IS NOT NULL)::int +
  (followed_venue_id IS NOT NULL)::int +
  (followed_org_id IS NOT NULL)::int +
  (followed_producer_id IS NOT NULL)::int = 1
);

-- Add unique constraint for producer follows
CREATE UNIQUE INDEX IF NOT EXISTS idx_follows_producer ON follows(follower_id, followed_producer_id) WHERE followed_producer_id IS NOT NULL;

-- Add producer column to recommendations table
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS producer_id TEXT REFERENCES event_producers(id) ON DELETE CASCADE;

-- Update recommendations constraint
ALTER TABLE recommendations DROP CONSTRAINT IF EXISTS one_rec_target;
ALTER TABLE recommendations ADD CONSTRAINT one_rec_target CHECK (
  (event_id IS NOT NULL)::int +
  (venue_id IS NOT NULL)::int +
  (org_id IS NOT NULL)::int +
  (producer_id IS NOT NULL)::int = 1
);

-- Add producer column to activities table
ALTER TABLE activities ADD COLUMN IF NOT EXISTS producer_id TEXT REFERENCES event_producers(id) ON DELETE CASCADE;

-- Update activity_type check to include follow_producer
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_activity_type_check;
ALTER TABLE activities ADD CONSTRAINT activities_activity_type_check CHECK (
  activity_type IN ('rsvp', 'recommendation', 'follow_user', 'follow_venue', 'follow_org', 'follow_producer', 'check_in', 'save')
);

-- Index for querying producer follows
CREATE INDEX IF NOT EXISTS idx_follows_by_producer ON follows(followed_producer_id) WHERE followed_producer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_producer ON activities(producer_id) WHERE producer_id IS NOT NULL;
