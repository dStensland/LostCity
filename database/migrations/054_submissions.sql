-- Migration 054: User Submissions System
-- Created: 2026-01-25
-- Allows users to submit events, venues, and organizations for review

-- ============================================================================
-- 1. ADD SUBMISSION TRACKING TO PROFILES
-- ============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS submission_count INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approved_count INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rejected_count INTEGER DEFAULT 0;

-- ============================================================================
-- 2. CREATE "USER SUBMISSIONS" SOURCE
-- ============================================================================

INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES (
  'User Submissions',
  'user-submissions',
  'https://lostcity.io/submit',
  'user',
  'manual',
  true
)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 3. ADD SUBMISSION TRACKING TO EXISTING TABLES
-- ============================================================================

-- Track which user submitted an event (NULL for crawler events)
ALTER TABLE events ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS from_submission UUID;

-- Track which user submitted a venue
ALTER TABLE venues ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS from_submission UUID;

-- Track which user submitted a producer
ALTER TABLE event_producers ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE event_producers ADD COLUMN IF NOT EXISTS from_submission UUID;
ALTER TABLE event_producers ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT TRUE;

-- Mark existing producers as verified (they were admin-seeded)
UPDATE event_producers SET is_verified = TRUE WHERE is_verified IS NULL;

-- ============================================================================
-- 4. CREATE SUBMISSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Submission type: event, venue, producer
  submission_type TEXT NOT NULL CHECK (submission_type IN ('event', 'venue', 'producer')),

  -- Submitter
  submitted_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Portal context (optional - for portal-specific submissions)
  portal_id UUID REFERENCES portals(id) ON DELETE SET NULL,

  -- Moderation
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'needs_edit')),
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  admin_notes TEXT,  -- Internal notes not shown to submitter

  -- Flexible data storage (stores all fields for the entity type)
  data JSONB NOT NULL DEFAULT '{}',

  -- Duplicate detection
  content_hash TEXT,
  potential_duplicate_id INTEGER,  -- References events.id, venues.id, or casts to producer id
  potential_duplicate_type TEXT,   -- 'event', 'venue', 'producer'
  duplicate_acknowledged BOOLEAN DEFAULT FALSE,

  -- After approval, link to created entity
  approved_event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
  approved_venue_id INTEGER REFERENCES venues(id) ON DELETE SET NULL,
  approved_producer_id TEXT REFERENCES event_producers(id) ON DELETE SET NULL,

  -- Images uploaded with submission
  image_urls TEXT[],

  -- Rate limiting
  ip_address INET,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 5. INDEXES
-- ============================================================================

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_by ON submissions(submitted_by);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_type ON submissions(submission_type);
CREATE INDEX IF NOT EXISTS idx_submissions_portal ON submissions(portal_id) WHERE portal_id IS NOT NULL;

-- Combined indexes for common queries
CREATE INDEX IF NOT EXISTS idx_submissions_pending ON submissions(status, created_at DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_submissions_user_history ON submissions(submitted_by, created_at DESC);

-- Duplicate detection
CREATE INDEX IF NOT EXISTS idx_submissions_content_hash ON submissions(content_hash);

-- Link tracking on events/venues/producers
CREATE INDEX IF NOT EXISTS idx_events_submitted_by ON events(submitted_by) WHERE submitted_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_venues_submitted_by ON venues(submitted_by) WHERE submitted_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_producers_submitted_by ON event_producers(submitted_by) WHERE submitted_by IS NOT NULL;

-- ============================================================================
-- 6. UPDATE TIMESTAMP TRIGGER
-- ============================================================================

CREATE TRIGGER submissions_updated_at
  BEFORE UPDATE ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 7. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Users can view their own submissions
CREATE POLICY "Users can view own submissions"
  ON submissions FOR SELECT
  USING (auth.uid() = submitted_by);

-- Admins can view all submissions
CREATE POLICY "Admins can view all submissions"
  ON submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
    )
  );

-- Portal owners/admins can view submissions to their portal
CREATE POLICY "Portal admins can view portal submissions"
  ON submissions FOR SELECT
  USING (
    portal_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM portal_members
      WHERE portal_members.portal_id = submissions.portal_id
      AND portal_members.user_id = auth.uid()
      AND portal_members.role IN ('owner', 'admin')
    )
  );

-- Users can create their own submissions
CREATE POLICY "Users can create submissions"
  ON submissions FOR INSERT
  WITH CHECK (auth.uid() = submitted_by);

-- Users can update their own pending submissions
CREATE POLICY "Users can update own pending submissions"
  ON submissions FOR UPDATE
  USING (
    auth.uid() = submitted_by
    AND status IN ('pending', 'needs_edit')
  )
  WITH CHECK (
    auth.uid() = submitted_by
    AND status IN ('pending', 'needs_edit')
  );

-- Admins can update any submission (for moderation)
CREATE POLICY "Admins can update submissions"
  ON submissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
    )
  );

-- Portal admins can update portal submissions
CREATE POLICY "Portal admins can update portal submissions"
  ON submissions FOR UPDATE
  USING (
    portal_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM portal_members
      WHERE portal_members.portal_id = submissions.portal_id
      AND portal_members.user_id = auth.uid()
      AND portal_members.role IN ('owner', 'admin')
    )
  );

-- Users can delete their own pending submissions
CREATE POLICY "Users can delete own pending submissions"
  ON submissions FOR DELETE
  USING (
    auth.uid() = submitted_by
    AND status = 'pending'
  );

-- ============================================================================
-- 8. FUNCTIONS FOR SUBMISSION STATS
-- ============================================================================

-- Function to update profile submission stats after moderation
CREATE OR REPLACE FUNCTION update_submission_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- On status change to approved
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    UPDATE profiles
    SET approved_count = approved_count + 1
    WHERE id = NEW.submitted_by;
  END IF;

  -- On status change to rejected
  IF NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
    UPDATE profiles
    SET rejected_count = rejected_count + 1
    WHERE id = NEW.submitted_by;
  END IF;

  -- If reverting from approved
  IF OLD.status = 'approved' AND NEW.status != 'approved' THEN
    UPDATE profiles
    SET approved_count = GREATEST(0, approved_count - 1)
    WHERE id = NEW.submitted_by;
  END IF;

  -- If reverting from rejected
  IF OLD.status = 'rejected' AND NEW.status != 'rejected' THEN
    UPDATE profiles
    SET rejected_count = GREATEST(0, rejected_count - 1)
    WHERE id = NEW.submitted_by;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_submission_stats_trigger
  AFTER UPDATE ON submissions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_submission_stats();

-- Function to increment submission count on new submission
CREATE OR REPLACE FUNCTION increment_submission_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET submission_count = submission_count + 1
  WHERE id = NEW.submitted_by;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER increment_submission_count_trigger
  AFTER INSERT ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION increment_submission_count();

-- ============================================================================
-- 9. NOTIFICATION FUNCTION FOR SUBMISSION STATUS CHANGES
-- ============================================================================

-- Add new notification types for submissions
-- First check if the check constraint exists and modify it
DO $$
BEGIN
  -- Try to drop the existing constraint if it exists
  ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

  -- Add the updated constraint with submission types
  ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
      'new_follower', 'friend_rsvp', 'recommendation', 'event_reminder',
      'friend_going', 'venue_event', 'system', 'event_invite', 'invite_accepted',
      'submission_approved', 'submission_rejected', 'submission_needs_edit'
    ));
EXCEPTION
  WHEN undefined_object THEN
    -- Constraint doesn't exist, just add the new one
    ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
      CHECK (type IN (
        'new_follower', 'friend_rsvp', 'recommendation', 'event_reminder',
        'friend_going', 'venue_event', 'system', 'event_invite', 'invite_accepted',
        'submission_approved', 'submission_rejected', 'submission_needs_edit'
      ));
END $$;

-- Add submission_id column to notifications for linking
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE;

-- Function to notify user on submission status change
CREATE OR REPLACE FUNCTION notify_submission_status()
RETURNS TRIGGER AS $$
DECLARE
  notification_type TEXT;
  notification_message TEXT;
  submission_title TEXT;
BEGIN
  -- Determine notification type
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    notification_type := 'submission_approved';
    notification_message := 'Your submission has been approved!';
  ELSIF NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
    notification_type := 'submission_rejected';
    notification_message := COALESCE(
      'Your submission was not approved: ' || NEW.rejection_reason,
      'Your submission was not approved.'
    );
  ELSIF NEW.status = 'needs_edit' AND OLD.status != 'needs_edit' THEN
    notification_type := 'submission_needs_edit';
    notification_message := COALESCE(
      'Your submission needs changes: ' || NEW.rejection_reason,
      'Your submission needs some changes before approval.'
    );
  ELSE
    RETURN NEW;
  END IF;

  -- Get title from submission data
  submission_title := NEW.data->>'title';
  IF submission_title IS NOT NULL THEN
    notification_message := notification_message || ' (' || submission_title || ')';
  END IF;

  -- Create notification
  INSERT INTO notifications (user_id, type, actor_id, message, submission_id)
  VALUES (
    NEW.submitted_by,
    notification_type,
    NEW.reviewed_by,
    notification_message,
    NEW.id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER notify_submission_status_trigger
  AFTER UPDATE ON submissions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_submission_status();

-- ============================================================================
-- 10. HELPER FUNCTION FOR TRUST SCORE
-- ============================================================================

-- Calculate trust score: approved / (approved + rejected)
-- Returns NULL if no decisions yet, 0-1 otherwise
CREATE OR REPLACE FUNCTION get_user_trust_score(user_id UUID)
RETURNS DECIMAL(3, 2) AS $$
DECLARE
  approved INT;
  rejected INT;
BEGIN
  SELECT approved_count, rejected_count INTO approved, rejected
  FROM profiles WHERE id = user_id;

  IF approved IS NULL OR (approved + rejected) = 0 THEN
    RETURN NULL;
  END IF;

  RETURN approved::DECIMAL / (approved + rejected);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is trusted (5+ approved, 90%+ approval rate)
CREATE OR REPLACE FUNCTION is_trusted_submitter(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  approved INT;
  trust_score DECIMAL;
BEGIN
  SELECT approved_count INTO approved FROM profiles WHERE id = user_id;
  trust_score := get_user_trust_score(user_id);

  RETURN approved >= 5 AND trust_score >= 0.9;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 11. COMMENTS
-- ============================================================================

COMMENT ON TABLE submissions IS 'User-submitted events, venues, and organizations pending moderation';
COMMENT ON COLUMN submissions.data IS 'JSONB containing all fields for the entity type (event fields, venue fields, or producer fields)';
COMMENT ON COLUMN submissions.content_hash IS 'Hash of key fields for duplicate detection (e.g., title + date + venue for events)';
COMMENT ON COLUMN submissions.potential_duplicate_id IS 'ID of existing entity that may be a duplicate';
COMMENT ON COLUMN submissions.duplicate_acknowledged IS 'True if user acknowledged potential duplicate and submitted anyway';
COMMENT ON COLUMN profiles.submission_count IS 'Total number of submissions by this user';
COMMENT ON COLUMN profiles.approved_count IS 'Number of approved submissions';
COMMENT ON COLUMN profiles.rejected_count IS 'Number of rejected submissions';

-- ============================================================================
-- 12. SUPABASE STORAGE BUCKET FOR SUBMISSION IMAGES
-- ============================================================================

-- Note: Run this in Supabase dashboard or via supabase CLI:
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('submission-images', 'submission-images', true)
-- ON CONFLICT (id) DO NOTHING;

-- Storage policies would be set via Supabase dashboard:
-- - Allow authenticated users to upload to their own folder
-- - Allow public read access for approved images
-- - 5MB max file size
-- - Allowed types: image/jpeg, image/png, image/webp
