-- Migration: Reactivate Atlanta Nightlife Sources
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.
--
-- Reactivates 5 inactive crawlers.
-- Mother Bar is permanently closed — excluded.
-- Each source needs owner_portal_id set for the CHECK constraint.

-- 1. Mary's Bar — East Atlanta Village LGBTQ+ dive bar (Playwright)
UPDATE sources
SET is_active = true,
    owner_portal_id = COALESCE(owner_portal_id, (SELECT id FROM portals WHERE slug = 'atlanta'))
WHERE slug = 'marys-bar';

-- 2. Clermont Lounge — Poncey-Highland iconic burlesque/dive bar (Playwright/Wix)
UPDATE sources
SET is_active = true,
    owner_portal_id = COALESCE(owner_portal_id, (SELECT id FROM portals WHERE slug = 'atlanta'))
WHERE slug = 'clermont-lounge';

-- 3. Opera Nightclub — Midtown nightclub (Playwright)
UPDATE sources
SET is_active = true,
    owner_portal_id = COALESCE(owner_portal_id, (SELECT id FROM portals WHERE slug = 'atlanta'))
WHERE slug = 'opera-nightclub';

-- 4. SweetWater Brewing — Armour brewery with concerts (Playwright)
-- Also fix missing coordinates on the venue
UPDATE sources
SET is_active = true,
    owner_portal_id = COALESCE(owner_portal_id, (SELECT id FROM portals WHERE slug = 'atlanta'))
WHERE slug = 'sweetwater';

UPDATE venues
SET lat = 33.8106, lng = -84.3683
WHERE slug = 'sweetwater-brewing'
  AND (lat IS NULL OR lng IS NULL);

-- 5. Blind Willie's — Virginia-Highland blues bar (BeautifulSoup)
UPDATE sources
SET is_active = true,
    owner_portal_id = COALESCE(owner_portal_id, (SELECT id FROM portals WHERE slug = 'atlanta'))
WHERE slug = 'blind-willies';

-- 6. Atlantucky Brewing — already covered by atlanta-recurring-social source (no separate source slug to reactivate)
