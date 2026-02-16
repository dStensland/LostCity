-- ============================================================================
-- Explore City Tracks: Track-based curated city guide
-- PRD: prds/020-explore-city-tracks.md
-- ============================================================================

-- Helper function for auto-updating updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- explore_tracks: 14 thematic track definitions
-- ============================================================================

CREATE TABLE IF NOT EXISTS explore_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  quote TEXT NOT NULL,
  quote_source TEXT NOT NULL,
  quote_portrait_url TEXT,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_explore_tracks_active_sort
  ON explore_tracks(is_active, sort_order);

CREATE TRIGGER update_explore_tracks_updated_at
  BEFORE UPDATE ON explore_tracks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- explore_track_venues: Many-to-many tracks <-> venues
-- ============================================================================

CREATE TABLE IF NOT EXISTS explore_track_venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES explore_tracks(id) ON DELETE CASCADE,
  venue_id BIGINT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  editorial_blurb TEXT,
  sort_order INT DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'approved' CHECK (status IN ('approved', 'pending', 'rejected')),
  upvote_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(track_id, venue_id)
);

CREATE INDEX IF NOT EXISTS idx_explore_track_venues_track
  ON explore_track_venues(track_id, status, sort_order);

CREATE INDEX IF NOT EXISTS idx_explore_track_venues_venue
  ON explore_track_venues(venue_id);

CREATE INDEX IF NOT EXISTS idx_explore_track_venues_pending
  ON explore_track_venues(status) WHERE status = 'pending';

CREATE TRIGGER update_explore_track_venues_updated_at
  BEFORE UPDATE ON explore_track_venues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- explore_tips: Community blurbs on venues
-- ============================================================================

CREATE TABLE IF NOT EXISTS explore_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id BIGINT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  track_id UUID REFERENCES explore_tracks(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (LENGTH(content) BETWEEN 10 AND 500),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'flagged')),
  upvote_count INT DEFAULT 0,
  flag_count INT DEFAULT 0,
  is_verified_visitor BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_explore_tips_venue
  ON explore_tips(venue_id, status, upvote_count DESC);

CREATE INDEX IF NOT EXISTS idx_explore_tips_user
  ON explore_tips(user_id);

CREATE INDEX IF NOT EXISTS idx_explore_tips_pending
  ON explore_tips(status) WHERE status IN ('pending', 'flagged');

CREATE INDEX IF NOT EXISTS idx_explore_tips_track
  ON explore_tips(track_id) WHERE track_id IS NOT NULL;

CREATE TRIGGER update_explore_tips_updated_at
  BEFORE UPDATE ON explore_tips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- explore_upvotes: Upvotes on track venues and tips
-- ============================================================================

CREATE TABLE IF NOT EXISTS explore_upvotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('track_venue', 'tip')),
  entity_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_type, entity_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_explore_upvotes_entity
  ON explore_upvotes(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_explore_upvotes_user
  ON explore_upvotes(user_id, created_at DESC);

-- ============================================================================
-- explore_flags: Flag tracking for tips (separate from existing flags table)
-- ============================================================================

CREATE TABLE IF NOT EXISTS explore_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tip_id UUID NOT NULL REFERENCES explore_tips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'offensive', 'irrelevant', 'other')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tip_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_explore_flags_tip
  ON explore_flags(tip_id);

-- ============================================================================
-- Trigger: Auto-increment/decrement upvote counts
-- ============================================================================

CREATE OR REPLACE FUNCTION explore_upvote_count_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.entity_type = 'track_venue' THEN
      UPDATE explore_track_venues SET upvote_count = upvote_count + 1 WHERE id = NEW.entity_id;
    ELSIF NEW.entity_type = 'tip' THEN
      UPDATE explore_tips SET upvote_count = upvote_count + 1 WHERE id = NEW.entity_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.entity_type = 'track_venue' THEN
      UPDATE explore_track_venues SET upvote_count = GREATEST(upvote_count - 1, 0) WHERE id = OLD.entity_id;
    ELSIF OLD.entity_type = 'tip' THEN
      UPDATE explore_tips SET upvote_count = GREATEST(upvote_count - 1, 0) WHERE id = OLD.entity_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER explore_upvote_count_trigger
  AFTER INSERT OR DELETE ON explore_upvotes
  FOR EACH ROW EXECUTE FUNCTION explore_upvote_count_change();

-- ============================================================================
-- Trigger: Auto-increment flag count and auto-hide at threshold
-- ============================================================================

CREATE OR REPLACE FUNCTION explore_flag_count_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE explore_tips
    SET flag_count = flag_count + 1,
        status = CASE WHEN flag_count + 1 >= 3 THEN 'flagged' ELSE status END
    WHERE id = NEW.tip_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE explore_tips
    SET flag_count = GREATEST(flag_count - 1, 0)
    WHERE id = OLD.tip_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER explore_flag_count_trigger
  AFTER INSERT OR DELETE ON explore_flags
  FOR EACH ROW EXECUTE FUNCTION explore_flag_count_change();

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE explore_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE explore_track_venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE explore_tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE explore_upvotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE explore_flags ENABLE ROW LEVEL SECURITY;

-- Public read access for tracks and approved content
CREATE POLICY "Public can view active tracks"
  ON explore_tracks FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Public can view approved track venues"
  ON explore_track_venues FOR SELECT
  USING (status = 'approved');

CREATE POLICY "Public can view approved tips"
  ON explore_tips FOR SELECT
  USING (status = 'approved');

-- Service role can do everything (for API routes using service client)
CREATE POLICY "Service role full access on tracks"
  ON explore_tracks FOR ALL
  USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Service role full access on track_venues"
  ON explore_track_venues FOR ALL
  USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Service role full access on tips"
  ON explore_tips FOR ALL
  USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Service role full access on upvotes"
  ON explore_upvotes FOR ALL
  USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Service role full access on flags"
  ON explore_flags FOR ALL
  USING (TRUE) WITH CHECK (TRUE);

-- Users can see their own upvotes
CREATE POLICY "Users can view own upvotes"
  ON explore_upvotes FOR SELECT
  USING (auth.uid() = user_id);

-- Users can see their own flags
CREATE POLICY "Users can view own flags"
  ON explore_flags FOR SELECT
  USING (auth.uid() = user_id);
