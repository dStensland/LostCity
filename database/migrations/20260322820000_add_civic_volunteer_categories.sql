-- Backfill existing events: re-categorize civic and volunteer events
-- that were previously bucketed as "community" due to missing categories.
--
-- First inserts the new categories into the categories table (FK target),
-- then re-categorizes events by source.

-- Insert new categories (required before FK-constrained UPDATE)
INSERT INTO categories (id, name, display_order, icon, color)
VALUES
  ('civic',     'Civic',     10.5, 'Bank',      '#4A9E8A'),
  ('volunteer', 'Volunteer', 11,   'HandHeart', '#6ABF69')
ON CONFLICT (id) DO NOTHING;

-- Volunteer sources
UPDATE events
SET category_id = 'volunteer'
WHERE category_id = 'community'
  AND source_id IN (
    SELECT id FROM sources WHERE slug IN (
      'hands-on-atlanta',
      'atlanta-community-food-bank',
      'open-hand-atlanta',
      'medshare',
      'trees-atlanta',
      'concrete-jungle',
      'habitat-for-humanity-atlanta',
      'park-pride',
      'lifeline-animal-project',
      'furkids',
      'atlanta-humane-society',
      'big-brothers-big-sisters-atl',
      'pebble-tossers',
      'food-well-alliance',
      'city-of-refuge'
    )
  )
  AND is_active = true;

-- Civic sources
UPDATE events
SET category_id = 'civic'
WHERE category_id = 'community'
  AND source_id IN (
    SELECT id FROM sources WHERE slug IN (
      'atlanta-city-meetings',
      'atlanta-city-council',
      'atlanta-city-planning',
      'marta-board',
      'georgia-general-assembly',
      'georgia-elections-calendar',
      'georgia-elections',
      'georgia-ethics-commission',
      'mobilize-us',
      'atlanta-dsa',
      'indivisible-atl',
      'aclu-georgia',
      'common-cause-georgia',
      'fair-count',
      'lwv-atlanta',
      'civic-innovation-atl',
      'georgia-equality',
      'marta-army',
      'atlanta-public-schools-board',
      'dekalb-county-schools-board',
      'fulton-county-schools-board',
      'cobb-county-schools-board',
      'gwinnett-county-schools-board',
      'cherokee-county-schools-board',
      'clayton-county-schools-board',
      'dekalb-county-meetings',
      'fulton-county-meetings',
      'eventbrite-civic'
    )
  )
  AND is_active = true;
