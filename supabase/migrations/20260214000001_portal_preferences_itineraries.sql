-- ============================================
-- MIGRATION: Portal preferences + itineraries
-- ============================================
-- Adds tables for guest preference persistence (onboarding),
-- itinerary builder, and weather caching.

-- ============================================
-- 1. portal_preferences
-- ============================================
CREATE TABLE IF NOT EXISTS portal_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  portal_id UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
  travel_party TEXT CHECK (travel_party IN ('alone', 'couple', 'family', 'group')),
  interests TEXT[] DEFAULT '{}',
  dietary_needs TEXT[] DEFAULT '{}',
  preferred_guest_intent TEXT,
  preferred_experience_view TEXT,
  mobility_preferences JSONB DEFAULT '{}',
  onboarding_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, portal_id)
);

ALTER TABLE portal_preferences ENABLE ROW LEVEL SECURITY;

-- Users can read/write their own preferences
CREATE POLICY portal_preferences_select_own ON portal_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY portal_preferences_insert_own ON portal_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY portal_preferences_update_own ON portal_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_portal_preferences_user_portal
  ON portal_preferences(user_id, portal_id);

-- ============================================
-- 2. itineraries
-- ============================================
CREATE TABLE IF NOT EXISTS itineraries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  portal_id UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'My Itinerary',
  date DATE,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  share_token TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE itineraries ENABLE ROW LEVEL SECURITY;

-- Owners can CRUD their own itineraries
CREATE POLICY itineraries_select_own ON itineraries
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY itineraries_insert_own ON itineraries
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY itineraries_update_own ON itineraries
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY itineraries_delete_own ON itineraries
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Public itineraries viewable by anyone via share token
CREATE POLICY itineraries_select_public ON itineraries
  FOR SELECT TO anon, authenticated
  USING (is_public = true AND share_token IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_itineraries_user_portal
  ON itineraries(user_id, portal_id);

CREATE INDEX IF NOT EXISTS idx_itineraries_share_token
  ON itineraries(share_token) WHERE share_token IS NOT NULL;

-- ============================================
-- 3. itinerary_items
-- ============================================
CREATE TABLE IF NOT EXISTS itinerary_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_id UUID NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('event', 'venue', 'custom')),
  event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
  venue_id INTEGER REFERENCES venues(id) ON DELETE SET NULL,
  custom_title TEXT,
  custom_description TEXT,
  custom_address TEXT,
  custom_lat DOUBLE PRECISION,
  custom_lng DOUBLE PRECISION,
  position INTEGER NOT NULL DEFAULT 0,
  start_time TIME,
  duration_minutes INTEGER DEFAULT 60,
  walk_distance_meters INTEGER,
  walk_time_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE itinerary_items ENABLE ROW LEVEL SECURITY;

-- Items follow parent itinerary access
CREATE POLICY itinerary_items_select_own ON itinerary_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM itineraries
      WHERE itineraries.id = itinerary_items.itinerary_id
        AND itineraries.user_id = auth.uid()
    )
  );

CREATE POLICY itinerary_items_select_public ON itinerary_items
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM itineraries
      WHERE itineraries.id = itinerary_items.itinerary_id
        AND itineraries.is_public = true
        AND itineraries.share_token IS NOT NULL
    )
  );

CREATE POLICY itinerary_items_insert_own ON itinerary_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM itineraries
      WHERE itineraries.id = itinerary_items.itinerary_id
        AND itineraries.user_id = auth.uid()
    )
  );

CREATE POLICY itinerary_items_update_own ON itinerary_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM itineraries
      WHERE itineraries.id = itinerary_items.itinerary_id
        AND itineraries.user_id = auth.uid()
    )
  );

CREATE POLICY itinerary_items_delete_own ON itinerary_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM itineraries
      WHERE itineraries.id = itinerary_items.itinerary_id
        AND itineraries.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_itinerary_items_itinerary
  ON itinerary_items(itinerary_id, position);

-- ============================================
-- 4. concierge_requests
-- ============================================
CREATE TABLE IF NOT EXISTS concierge_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('restaurant_reservation', 'activity_booking', 'transportation', 'custom')),
  details TEXT NOT NULL,
  preferred_time TEXT,
  party_size INTEGER,
  guest_contact JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE concierge_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY concierge_requests_select_own ON concierge_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY concierge_requests_insert_auth ON concierge_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_concierge_requests_portal
  ON concierge_requests(portal_id, status);

CREATE INDEX IF NOT EXISTS idx_concierge_requests_user
  ON concierge_requests(user_id) WHERE user_id IS NOT NULL;

-- ============================================
-- 5. portal_weather_cache
-- ============================================
CREATE TABLE IF NOT EXISTS portal_weather_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE UNIQUE,
  temperature_f DOUBLE PRECISION,
  condition TEXT,
  icon TEXT,
  humidity INTEGER,
  wind_mph DOUBLE PRECISION,
  fetched_at TIMESTAMPTZ DEFAULT now()
);

-- No RLS needed — server-only table
ALTER TABLE portal_weather_cache ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write (no user access)
CREATE POLICY portal_weather_cache_service ON portal_weather_cache
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 6. portal_revenue_events (analytics)
-- ============================================
CREATE TABLE IF NOT EXISTS portal_revenue_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('booking_click', 'reservation_click', 'ticket_click', 'phone_call_click')),
  target_name TEXT,
  target_url TEXT,
  target_kind TEXT,
  utm_source TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE portal_revenue_events ENABLE ROW LEVEL SECURITY;

-- Insert from authenticated users (via API route)
CREATE POLICY portal_revenue_events_insert ON portal_revenue_events
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Service role can read all for analytics
CREATE POLICY portal_revenue_events_select_service ON portal_revenue_events
  FOR SELECT TO service_role
  USING (true);

CREATE INDEX IF NOT EXISTS idx_portal_revenue_events_portal_date
  ON portal_revenue_events(portal_id, created_at DESC);
