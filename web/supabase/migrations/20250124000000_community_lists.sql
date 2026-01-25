-- Community Lists Feature
-- This migration creates tables for user-curated lists with voting

-- Lists table
CREATE TABLE IF NOT EXISTS lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id UUID REFERENCES portals(id) ON DELETE SET NULL,
  creator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 'spots', 'events', 'experiences', 'food', 'nightlife', 'culture', 'hidden-gems', 'seasonal'
  is_public BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'active', -- 'active', 'deleted', 'archived'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(portal_id, slug)
);

-- List items table
CREATE TABLE IF NOT EXISTS list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID REFERENCES lists(id) ON DELETE CASCADE NOT NULL,
  item_type TEXT NOT NULL, -- 'venue', 'event', 'producer', 'custom'
  venue_id INTEGER REFERENCES venues(id) ON DELETE CASCADE,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  producer_id TEXT REFERENCES event_producers(id) ON DELETE CASCADE,
  custom_name TEXT,
  custom_description TEXT,
  position INTEGER DEFAULT 0,
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_item_reference CHECK (
    (item_type = 'venue' AND venue_id IS NOT NULL) OR
    (item_type = 'event' AND event_id IS NOT NULL) OR
    (item_type = 'producer' AND producer_id IS NOT NULL) OR
    (item_type = 'custom' AND custom_name IS NOT NULL)
  )
);

-- List votes table
CREATE TABLE IF NOT EXISTS list_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID REFERENCES lists(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES list_items(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  vote_type TEXT DEFAULT 'up', -- 'up', 'down'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(list_id, item_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_lists_portal_id ON lists(portal_id);
CREATE INDEX IF NOT EXISTS idx_lists_creator_id ON lists(creator_id);
CREATE INDEX IF NOT EXISTS idx_lists_category ON lists(category);
CREATE INDEX IF NOT EXISTS idx_lists_status ON lists(status);
CREATE INDEX IF NOT EXISTS idx_list_items_list_id ON list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_list_items_venue_id ON list_items(venue_id);
CREATE INDEX IF NOT EXISTS idx_list_items_event_id ON list_items(event_id);
CREATE INDEX IF NOT EXISTS idx_list_items_producer_id ON list_items(producer_id);
CREATE INDEX IF NOT EXISTS idx_list_votes_list_id ON list_votes(list_id);
CREATE INDEX IF NOT EXISTS idx_list_votes_item_id ON list_votes(item_id);
CREATE INDEX IF NOT EXISTS idx_list_votes_user_id ON list_votes(user_id);

-- Trigger to auto-generate slug from title
CREATE OR REPLACE FUNCTION generate_list_slug()
RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Generate base slug from title
  base_slug := lower(regexp_replace(NEW.title, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  final_slug := base_slug;

  -- Check for uniqueness within portal and increment if needed
  WHILE EXISTS (
    SELECT 1 FROM lists
    WHERE slug = final_slug
    AND (portal_id = NEW.portal_id OR (portal_id IS NULL AND NEW.portal_id IS NULL))
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  NEW.slug := final_slug;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_list_slug ON lists;
CREATE TRIGGER trigger_generate_list_slug
  BEFORE INSERT OR UPDATE OF title ON lists
  FOR EACH ROW
  EXECUTE FUNCTION generate_list_slug();

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_list_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_list_updated_at ON lists;
CREATE TRIGGER trigger_update_list_updated_at
  BEFORE UPDATE ON lists
  FOR EACH ROW
  EXECUTE FUNCTION update_list_updated_at();

-- Row Level Security
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_votes ENABLE ROW LEVEL SECURITY;

-- Lists policies
DROP POLICY IF EXISTS "Public lists are viewable by everyone" ON lists;
CREATE POLICY "Public lists are viewable by everyone" ON lists
  FOR SELECT USING (is_public = true AND status = 'active');

DROP POLICY IF EXISTS "Users can view their own lists" ON lists;
CREATE POLICY "Users can view their own lists" ON lists
  FOR SELECT USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Users can create lists" ON lists;
CREATE POLICY "Users can create lists" ON lists
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Users can update their own lists" ON lists;
CREATE POLICY "Users can update their own lists" ON lists
  FOR UPDATE USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Users can delete their own lists" ON lists;
CREATE POLICY "Users can delete their own lists" ON lists
  FOR DELETE USING (auth.uid() = creator_id);

-- List items policies
DROP POLICY IF EXISTS "List items are viewable if list is viewable" ON list_items;
CREATE POLICY "List items are viewable if list is viewable" ON list_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_items.list_id
      AND (lists.is_public = true OR lists.creator_id = auth.uid())
      AND lists.status = 'active'
    )
  );

DROP POLICY IF EXISTS "List owners can manage items" ON list_items;
CREATE POLICY "List owners can manage items" ON list_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_items.list_id
      AND lists.creator_id = auth.uid()
    )
  );

-- List votes policies
DROP POLICY IF EXISTS "Votes are viewable on public lists" ON list_votes;
CREATE POLICY "Votes are viewable on public lists" ON list_votes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_votes.list_id
      AND lists.is_public = true
      AND lists.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can vote on public lists" ON list_votes;
CREATE POLICY "Users can vote on public lists" ON list_votes
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_votes.list_id
      AND lists.is_public = true
      AND lists.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can update their own votes" ON list_votes;
CREATE POLICY "Users can update their own votes" ON list_votes
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own votes" ON list_votes;
CREATE POLICY "Users can delete their own votes" ON list_votes
  FOR DELETE USING (auth.uid() = user_id);
