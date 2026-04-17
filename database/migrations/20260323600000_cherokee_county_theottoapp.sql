-- Update Cherokee County Parks & Recreation to the correct platform URL.
--
-- Cherokee County does NOT use Rec1 (confirmed 2026-03-23 — the
-- secure.rec1.com/GA/cherokee-county tenant returns an empty 200 response).
-- Their actual registration platform is TheOttoApp (crpa.theottoapp.com),
-- org ID 439, with a public REST API at crpa.ottoplatform.com.
--
-- Platform:   TheOttoApp (crpa.theottoapp.com / crpa.ottoplatform.com)
-- Org ID:     439
-- Catalog:    https://crpa.theottoapp.com/public/org/439/catalog
-- Website:    https://www.playcherokee.org
--
-- Catalog as of 2026-03-23: 387 items
--   Classes: 151, Camps: 103, Events: 88, Leagues: 11
--   Future-dated: ~250 across Canton, Woodstock, Acworth, Holly Springs
--
-- Note: The existing source_subscriptions row (atlanta-families portal) is
-- preserved; only the URL is updated here.

UPDATE sources
SET
    url         = 'https://crpa.theottoapp.com/public/org/439/catalog',
    is_active   = true
WHERE slug = 'cherokee-county-parks-rec';

-- Verify the update applied (will warn if slug not found)
DO $$
DECLARE
    cnt integer;
BEGIN
    SELECT count(*) INTO cnt FROM sources WHERE slug = 'cherokee-county-parks-rec';
    IF cnt = 0 THEN
        RAISE WARNING 'cherokee-county-parks-rec source not found — run 20260322900011 first';
    ELSE
        RAISE NOTICE 'cherokee-county-parks-rec source updated to TheOttoApp URL';
    END IF;
END $$;
