-- Register infant/toddler activity providers:
--   1. music-together-decatur  — Music Together of Decatur (baby/toddler music classes)
--   2. brave-and-kind-books    — Brave + Kind Bookshop (Babies Off Book, bilingual storytimes)
--
-- Both sources subscribed to the atlanta-families portal (slug='atlanta-families').
-- These target the 0-2 age gap identified in the family portal data audit.

-- -----------------------------------------------------------------------
-- 1. Insert sources
-- -----------------------------------------------------------------------

INSERT INTO sources (
    slug, name, url, source_type, is_active,
    crawl_frequency
)
VALUES
(
    'music-together-decatur',
    'Music Together of Decatur',
    'https://musictogetherofdecatur.com/classes.aspx',
    'events',
    true,
    'weekly'
),
(
    'brave-and-kind-books',
    'Brave + Kind Bookshop',
    'https://www.braveandkindbooks.com/collections/brave-events/products.json',
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
        'music-together-decatur',
        'brave-and-kind-books'
    )
) s
WHERE p.slug = 'atlanta-families'
ON CONFLICT (subscriber_portal_id, source_id) DO NOTHING;
