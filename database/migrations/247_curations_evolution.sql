-- Curations Evolution
-- Evolve community lists into full curations with tips, follows, collaborators
-- Adds curation-specific columns to lists/list_items and new supporting tables

-- ============================================================================
-- 1A. Evolve `lists` table — add curation columns
-- ============================================================================

ALTER TABLE lists ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
ALTER TABLE lists ADD COLUMN IF NOT EXISTS accent_color TEXT;
ALTER TABLE lists ADD COLUMN IF NOT EXISTS vibe_tags TEXT[] DEFAULT '{}';
ALTER TABLE lists ADD COLUMN IF NOT EXISTS submission_mode TEXT DEFAULT 'closed'
  CHECK (submission_mode IN ('closed', 'open', 'collaborative'));
ALTER TABLE lists ADD COLUMN IF NOT EXISTS upvote_count INTEGER DEFAULT 0;
ALTER TABLE lists ADD COLUMN IF NOT EXISTS follower_count INTEGER DEFAULT 0;
ALTER TABLE lists ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
ALTER TABLE lists ADD COLUMN IF NOT EXISTS owner_type TEXT DEFAULT 'user'
  CHECK (owner_type IN ('user', 'editorial', 'portal'));

-- GIN index on vibe_tags for array overlap queries (e.g. WHERE vibe_tags && ARRAY['date-night'])
CREATE INDEX IF NOT EXISTS idx_lists_vibe_tags ON lists USING GIN (vibe_tags);

-- Index for owner_type filtering
CREATE INDEX IF NOT EXISTS idx_lists_owner_type ON lists(owner_type);

-- Backfill submission_mode from allow_contributions
UPDATE lists
SET submission_mode = 'open'
WHERE allow_contributions = true
  AND submission_mode = 'closed';

-- ============================================================================
-- 1B. Evolve `list_items` table — add curation columns
-- ============================================================================

ALTER TABLE list_items ADD COLUMN IF NOT EXISTS blurb TEXT;
ALTER TABLE list_items ADD COLUMN IF NOT EXISTS upvote_count INTEGER DEFAULT 0;
ALTER TABLE list_items ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved'
  CHECK (status IN ('approved', 'pending', 'rejected'));
ALTER TABLE list_items ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for filtering by status (e.g. pending submissions)
CREATE INDEX IF NOT EXISTS idx_list_items_status ON list_items(status);

-- Backfill submitted_by from added_by for existing items
UPDATE list_items
SET submitted_by = added_by
WHERE submitted_by IS NULL
  AND added_by IS NOT NULL;

-- ============================================================================
-- 1C. New table: curation_tips
-- ============================================================================

CREATE TABLE IF NOT EXISTS curation_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID REFERENCES lists(id) ON DELETE CASCADE NOT NULL,
  list_item_id UUID REFERENCES list_items(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 10 AND 500),
  upvote_count INTEGER DEFAULT 0,
  is_verified_visitor BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'flagged')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_curation_tips_list_id ON curation_tips(list_id);
CREATE INDEX IF NOT EXISTS idx_curation_tips_list_item_id ON curation_tips(list_item_id);
CREATE INDEX IF NOT EXISTS idx_curation_tips_user_id ON curation_tips(user_id);
CREATE INDEX IF NOT EXISTS idx_curation_tips_status ON curation_tips(status);

-- RLS for curation_tips
ALTER TABLE curation_tips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved tips visible on public curations"
  ON curation_tips FOR SELECT
  USING (
    status = 'approved' AND
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = curation_tips.list_id
      AND lists.is_public = true
      AND lists.status = 'active'
    )
  );

CREATE POLICY "Users can view own tips"
  ON curation_tips FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can create tips"
  ON curation_tips FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = curation_tips.list_id
      AND lists.is_public = true
      AND lists.status = 'active'
    )
  );

CREATE POLICY "Users can update own tips"
  ON curation_tips FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tips"
  ON curation_tips FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 1D. New table: curation_follows
-- ============================================================================

CREATE TABLE IF NOT EXISTS curation_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID REFERENCES lists(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(list_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_curation_follows_list_id ON curation_follows(list_id);
CREATE INDEX IF NOT EXISTS idx_curation_follows_user_id ON curation_follows(user_id);

-- RLS for curation_follows
ALTER TABLE curation_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Follows visible on public curations"
  ON curation_follows FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = curation_follows.list_id
      AND lists.is_public = true
    )
  );

CREATE POLICY "Users can view own follows"
  ON curation_follows FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can follow public curations"
  ON curation_follows FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = curation_follows.list_id
      AND lists.is_public = true
      AND lists.status = 'active'
    )
  );

CREATE POLICY "Users can unfollow"
  ON curation_follows FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 1E. New table: curation_collaborators
-- ============================================================================

CREATE TABLE IF NOT EXISTS curation_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID REFERENCES lists(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'editor' CHECK (role IN ('editor', 'moderator')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(list_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_curation_collaborators_list_id ON curation_collaborators(list_id);
CREATE INDEX IF NOT EXISTS idx_curation_collaborators_user_id ON curation_collaborators(user_id);

-- RLS for curation_collaborators
ALTER TABLE curation_collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view collaborators"
  ON curation_collaborators FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = curation_collaborators.list_id
      AND lists.creator_id = auth.uid()
    )
  );

CREATE POLICY "Collaborators can view own records"
  ON curation_collaborators FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Owners can invite collaborators"
  ON curation_collaborators FOR INSERT
  WITH CHECK (
    auth.uid() = invited_by AND
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = curation_collaborators.list_id
      AND lists.creator_id = auth.uid()
    )
  );

CREATE POLICY "Invitees can update own status"
  ON curation_collaborators FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Owners can remove collaborators"
  ON curation_collaborators FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = curation_collaborators.list_id
      AND lists.creator_id = auth.uid()
    )
  );

CREATE POLICY "Collaborators can remove themselves"
  ON curation_collaborators FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 1F. Triggers for cached counts
-- ============================================================================

-- List-level upvote count (votes where item_id IS NULL = list vote)
CREATE OR REPLACE FUNCTION update_list_upvote_count_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.item_id IS NULL THEN
    UPDATE lists
    SET upvote_count = COALESCE((
      SELECT COUNT(*) FROM list_votes
      WHERE list_id = NEW.list_id AND item_id IS NULL
    ), 0)
    WHERE id = NEW.list_id;
  ELSE
    UPDATE list_items
    SET upvote_count = COALESCE((
      SELECT COUNT(*) FROM list_votes
      WHERE item_id = NEW.item_id
    ), 0)
    WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_list_upvote_count_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.item_id IS NULL THEN
    UPDATE lists
    SET upvote_count = COALESCE((
      SELECT COUNT(*) FROM list_votes
      WHERE list_id = OLD.list_id AND item_id IS NULL
    ), 0)
    WHERE id = OLD.list_id;
  ELSE
    UPDATE list_items
    SET upvote_count = COALESCE((
      SELECT COUNT(*) FROM list_votes
      WHERE item_id = OLD.item_id
    ), 0)
    WHERE id = OLD.item_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_list_votes_insert_count ON list_votes;
CREATE TRIGGER trg_list_votes_insert_count
  AFTER INSERT ON list_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_list_upvote_count_on_insert();

DROP TRIGGER IF EXISTS trg_list_votes_delete_count ON list_votes;
CREATE TRIGGER trg_list_votes_delete_count
  AFTER DELETE ON list_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_list_upvote_count_on_delete();

-- Follower count trigger
CREATE OR REPLACE FUNCTION update_list_follower_count_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE lists
  SET follower_count = COALESCE((
    SELECT COUNT(*) FROM curation_follows
    WHERE list_id = NEW.list_id
  ), 0)
  WHERE id = NEW.list_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_list_follower_count_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE lists
  SET follower_count = COALESCE((
    SELECT COUNT(*) FROM curation_follows
    WHERE list_id = OLD.list_id
  ), 0)
  WHERE id = OLD.list_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_curation_follows_insert_count ON curation_follows;
CREATE TRIGGER trg_curation_follows_insert_count
  AFTER INSERT ON curation_follows
  FOR EACH ROW
  EXECUTE FUNCTION update_list_follower_count_on_insert();

DROP TRIGGER IF EXISTS trg_curation_follows_delete_count ON curation_follows;
CREATE TRIGGER trg_curation_follows_delete_count
  AFTER DELETE ON curation_follows
  FOR EACH ROW
  EXECUTE FUNCTION update_list_follower_count_on_delete();

-- ============================================================================
-- 1G. Backfill existing data
-- ============================================================================

-- Compute upvote_count on all existing lists from list_votes
UPDATE lists
SET upvote_count = COALESCE(sub.cnt, 0)
FROM (
  SELECT list_id, COUNT(*) AS cnt
  FROM list_votes
  WHERE item_id IS NULL
  GROUP BY list_id
) sub
WHERE lists.id = sub.list_id;

-- Compute upvote_count on all existing items from list_votes
UPDATE list_items
SET upvote_count = COALESCE(sub.cnt, 0)
FROM (
  SELECT item_id, COUNT(*) AS cnt
  FROM list_votes
  WHERE item_id IS NOT NULL
  GROUP BY item_id
) sub
WHERE list_items.id = sub.item_id;
