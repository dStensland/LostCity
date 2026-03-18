-- Seed missing tentpole events that don't have dedicated crawlers.
-- These are annual Atlanta events discovered via gap analysis (2026-03-18).
-- Each is a city-defining or plan-ahead event missing from the database.

-- Use the manual-holiday-events source for attribution
-- portal_id inherited from source's owner_portal_id

-- ============================================================================
-- 1. JapanFest — Gas South Convention Center, ~30k attendees
-- Largest Japanese cultural festival in the Southeast
-- ============================================================================
INSERT INTO events (
  title, start_date, end_date, start_time, end_time,
  venue_id, source_id, category_id, importance,
  description, is_all_day, is_active, is_tentpole,
  source_url, portal_id
)
SELECT
  'JapanFest 2026',
  '2026-09-19', '2026-09-20', '10:00', '18:00',
  v.id, s.id, 'community', 'flagship',
  'The largest Japanese cultural festival in the Southeast, featuring traditional performances, martial arts demonstrations, Japanese food, anime activities, and cultural exhibits. Hosted by the Japan-America Society of Georgia.',
  false, true, true,
  'https://www.japanfest.org/',
  p.id
FROM venues v, sources s, portals p
WHERE v.slug = 'gas-south-convention-center'
  AND s.slug = 'manual-holiday-events'
  AND p.slug = 'atlanta'
  AND NOT EXISTS (
    SELECT 1 FROM events e
    WHERE e.title ILIKE '%japanfest%'
      AND e.start_date >= '2026-01-01'
      AND e.is_active = true
  );

-- ============================================================================
-- 2. Cabbagetown Chomp & Stomp — neighborhood chili cookoff + bluegrass
-- Beloved annual festival, ~5-8k attendees
-- ============================================================================
INSERT INTO events (
  title, start_date, start_time, end_time,
  venue_id, source_id, category_id, importance,
  description, is_all_day, is_active, is_tentpole,
  source_url, portal_id
)
SELECT
  'Cabbagetown Chomp & Stomp 2026',
  '2026-11-07', '11:00', '19:00',
  v.id, s.id, 'food_drink', 'major',
  'Annual chili cookoff and bluegrass festival in historic Cabbagetown. Features a 5K run, live bluegrass music, artist market, and dozens of chili competitors. Free admission; purchase a spoon to taste chili entries.',
  false, true, true,
  'https://chompandstomp.com/',
  p.id
FROM venues v, sources s, portals p
WHERE v.slug = 'cabbagetown'
  AND s.slug = 'manual-holiday-events'
  AND p.slug = 'atlanta'
  AND NOT EXISTS (
    SELECT 1 FROM events e
    WHERE e.title ILIKE '%chomp%stomp%'
      AND e.start_date >= '2026-01-01'
      AND e.is_active = true
  );

-- ============================================================================
-- 3. Old Fourth Ward Arts Festival — Historic Fourth Ward Park
-- Two festivals per year (spring + fall), 15k+ attendees each
-- ============================================================================
INSERT INTO events (
  title, start_date, end_date, start_time, end_time,
  venue_id, source_id, category_id, importance,
  description, is_all_day, is_active, is_tentpole,
  source_url, portal_id
)
SELECT
  'Old Fourth Ward Arts Festival - Fall 2026',
  '2026-09-26', '2026-09-27', '10:00', '17:00',
  2420, s.id, 'art', 'major',
  'Juried fine arts festival in Historic Fourth Ward Park featuring 150+ artists, live entertainment, and food vendors. Free admission.',
  false, true, true,
  'https://oldfourthwardparkartsfestival.com/',
  p.id
FROM sources s, portals p
WHERE s.slug = 'manual-holiday-events'
  AND p.slug = 'atlanta'
  AND NOT EXISTS (
    SELECT 1 FROM events e
    WHERE e.title ILIKE '%old fourth ward arts%'
      AND e.start_date >= '2026-01-01'
      AND e.is_active = true
  );

-- ============================================================================
-- 4. Decatur BBQ Blues & Bluegrass Festival — Oakhurst Village
-- Annual neighborhood festival
-- ============================================================================
INSERT INTO events (
  title, start_date, start_time, end_time,
  venue_id, source_id, category_id, importance,
  description, is_all_day, is_active, is_tentpole,
  source_url, portal_id
)
SELECT
  'Decatur BBQ Blues & Bluegrass Festival 2026',
  '2026-10-17', '12:00', '18:00',
  v.id, s.id, 'food_drink', 'major',
  'Annual BBQ, blues, and bluegrass festival in Oakhurst Village, Decatur. Features live music, BBQ from local restaurants, kids activities, and community fundraising. Free entry.',
  false, true, true,
  'https://decaturbbqfestival.com/',
  p.id
FROM venues v, sources s, portals p
WHERE v.slug = 'decatur-square'
  AND s.slug = 'manual-holiday-events'
  AND p.slug = 'atlanta'
  AND NOT EXISTS (
    SELECT 1 FROM events e
    WHERE e.title ILIKE '%decatur bbq%'
      AND e.start_date >= '2026-01-01'
      AND e.is_active = true
  );

-- ============================================================================
-- 5. Atlanta Black Pride — Labor Day weekend, 40k+ attendees
-- One of the largest Black Pride celebrations in the US
-- ============================================================================
INSERT INTO events (
  title, start_date, end_date, start_time,
  venue_id, source_id, category_id, importance,
  description, is_all_day, is_active, is_tentpole,
  source_url, portal_id
)
SELECT
  'Atlanta Black Pride 2026',
  '2026-09-04', '2026-09-07', NULL,
  v.id, s.id, 'community', 'flagship',
  'One of the largest Black Pride celebrations in the United States, held annually over Labor Day weekend. Features concerts, pool parties, film screenings, wellness events, and community programming across venues throughout Atlanta.',
  true, true, true,
  'https://atlantablackpride.org/',
  p.id
FROM venues v, sources s, portals p
WHERE v.slug = 'downtown-atlanta'
  AND s.slug = 'manual-holiday-events'
  AND p.slug = 'atlanta'
  AND NOT EXISTS (
    SELECT 1 FROM events e
    WHERE e.title ILIKE '%atlanta black pride%'
      AND e.start_date >= '2026-01-01'
      AND e.is_active = true
  );

-- ============================================================================
-- 6. Elevate Art Atlanta — Downtown, multi-day public art festival
-- ============================================================================
INSERT INTO events (
  title, start_date, end_date, start_time,
  venue_id, source_id, category_id, importance,
  description, is_all_day, is_active, is_tentpole,
  source_url, portal_id
)
SELECT
  'Elevate Art Atlanta 2026',
  '2026-10-09', '2026-10-11', NULL,
  v.id, s.id, 'art', 'major',
  'Annual celebration of public art across multiple Atlanta neighborhoods including Westview, West End, Castleberry Hill, and South Downtown. Features murals, installations, creative markets, panels, music, and community programming. Free events.',
  true, true, true,
  'https://elevateatlart.com/',
  p.id
FROM venues v, sources s, portals p
WHERE v.slug = 'downtown-atlanta'
  AND s.slug = 'manual-holiday-events'
  AND p.slug = 'atlanta'
  AND NOT EXISTS (
    SELECT 1 FROM events e
    WHERE e.title ILIKE '%elevate art%'
      AND e.start_date >= '2026-01-01'
      AND e.is_active = true
  );
