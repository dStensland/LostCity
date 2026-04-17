-- Register Forsyth County Parks & Recreation as a source
-- and subscribe the atlanta-families portal.
--
-- Rec1 tenant slug: forsyth-county-ga
-- URL: https://secure.rec1.com/GA/forsyth-county-ga/catalog
-- County seat: Cumming, GA
-- Coverage: Forsyth County parks, camps, sports, dance, gymnastics,
--           martial arts, STEM, outdoor recreation, therapeutic programs

INSERT INTO sources (name, slug, url, is_active, owner_portal_id)
SELECT
    'Forsyth County Parks & Recreation',
    'forsyth-county-parks-rec',
    'https://secure.rec1.com/GA/forsyth-county-ga/catalog',
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
  AND s.slug = 'forsyth-county-parks-rec'
ON CONFLICT (subscriber_portal_id, source_id) DO NOTHING;
