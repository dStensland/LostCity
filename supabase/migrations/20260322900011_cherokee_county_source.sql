-- Register Cherokee County Parks & Recreation as a source
-- and subscribe the atlanta-families portal.
--
-- Rec1 tenant slug: cherokee-county (pending — not yet live as of 2026-03-22)
-- URL: https://secure.rec1.com/GA/cherokee-county/catalog
-- County seat: Canton, GA
-- Coverage: Canton, Woodstock, Acworth (currently zero coverage in LostCity)
--
-- The crawler is registered and will activate automatically once the
-- Cherokee County Rec1 tenant begins serving catalog data.

INSERT INTO sources (name, slug, url, is_active, owner_portal_id)
SELECT
    'Cherokee County Parks & Recreation',
    'cherokee-county-parks-rec',
    'https://secure.rec1.com/GA/cherokee-county/catalog',
    true,
    p.id
FROM portals p WHERE p.slug = 'atlanta-families'
ON CONFLICT (slug) DO UPDATE SET
    url       = EXCLUDED.url,
    is_active = true;

INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
SELECT p.id, s.id, 'all', true
FROM portals p, sources s
WHERE p.slug = 'atlanta-families'
  AND s.slug = 'cherokee-county-parks-rec'
ON CONFLICT (subscriber_portal_id, source_id) DO NOTHING;
