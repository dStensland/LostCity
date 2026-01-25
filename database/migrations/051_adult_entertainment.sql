-- 051_adult_entertainment.sql
-- Add adult entertainment subcategories, venues, and filtering support

-- ============================================
-- 1. Add new nightlife subcategories for adult entertainment
-- ============================================
INSERT INTO subcategories (id, category_id, name, display_order) VALUES
  ('nightlife.strip', 'nightlife', 'Strip Club / Gentlemen''s Club', 8),
  ('nightlife.burlesque', 'nightlife', 'Burlesque / Adult Cabaret', 9),
  ('nightlife.lifestyle', 'nightlife', 'Lifestyle / Swingers', 10),
  ('nightlife.revue', 'nightlife', 'Adult Revue / Male Review', 11)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  display_order = EXCLUDED.display_order;

-- ============================================
-- 2. Add is_adult flag to venues and events for filtering
-- ============================================
ALTER TABLE venues ADD COLUMN IF NOT EXISTS is_adult BOOLEAN DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_adult BOOLEAN DEFAULT false;

-- Create indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_venues_is_adult ON venues(is_adult) WHERE is_adult = true;
CREATE INDEX IF NOT EXISTS idx_events_is_adult ON events(is_adult) WHERE is_adult = true;

-- ============================================
-- 3. Add Atlanta adult entertainment venues
-- ============================================

-- Strip Clubs (Female Performers)
INSERT INTO venues (name, slug, address, city, state, neighborhood, venue_type, is_adult)
VALUES
  ('Clermont Lounge', 'clermont-lounge', '789 Ponce De Leon Ave NE', 'Atlanta', 'GA', 'Poncey-Highland', 'club', true),
  ('Magic City', 'magic-city', '241 Forsyth St SW', 'Atlanta', 'GA', 'Downtown', 'club', true),
  ('Pink Pony', 'pink-pony', '1837 Corporate Blvd', 'Atlanta', 'GA', 'Brookhaven', 'club', true),
  ('Oasis Goodtime Emporium', 'oasis-goodtime-emporium', '2090 Cheshire Bridge Rd NE', 'Atlanta', 'GA', 'Cheshire Bridge', 'club', true),
  ('Onyx', 'onyx-atlanta', '2715 Buford Hwy NE', 'Atlanta', 'GA', 'Northeast Atlanta', 'club', true),
  ('Diamond Cabaret', 'diamond-cabaret', '3035 Roswell Rd', 'Marietta', 'GA', 'Marietta', 'club', true),
  ('Flashers', 'flashers-atlanta', '2069 Metropolitan Pkwy SW', 'Atlanta', 'GA', 'South Atlanta', 'club', true),
  ('Tattletale Lounge', 'tattletale-lounge', '2075 Piedmont Rd NE', 'Atlanta', 'GA', 'Buckhead', 'club', true)
ON CONFLICT (slug) DO UPDATE SET
  is_adult = true,
  venue_type = 'club';

-- Male Strip Clubs / Male Revue
INSERT INTO venues (name, slug, address, city, state, neighborhood, venue_type, is_adult)
VALUES
  ('Swinging Richards', 'swinging-richards', '1402 Northside Dr NW', 'Atlanta', 'GA', 'West Midtown', 'club', true)
ON CONFLICT (slug) DO UPDATE SET
  is_adult = true,
  venue_type = 'club';

-- Lifestyle / Swingers Clubs
INSERT INTO venues (name, slug, address, city, state, neighborhood, venue_type, is_adult)
VALUES
  ('Trapeze Atlanta', 'trapeze-atlanta', '1829 Metropolitan Pkwy SW', 'Atlanta', 'GA', 'South Atlanta', 'club', true)
ON CONFLICT (slug) DO UPDATE SET
  is_adult = true,
  venue_type = 'club';

-- ============================================
-- 4. Set vibes for adult venues
-- ============================================
UPDATE venues SET vibes = ARRAY['late-night', '21-plus', 'adult'] WHERE slug = 'clermont-lounge';
UPDATE venues SET vibes = ARRAY['late-night', '21-plus', 'adult', 'hip-hop'] WHERE slug = 'magic-city';
UPDATE venues SET vibes = ARRAY['late-night', '21-plus', 'adult', 'upscale'] WHERE slug = 'pink-pony';
UPDATE venues SET vibes = ARRAY['late-night', '21-plus', 'adult'] WHERE slug = 'oasis-goodtime-emporium';
UPDATE venues SET vibes = ARRAY['late-night', '21-plus', 'adult', 'hip-hop'] WHERE slug = 'onyx-atlanta';
UPDATE venues SET vibes = ARRAY['late-night', '21-plus', 'adult'] WHERE slug = 'diamond-cabaret';
UPDATE venues SET vibes = ARRAY['late-night', '21-plus', 'adult'] WHERE slug = 'flashers-atlanta';
UPDATE venues SET vibes = ARRAY['late-night', '21-plus', 'adult', 'upscale'] WHERE slug = 'tattletale-lounge';
UPDATE venues SET vibes = ARRAY['late-night', '21-plus', 'adult', 'lgbtq'] WHERE slug = 'swinging-richards';
UPDATE venues SET vibes = ARRAY['late-night', '21-plus', 'adult', 'lifestyle'] WHERE slug = 'trapeze-atlanta';

-- ============================================
-- 5. Auto-flag events from adult venues
-- ============================================
-- Trigger to automatically set is_adult on events from adult venues
CREATE OR REPLACE FUNCTION set_event_adult_flag()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.venue_id IS NOT NULL THEN
    SELECT is_adult INTO NEW.is_adult FROM venues WHERE id = NEW.venue_id;
    IF NEW.is_adult IS NULL THEN
      NEW.is_adult := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists, then create
DROP TRIGGER IF EXISTS event_adult_flag_trigger ON events;
CREATE TRIGGER event_adult_flag_trigger
  BEFORE INSERT OR UPDATE OF venue_id ON events
  FOR EACH ROW
  EXECUTE FUNCTION set_event_adult_flag();

-- Backfill existing events from adult venues
UPDATE events SET is_adult = true
WHERE venue_id IN (SELECT id FROM venues WHERE is_adult = true);

-- ============================================
-- 6. Add comment for documentation
-- ============================================
COMMENT ON COLUMN venues.is_adult IS 'Flag for adult entertainment venues (strip clubs, lifestyle clubs). Used for content filtering.';
COMMENT ON COLUMN events.is_adult IS 'Flag for adult-only events. Auto-set from venue, can also be manually flagged.';

-- ============================================
-- Summary
-- ============================================
-- New subcategories: nightlife.strip, nightlife.burlesque, nightlife.lifestyle, nightlife.revue
-- New venues: 10 adult entertainment venues
-- New columns: venues.is_adult, events.is_adult
-- New vibes: adult, 21-plus, lifestyle
-- Trigger: Auto-flags events from adult venues
