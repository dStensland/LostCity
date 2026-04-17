-- Register premium summer camp sources for the family portal.
-- These are $300-$800+/week specialty camps driving Jan-Mar camp season search behavior.
--
-- Sources added:
--   1. id-tech-atlanta       — iD Tech Camps (Emory + GA Tech + Alpharetta), ages 7-17, STEM
--   2. steve-and-kates-atlanta — Steve & Kate's Camp (Sandy Springs), ages 5-12, drop-in day camp
--
-- Sources already covered (no new crawlers needed):
--   - camp-invention-atlanta         — registered in 20260311124200, crawler exists
--   - high-museum-summer-art-camp    — registered in 20260311124900, crawler exists
--   - alliance-theatre-education     — registered in 20260323200000, crawler exists
--   - atlanta-history-center         — registered + summer camps captured in existing AHC crawler
--
-- Woodruff Arts Center as umbrella org has no combined camp listing separate from
-- its constituent venues (High Museum + Alliance Theatre) — already covered.

-- -----------------------------------------------------------------------
-- 1. Insert sources
-- -----------------------------------------------------------------------

INSERT INTO sources (
    slug, name, url, source_type, is_active,
    crawl_frequency
)
VALUES
(
    'id-tech-atlanta',
    'iD Tech Camps — Atlanta Area',
    'https://www.idtech.com/locations/georgia-summer-camps',
    'events',
    true,
    'weekly'
),
(
    'steve-and-kates-atlanta',
    'Steve & Kate''s Camp — Atlanta (Sandy Springs)',
    'https://www.steveandkatescamp.com/atlanta/',
    'events',
    true,
    'weekly'
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    is_active = EXCLUDED.is_active;

-- -----------------------------------------------------------------------
-- 2. Subscribe both sources to the atlanta-families portal
-- -----------------------------------------------------------------------

INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
SELECT p.id, s.id, 'all', true
FROM portals p
CROSS JOIN (
    SELECT id FROM sources WHERE slug IN (
        'id-tech-atlanta',
        'steve-and-kates-atlanta'
    )
) s
WHERE p.slug = 'atlanta-families'
ON CONFLICT (subscriber_portal_id, source_id) DO NOTHING;
