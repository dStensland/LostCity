-- Community Lists Feature
-- User-created ranked lists for venues, events, and custom items

-- Lists table
CREATE TABLE IF NOT EXISTS lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id UUID REFERENCES portals(id) ON DELETE SET NULL,
  creator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('best_of', 'hidden_gems', 'date_night', 'with_friends', 'solo', 'budget', 'special_occasion')),
  is_public BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(portal_id, slug)
);

-- Create index for portal lookups
CREATE INDEX IF NOT EXISTS idx_lists_portal_id ON lists(portal_id);
CREATE INDEX IF NOT EXISTS idx_lists_creator_id ON lists(creator_id);
CREATE INDEX IF NOT EXISTS idx_lists_category ON lists(category);
CREATE INDEX IF NOT EXISTS idx_lists_status ON lists(status);

-- List items table
CREATE TABLE IF NOT EXISTS list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID REFERENCES lists(id) ON DELETE CASCADE NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('venue', 'event', 'producer', 'custom')),
  venue_id INTEGER REFERENCES venues(id) ON DELETE CASCADE,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  producer_id INTEGER REFERENCES producers(id) ON DELETE CASCADE,
  custom_name TEXT,
  custom_description TEXT,
  position INTEGER DEFAULT 0,
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure at least one reference or custom name
  CONSTRAINT list_items_has_reference CHECK (
    venue_id IS NOT NULL OR
    event_id IS NOT NULL OR
    producer_id IS NOT NULL OR
    custom_name IS NOT NULL
  )
);

-- Create indexes for item lookups
CREATE INDEX IF NOT EXISTS idx_list_items_list_id ON list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_list_items_venue_id ON list_items(venue_id);
CREATE INDEX IF NOT EXISTS idx_list_items_event_id ON list_items(event_id);
CREATE INDEX IF NOT EXISTS idx_list_items_producer_id ON list_items(producer_id);

-- List votes table
CREATE TABLE IF NOT EXISTS list_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID REFERENCES lists(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES list_items(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  vote_type TEXT DEFAULT 'up' CHECK (vote_type IN ('up', 'down')),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- One vote per user per list or item
  UNIQUE(list_id, item_id, user_id)
);

-- Create indexes for vote lookups
CREATE INDEX IF NOT EXISTS idx_list_votes_list_id ON list_votes(list_id);
CREATE INDEX IF NOT EXISTS idx_list_votes_item_id ON list_votes(item_id);
CREATE INDEX IF NOT EXISTS idx_list_votes_user_id ON list_votes(user_id);

-- RLS Policies

-- Enable RLS
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_votes ENABLE ROW LEVEL SECURITY;

-- Lists policies
CREATE POLICY "Public lists are viewable by everyone"
  ON lists FOR SELECT
  USING (is_public = true AND status = 'active');

CREATE POLICY "Users can view their own lists"
  ON lists FOR SELECT
  USING (auth.uid() = creator_id);

CREATE POLICY "Users can create lists"
  ON lists FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Users can update their own lists"
  ON lists FOR UPDATE
  USING (auth.uid() = creator_id);

CREATE POLICY "Users can delete their own lists"
  ON lists FOR DELETE
  USING (auth.uid() = creator_id);

-- List items policies
CREATE POLICY "Items are viewable on public lists"
  ON list_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_items.list_id
      AND (lists.is_public = true OR lists.creator_id = auth.uid())
    )
  );

CREATE POLICY "List creators can add items"
  ON list_items FOR INSERT
  WITH CHECK (
    auth.uid() = added_by AND
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_items.list_id
      AND lists.creator_id = auth.uid()
    )
  );

CREATE POLICY "List creators can update items"
  ON list_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_items.list_id
      AND lists.creator_id = auth.uid()
    )
  );

CREATE POLICY "List creators can delete items"
  ON list_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_items.list_id
      AND lists.creator_id = auth.uid()
    )
  );

-- List votes policies
CREATE POLICY "Votes are viewable on public lists"
  ON list_votes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_votes.list_id
      AND (lists.is_public = true OR lists.creator_id = auth.uid())
    )
  );

CREATE POLICY "Users can vote on public lists"
  ON list_votes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_votes.list_id
      AND lists.is_public = true
    )
  );

CREATE POLICY "Users can update their own votes"
  ON list_votes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own votes"
  ON list_votes FOR DELETE
  USING (auth.uid() = user_id);

-- Function to generate slug from title
CREATE OR REPLACE FUNCTION generate_list_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := LOWER(REGEXP_REPLACE(NEW.title, '[^a-zA-Z0-9]+', '-', 'g'));
    NEW.slug := TRIM(BOTH '-' FROM NEW.slug);

    -- Add random suffix if slug exists
    IF EXISTS (SELECT 1 FROM lists WHERE portal_id = NEW.portal_id AND slug = NEW.slug AND id != COALESCE(NEW.id, gen_random_uuid())) THEN
      NEW.slug := NEW.slug || '-' || SUBSTRING(gen_random_uuid()::TEXT, 1, 8);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for slug generation
DROP TRIGGER IF EXISTS generate_list_slug_trigger ON lists;
CREATE TRIGGER generate_list_slug_trigger
  BEFORE INSERT OR UPDATE ON lists
  FOR EACH ROW
  EXECUTE FUNCTION generate_list_slug();

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_lists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_lists_updated_at_trigger ON lists;
CREATE TRIGGER update_lists_updated_at_trigger
  BEFORE UPDATE ON lists
  FOR EACH ROW
  EXECUTE FUNCTION update_lists_updated_at();
