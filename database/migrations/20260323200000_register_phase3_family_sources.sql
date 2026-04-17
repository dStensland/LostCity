-- Register Phase 3/4 family portal sources:
--   1. alliance-theatre-education  — Alliance Theatre drama camps + teen programs
--   2. engineering-for-kids-atlanta — EFK North Atlanta STEM camps (Amilia)
--   3. junior-achievement-georgia  — JA Homeschool Days (BizTown + Finance Park)
--
-- Note: snapology-dunwoody SKIPPED — no Dunwoody GA Snapology franchise exists.
--
-- All sources subscribed to atlas-families portal (slug='atlanta-families').

-- -----------------------------------------------------------------------
-- 1. Insert sources
-- -----------------------------------------------------------------------

INSERT INTO sources (
    slug, name, url, source_type, is_active,
    crawl_frequency
)
VALUES
(
    'alliance-theatre-education',
    'Alliance Theatre — Education & Camps',
    'https://www.alliancetheatre.org/classes/drama-camps/',
    'events',
    true,
    'weekly'
),
(
    'engineering-for-kids-atlanta',
    'Engineering For Kids — North Atlanta',
    'https://app.amilia.com/store/en/engineering-for-kids-of-north-atlanta/shop/programs',
    'events',
    true,
    'weekly'
),
(
    'junior-achievement-georgia',
    'Junior Achievement of Georgia — Homeschool Days',
    'https://www.georgia.ja.org/homeschool',
    'events',
    true,
    'weekly'
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    is_active = EXCLUDED.is_active;

-- -----------------------------------------------------------------------
-- 2. Subscribe all three sources to the atlanta-families portal
-- -----------------------------------------------------------------------

INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
SELECT p.id, s.id, 'all', true
FROM portals p
CROSS JOIN (
    SELECT id FROM sources WHERE slug IN (
        'alliance-theatre-education',
        'engineering-for-kids-atlanta',
        'junior-achievement-georgia'
    )
) s
WHERE p.slug = 'atlanta-families'
ON CONFLICT (subscriber_portal_id, source_id) DO NOTHING;
