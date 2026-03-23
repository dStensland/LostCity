-- Register 3 new youth/STEM program sources and subscribe to atlanta-families portal.
-- Sources:
--   1. play-well-teknologies  — LEGO STEM summer camps across Atlanta metro
--   2. bsa-atlanta            — BSA Atlanta Area Council public events
--   3. georgia-4h             — Georgia 4-H statewide events (UGA Extension)

-- -----------------------------------------------------------------------
-- 1. Insert sources
-- -----------------------------------------------------------------------

INSERT INTO sources (
    slug, name, url, source_type, is_active,
    crawl_frequency_hours, city, state, country,
    notes
)
VALUES
(
    'play-well-teknologies',
    'Play-Well TEKnologies — Georgia Camps',
    'https://schedule.play-well.org/class/state/state/georgia',
    'events',
    true,
    168,  -- weekly (camp schedule is seasonal, changes slowly)
    'Atlanta',
    'GA',
    'USA',
    'LEGO-based STEM engineering camps for kids K-8 (ages 5-12) across Atlanta metro counties. Static HTML table schedule at schedule.play-well.org.'
),
(
    'bsa-atlanta',
    'BSA Atlanta Area Council — Council Events',
    'https://www.scoutingatl.org/calendar/553/Council-Events',
    'events',
    true,
    24,  -- daily (events calendar changes frequently)
    'Atlanta',
    'GA',
    'USA',
    'Scouting America Atlanta Area Council public events: merit badge workshops, camporees, Scout Day events, STEAM summits, Eagle ceremonies. Ages 5-17.'
),
(
    'georgia-4h',
    'Georgia 4-H — Statewide Events',
    'https://extension.uga.edu/calendar/browse/topic/6/4-H.html',
    'events',
    true,
    168,  -- weekly (state calendar updated less frequently)
    'Atlanta',
    'GA',
    'USA',
    'Georgia 4-H youth development program statewide events via UGA Extension calendar. State congress, judging competitions, leadership conferences. Ages 5-18.'
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    is_active = EXCLUDED.is_active,
    notes = EXCLUDED.notes;

-- -----------------------------------------------------------------------
-- 2. Subscribe all three sources to the atlanta-families portal
-- -----------------------------------------------------------------------

INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
SELECT p.id, s.id, 'all', true
FROM portals p
CROSS JOIN (
    SELECT id FROM sources WHERE slug IN (
        'play-well-teknologies',
        'bsa-atlanta',
        'georgia-4h'
    )
) s
WHERE p.slug = 'atlanta-families'
ON CONFLICT (subscriber_portal_id, source_id) DO NOTHING;
