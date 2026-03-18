-- Seed missing tentpole events (round 2) that don't have dedicated crawlers.
-- These are annual Atlanta events discovered via gap analysis (2026-03-18).
-- Each is a city-defining or plan-ahead event missing from the database.

-- Use the manual-holiday-events source for attribution.
-- portal_id inherited from source's owner_portal_id (atlanta).

-- ============================================================================
-- 1. Hamilton at Fox Theatre — flagship Broadway run
-- Blockbuster musical, limited engagement, consistently sells out
-- ============================================================================
INSERT INTO events (
  title, start_date, end_date, start_time,
  venue_id, source_id, category_id, importance,
  description, is_all_day, is_active, is_tentpole,
  source_url, portal_id
)
SELECT
  'Hamilton',
  '2026-09-02', '2026-09-20', '19:30',
  119,
  (SELECT id FROM sources WHERE slug = 'manual-holiday-events'),
  'theater', 'flagship',
  'The blockbuster Broadway musical returns to Fox Theatre for a limited engagement. Lin-Manuel Miranda''s hip-hop musical about Alexander Hamilton consistently sells out across the country. One of the hottest tickets in Atlanta''s fall theater season.',
  false, true, true,
  'https://www.foxtheatre.org/events',
  (SELECT id FROM portals WHERE slug = 'atlanta')
WHERE NOT EXISTS (
  SELECT 1 FROM events e
  WHERE e.title ILIKE '%hamilton%'
    AND e.venue_id = 119
    AND e.start_date >= '2026-09-01'
);

-- ============================================================================
-- 2. SEC Championship Game 2026 — Mercedes-Benz Stadium
-- 75,000+ fans, one of Atlanta's biggest weekends
-- ============================================================================
INSERT INTO events (
  title, start_date, start_time,
  venue_id, source_id, category_id, importance,
  description, is_all_day, is_active, is_tentpole,
  source_url, portal_id
)
SELECT
  'SEC Championship Game 2026',
  '2026-12-05', '16:00',
  108,
  (SELECT id FROM sources WHERE slug = 'manual-holiday-events'),
  'sports', 'flagship',
  'The annual SEC Conference Championship Game at Mercedes-Benz Stadium. One of the biggest weekends in Atlanta''s calendar — 75,000+ fans fill the stadium and the surrounding bars, restaurants, and hotels.',
  false, true, true,
  'https://www.mercedesbenzstadium.com/events',
  (SELECT id FROM portals WHERE slug = 'atlanta')
WHERE NOT EXISTS (
  SELECT 1 FROM events e
  WHERE e.title ILIKE '%sec championship%'
    AND e.start_date >= '2026-12-01'
);

-- ============================================================================
-- 3. Countdown Over ATL — New Year's Eve 2026
-- Official citywide celebration, drone show + fireworks, tens of thousands
-- ============================================================================
INSERT INTO events (
  title, start_date, start_time, end_time,
  venue_id, source_id, category_id, importance,
  description, is_all_day, is_active, is_tentpole,
  source_url, portal_id
)
SELECT
  'Countdown Over ATL - New Year''s Eve 2026',
  '2026-12-31', '20:00', '01:00',
  565,
  (SELECT id FROM sources WHERE slug = 'manual-holiday-events'),
  'community', 'major',
  'Atlanta''s official New Year''s Eve celebration featuring a citywide drone show and fireworks display over Downtown. The successor to the legendary Peach Drop, this event draws tens of thousands to ring in the new year in the heart of the city.',
  false, true, true,
  'https://www.atlantaga.gov/',
  (SELECT id FROM portals WHERE slug = 'atlanta')
WHERE NOT EXISTS (
  SELECT 1 FROM events e
  WHERE e.title ILIKE '%countdown%atl%'
    AND e.start_date >= '2026-12-01'
);
