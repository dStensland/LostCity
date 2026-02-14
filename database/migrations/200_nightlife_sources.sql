-- Atlanta Nightlife Crawler Blitz
-- Register and activate nightlife crawlers for bars, nightclubs, and music venues.

-- ============================================================
-- 1. Activate existing crawlers (already in sources table but inactive)
-- ============================================================
UPDATE sources SET is_active = true WHERE slug = 'joystick-gamebar';
UPDATE sources SET is_active = true WHERE slug = 'the-heretic';
UPDATE sources SET is_active = true WHERE slug = 'future-atlanta';
UPDATE sources SET is_active = true WHERE slug = 'tongue-and-groove';
UPDATE sources SET is_active = true WHERE slug = 'domaine-atlanta';
UPDATE sources SET is_active = true WHERE slug = 'compound-atlanta';
UPDATE sources SET is_active = true WHERE slug = 'basement-atlanta';
UPDATE sources SET is_active = true WHERE slug = 'havana-club';
UPDATE sources SET is_active = true WHERE slug = 'city-winery-atlanta';
UPDATE sources SET is_active = true WHERE slug = 'clermont-lounge';
UPDATE sources SET is_active = true WHERE slug = 'johnnys-hideaway';

-- Fix URLs for crawlers with incorrect website references
UPDATE sources SET url = 'https://www.hereticatlanta.com/events' WHERE slug = 'the-heretic';
UPDATE sources SET url = 'https://tandgonline.com/events' WHERE slug = 'tongue-and-groove';
UPDATE sources SET url = 'https://future-atlanta.com/nightclub/' WHERE slug = 'future-atlanta';

-- ============================================================
-- 2. Register new sources (insert if not exists)
-- ============================================================
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES
  ('The Velvet Note', 'velvet-note', 'https://thevelvetnote.com/events/', 'venue', 'daily', true),
  ('The S.O.S. Tiki Bar', 'sos-tiki-bar', 'https://www.sostiki.com/events-fairfield', 'venue', 'daily', true),
  ('Red Phone Booth', 'red-phone-booth', 'https://www.redphonebooth.com/upcoming-events/', 'venue', 'daily', true)
ON CONFLICT (slug) DO UPDATE SET is_active = true, url = EXCLUDED.url;

-- ============================================================
-- 3. Ensure Painted Duck stays inactive (private events focus)
-- ============================================================
UPDATE sources SET is_active = false WHERE slug = 'painted-duck';

-- ============================================================
-- 4. Ensure closed venues stay deactivated
-- ============================================================
UPDATE sources SET is_active = false WHERE slug = 'opera-nightclub';
UPDATE sources SET is_active = false WHERE slug = 'ravine-atlanta';
