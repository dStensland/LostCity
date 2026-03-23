-- Remove nightlife venue subscriptions from the Lost City: Family portal.
--
-- Battle & Brew (160), Believe Music Hall (145), and The Painted Duck (177)
-- produce exclusively nightlife/bar content and should not be subscribed to the
-- family portal.  The exclude_categories filter catches their events at query
-- time, but subscription-level cleanup is cleaner and prevents accidental
-- exposure if that filter is ever relaxed.
--
-- Portal: atlanta-families (840edaab-ab97-4f15-9dca-fe8dd2101ec3)
-- Sources removed:
--   160  Battle & Brew
--   145  Believe Music Hall
--   177  The Painted Duck

DELETE FROM source_subscriptions
WHERE subscriber_portal_id = (
    SELECT id FROM portals WHERE slug = 'atlanta-families'
)
  AND source_id IN (
    SELECT id FROM sources
    WHERE slug IN ('battle-and-brew', 'believe-music-hall', 'painted-duck')
  );
