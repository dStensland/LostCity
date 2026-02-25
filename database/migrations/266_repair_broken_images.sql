-- Migration 266: Repair broken image URLs
-- Audit date: 2026-02-25
-- Cleans up ~598 broken image_url references across events, venues, series, festivals, explore_tracks.
-- Wikimedia 429s are left alone (rate-limited during bulk audit, work fine in browsers).

BEGIN;

-- ============================================================
-- 1. Relative paths — never valid as image URLs
--    Pattern: starts with / (but not //) or contains no protocol
-- ============================================================
UPDATE venues
SET image_url = NULL
WHERE image_url IS NOT NULL
  AND image_url !~ '^https?://';

UPDATE events
SET image_url = NULL
WHERE image_url IS NOT NULL
  AND image_url !~ '^https?://';

UPDATE events_deduplicated
SET image_url = NULL
WHERE image_url IS NOT NULL
  AND image_url !~ '^https?://';

UPDATE series
SET image_url = NULL
WHERE image_url IS NOT NULL
  AND image_url !~ '^https?://';

UPDATE festivals
SET image_url = NULL
WHERE image_url IS NOT NULL
  AND image_url !~ '^https?://';


-- ============================================================
-- 2. Doubled hostname bug (crawler URL-joining defect)
--    Pattern: https://host1.comhttps://real-cdn.com/path
--    Fix: extract the second (real) URL
-- ============================================================
UPDATE venues
SET image_url = regexp_replace(image_url, '^https?://[^/]+?(https?://)', '\1')
WHERE image_url ~ '^https?://[^/]+https?://';

UPDATE events
SET image_url = regexp_replace(image_url, '^https?://[^/]+?(https?://)', '\1')
WHERE image_url ~ '^https?://[^/]+https?://';

UPDATE events_deduplicated
SET image_url = regexp_replace(image_url, '^https?://[^/]+?(https?://)', '\1')
WHERE image_url ~ '^https?://[^/]+https?://';

UPDATE series
SET image_url = regexp_replace(image_url, '^https?://[^/]+?(https?://)', '\1')
WHERE image_url ~ '^https?://[^/]+https?://';


-- ============================================================
-- 3. _next/image wrappers (Regal, others) — external 403
--    These hotlink through another site's image optimizer.
-- ============================================================
UPDATE series
SET image_url = NULL
WHERE image_url LIKE '%/_next/image?url=%';

UPDATE events
SET image_url = NULL
WHERE image_url LIKE '%/_next/image?url=%';

UPDATE events_deduplicated
SET image_url = NULL
WHERE image_url LIKE '%/_next/image?url=%';


-- ============================================================
-- 4. Dead CDN domains — confirmed 404/403/timeout in audit
-- ============================================================

-- SeatEngine / Dice CDN (d2snwnmzyr8jue.cloudfront.net) — 57 URLs, all 404
UPDATE events
SET image_url = NULL
WHERE image_url LIKE 'https://d2snwnmzyr8jue.cloudfront.net/%';

UPDATE events_deduplicated
SET image_url = NULL
WHERE image_url LIKE 'https://d2snwnmzyr8jue.cloudfront.net/%';

UPDATE series
SET image_url = NULL
WHERE image_url LIKE 'https://d2snwnmzyr8jue.cloudfront.net/%';

-- MovieXchange film poster CDN — all returning 400
UPDATE events
SET image_url = NULL
WHERE image_url LIKE 'https://film-cdn.moviexchange.com/%';

UPDATE events_deduplicated
SET image_url = NULL
WHERE image_url LIKE 'https://film-cdn.moviexchange.com/%';

UPDATE series
SET image_url = NULL
WHERE image_url LIKE 'https://film-cdn.moviexchange.com/%';

-- Moe's and Joe's (dead domain)
UPDATE venues
SET image_url = NULL
WHERE image_url LIKE '%moesandjoes.com%';

UPDATE events
SET image_url = NULL
WHERE image_url LIKE '%moesandjoes.com%';

UPDATE events_deduplicated
SET image_url = NULL
WHERE image_url LIKE '%moesandjoes.com%';

-- OvationTix expired files
UPDATE events
SET image_url = NULL
WHERE image_url LIKE 'https://web.ovationtix.com/trs/api/rest/ClientFile%'
  AND image_url IN (
    'https://web.ovationtix.com/trs/api/rest/ClientFile(606560)',
    'https://web.ovationtix.com/trs/api/rest/ClientFile(578652)'
  );

UPDATE events_deduplicated
SET image_url = NULL
WHERE image_url LIKE 'https://web.ovationtix.com/trs/api/rest/ClientFile%'
  AND image_url IN (
    'https://web.ovationtix.com/trs/api/rest/ClientFile(606560)',
    'https://web.ovationtix.com/trs/api/rest/ClientFile(578652)'
  );

-- Wild Heaven Craft Beers (dead image path)
UPDATE events
SET image_url = NULL
WHERE image_url LIKE '%wildheavencraftbeers.com%'
  AND image_url LIKE '%.jpg%';

UPDATE events_deduplicated
SET image_url = NULL
WHERE image_url LIKE '%wildheavencraftbeers.com%'
  AND image_url LIKE '%.jpg%';

-- Bing Maps static tile URLs (require API key, 401)
UPDATE venues
SET image_url = NULL
WHERE image_url LIKE '%dev.virtualearth.net/REST/%';

-- Expired Google Places photo URLs (403)
UPDATE venues
SET image_url = NULL
WHERE image_url LIKE 'https://lh3.googleusercontent.com/places/%'
  AND image_url LIKE '%=s4800%';

-- boston.broadway.com (403)
UPDATE venues
SET image_url = NULL
WHERE image_url LIKE '%boston.broadway.com%';

-- Saffire CDN (dead event/festival images)
UPDATE venues
SET image_url = NULL
WHERE image_url LIKE 'https://cdn.saffire.com/%';

UPDATE events
SET image_url = NULL
WHERE image_url LIKE 'https://cdn.saffire.com/%';

UPDATE events_deduplicated
SET image_url = NULL
WHERE image_url LIKE 'https://cdn.saffire.com/%';

UPDATE festivals
SET image_url = NULL
WHERE image_url LIKE 'https://cdn.saffire.com/%';

-- Dead festival images (specific confirmed 404s)
UPDATE festivals
SET image_url = NULL
WHERE image_url IN (
  'https://sweetwater420fest.com/wp-content/uploads/2026/01/SWB-420Fest-Original-Art-260112-02-preview.jpg',
  'https://tasteofalpharettaga.com/wp-content/uploads/sites/28/2019/03/menu-icon.svg'
);

-- Expired Meetup photo URLs (403)
UPDATE events
SET image_url = NULL
WHERE image_url LIKE 'https://secure.meetupstatic.com/photos/%'
  AND image_url ~ '/highres_\d+\.jpeg$';

UPDATE events_deduplicated
SET image_url = NULL
WHERE image_url LIKE 'https://secure.meetupstatic.com/photos/%'
  AND image_url ~ '/highres_\d+\.jpeg$';

-- Dead Amazon/IMDB poster URLs
UPDATE events
SET image_url = NULL
WHERE image_url LIKE 'https://m.media-amazon.com/images/M/%'
  AND image_url LIKE '%_V1_SX300.jpg';

UPDATE events_deduplicated
SET image_url = NULL
WHERE image_url LIKE 'https://m.media-amazon.com/images/M/%'
  AND image_url LIKE '%_V1_SX300.jpg';

UPDATE series
SET image_url = NULL
WHERE image_url LIKE 'https://m.media-amazon.com/images/M/%'
  AND image_url LIKE '%_V1_SX300.jpg';

-- Blue Ridge imgix (expired/403)
UPDATE events
SET image_url = NULL
WHERE image_url LIKE 'https://blueridge.imgix.net/%';

UPDATE events_deduplicated
SET image_url = NULL
WHERE image_url LIKE 'https://blueridge.imgix.net/%';


-- ============================================================
-- 5. explore_tracks — all quote_portrait_url are broken (100%)
--    These were placeholder URLs that never resolved.
-- ============================================================
UPDATE explore_tracks
SET quote_portrait_url = NULL
WHERE quote_portrait_url IS NOT NULL;


-- ============================================================
-- 6. Cleanup: NULL out any remaining empty-string image URLs
-- ============================================================
UPDATE events SET image_url = NULL WHERE btrim(image_url) = '';
UPDATE events_deduplicated SET image_url = NULL WHERE btrim(image_url) = '';
UPDATE venues SET image_url = NULL WHERE btrim(image_url) = '';
UPDATE series SET image_url = NULL WHERE btrim(image_url) = '';
UPDATE festivals SET image_url = NULL WHERE btrim(image_url) = '';

COMMIT;
