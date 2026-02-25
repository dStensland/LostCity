-- 257_itineraries.sql
-- Itineraries and itinerary items for the Playbook feature.
-- Supports user-owned outings with optional public sharing via token.

-- itineraries
CREATE TABLE itineraries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  portal_id UUID NOT NULL REFERENCES portals(id),
  title TEXT NOT NULL DEFAULT 'My Itinerary',
  date DATE,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  share_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex'),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- itinerary_items
CREATE TABLE itinerary_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_id UUID NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('event', 'venue', 'custom')),
  event_id INT REFERENCES events(id) ON DELETE SET NULL,
  venue_id INT REFERENCES venues(id) ON DELETE SET NULL,
  custom_title TEXT,
  custom_description TEXT,
  custom_address TEXT,
  custom_lat DOUBLE PRECISION,
  custom_lng DOUBLE PRECISION,
  position INT NOT NULL DEFAULT 0,
  start_time TEXT,              -- HH:MM format
  duration_minutes INT DEFAULT 60,
  walk_distance_meters INT,
  walk_time_minutes INT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_itineraries_user ON itineraries(user_id);
CREATE INDEX idx_itineraries_portal ON itineraries(portal_id);
CREATE INDEX idx_itinerary_items_itinerary ON itinerary_items(itinerary_id);
CREATE INDEX idx_itinerary_items_event ON itinerary_items(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX idx_itinerary_items_venue ON itinerary_items(venue_id) WHERE venue_id IS NOT NULL;

-- RLS
ALTER TABLE itineraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE itinerary_items ENABLE ROW LEVEL SECURITY;

-- Owners can do everything
CREATE POLICY itineraries_owner ON itineraries FOR ALL USING (auth.uid() = user_id);
CREATE POLICY itinerary_items_owner ON itinerary_items FOR ALL
  USING (itinerary_id IN (SELECT id FROM itineraries WHERE user_id = auth.uid()));

-- Public itineraries readable by anyone (for share links)
CREATE POLICY itineraries_public_read ON itineraries FOR SELECT
  USING (is_public = true);
CREATE POLICY itinerary_items_public_read ON itinerary_items FOR SELECT
  USING (itinerary_id IN (SELECT id FROM itineraries WHERE is_public = true));
