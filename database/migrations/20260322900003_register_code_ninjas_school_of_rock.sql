-- MIGRATION: Register Code Ninjas Atlanta and School of Rock Atlanta sources
--
-- Code Ninjas has 5 open Atlanta-area locations: Suwanee (Sugar Hill), East Cobb
-- (Marietta), Cumming, Smyrna/Vinings, and Snellville. The crawler generates
-- year-round CREATE and JR program events (8 weeks ahead rolling window).
--
-- School of Rock has 2 Atlanta-area locations: Alpharetta and Woodstock (Holly
-- Springs). The crawler fetches live camp sessions via the /ajax/load-events API
-- and also generates Rock 101 recurring program anchors.
--
-- Both are family-portal sources — subscribed to the family portal.

-- Code Ninjas Atlanta
INSERT INTO sources (slug, name, url, source_type, is_active, owner_portal_id)
VALUES (
    'code-ninjas-atlanta',
    'Code Ninjas Atlanta',
    'https://www.codeninjas.com',
    'scrape',
    true,
    NULL
)
ON CONFLICT (slug) DO UPDATE SET
    is_active = true,
    name = EXCLUDED.name,
    url = EXCLUDED.url;

-- School of Rock Atlanta
INSERT INTO sources (slug, name, url, source_type, is_active, owner_portal_id)
VALUES (
    'school-of-rock-atlanta',
    'School of Rock Atlanta',
    'https://www.schoolofrock.com',
    'scrape',
    true,
    NULL
)
ON CONFLICT (slug) DO UPDATE SET
    is_active = true,
    name = EXCLUDED.name,
    url = EXCLUDED.url;

-- Subscribe both to the family portal (portal_id for 'family' slug)
INSERT INTO portal_source_subscriptions (portal_id, source_id)
SELECT p.id, s.id
FROM portals p
CROSS JOIN sources s
WHERE p.slug = 'family'
  AND s.slug IN ('code-ninjas-atlanta', 'school-of-rock-atlanta')
ON CONFLICT (portal_id, source_id) DO NOTHING;
