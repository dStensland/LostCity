-- Collections: Curated lists of events
-- Can be editorial (by admins) or user-created

CREATE TABLE collections (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,

  -- Owner: null = editorial/system collection
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Visibility: public, private, unlisted
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'unlisted')),

  -- Editorial collections get featured
  is_featured BOOLEAN DEFAULT false,
  featured_order INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE collection_items (
  id SERIAL PRIMARY KEY,
  collection_id INTEGER REFERENCES collections(id) ON DELETE CASCADE NOT NULL,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE NOT NULL,

  -- Optional note about why this event is in the collection
  note TEXT,

  -- Order within collection
  position INTEGER DEFAULT 0,

  added_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicates
  UNIQUE(collection_id, event_id)
);

-- Indexes
CREATE INDEX idx_collections_user_id ON collections(user_id);
CREATE INDEX idx_collections_visibility ON collections(visibility);
CREATE INDEX idx_collections_featured ON collections(is_featured) WHERE is_featured = true;
CREATE INDEX idx_collection_items_collection_id ON collection_items(collection_id);
CREATE INDEX idx_collection_items_event_id ON collection_items(event_id);

-- Trigger to update updated_at
CREATE TRIGGER update_collections_updated_at
  BEFORE UPDATE ON collections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_items ENABLE ROW LEVEL SECURITY;

-- Anyone can view public/unlisted collections
CREATE POLICY "Public collections are viewable by everyone"
  ON collections FOR SELECT
  USING (visibility IN ('public', 'unlisted'));

-- Users can view their own private collections
CREATE POLICY "Users can view own collections"
  ON collections FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create collections
CREATE POLICY "Users can create collections"
  ON collections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own collections
CREATE POLICY "Users can update own collections"
  ON collections FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own collections
CREATE POLICY "Users can delete own collections"
  ON collections FOR DELETE
  USING (auth.uid() = user_id);

-- Collection items: viewable if collection is viewable
CREATE POLICY "Collection items viewable with collection"
  ON collection_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_id
      AND (c.visibility IN ('public', 'unlisted') OR c.user_id = auth.uid())
    )
  );

-- Users can add items to their own collections
CREATE POLICY "Users can add items to own collections"
  ON collection_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_id AND c.user_id = auth.uid()
    )
  );

-- Users can remove items from their own collections
CREATE POLICY "Users can remove items from own collections"
  ON collection_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_id AND c.user_id = auth.uid()
    )
  );
