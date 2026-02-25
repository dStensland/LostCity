-- Clean up dead event image URLs:
-- - Prefer venue image fallback when available
-- - Null out remaining dead URLs
-- Applies to both events and events_deduplicated.

BEGIN;

-- Known non-cloudfront dead/malformed event image URLs from global_image_audit.
WITH dead_urls AS (
  SELECT unnest(
    ARRAY[
      'https://www.metalsomelivebandkaraoke.com/wp-content/uploads/2023/08/metalsome-logo.png',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Fox_Theatre_%28Atlanta%29.jpg/1200px-Fox_Theatre_%28Atlanta%29.jpg',
      'https://img1.wsimg.com/isteam/ip/1cc4ae77-8071-4d2c-97b2-677e1dd3d7db/Atlanta%20Documentary%20Film%20Festival%202026%20banner-0001.jpg',
      'https://web.ovationtix.com/trs/api/rest/ClientFile(578341)',
      'https://citysprings.com/static/04c2f22f273138a6ded2cea5c6f91ad1/417f6/32_1950x1300.jpg',
      'https://www.chattnaturecenter.org/wp-content/uploads/2025/02/CNC-2025-Butterfly-Festival-Logo-FINAL.png',
      'https://www.spelman.edu/events/2026/02/_image_folder/highway-1-concert-event-thumbnail.jpg',
      'https://img1.wsimg.com/isteam/ip/34b35cc4-45b6-4f60-8b09-2e5a2f7720ec/Atlanta%20Film%20Series%20-%20Georgia%20Film%20Festival.png',
      'https://factoryatfranklin.comdata:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg=='
    ]::text[]
  ) AS url
),
dead_event_ids AS (
  SELECT e.id
  FROM events e
  LEFT JOIN dead_urls d
    ON d.url = e.image_url
  WHERE e.image_url LIKE 'https://d2snwnmzyr8jue.cloudfront.net/%'
     OR e.image_url LIKE '%data:image%'
     OR d.url IS NOT NULL
)
-- First pass: replace dead event image URLs with venue image fallback when possible.
UPDATE events e
SET
  image_url = COALESCE(v.hero_image_url, v.image_url),
  updated_at = now()
FROM venues v
WHERE e.id IN (SELECT id FROM dead_event_ids)
  AND e.venue_id = v.id
  AND COALESCE(v.hero_image_url, v.image_url) IS NOT NULL
  AND btrim(COALESCE(v.hero_image_url, v.image_url)) <> ''
  AND COALESCE(v.hero_image_url, v.image_url) NOT LIKE 'https://d2snwnmzyr8jue.cloudfront.net/%'
  AND COALESCE(v.hero_image_url, v.image_url) NOT LIKE '%data:image%';

-- Second pass: null any remaining dead event image URLs.
WITH dead_urls AS (
  SELECT unnest(
    ARRAY[
      'https://www.metalsomelivebandkaraoke.com/wp-content/uploads/2023/08/metalsome-logo.png',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Fox_Theatre_%28Atlanta%29.jpg/1200px-Fox_Theatre_%28Atlanta%29.jpg',
      'https://img1.wsimg.com/isteam/ip/1cc4ae77-8071-4d2c-97b2-677e1dd3d7db/Atlanta%20Documentary%20Film%20Festival%202026%20banner-0001.jpg',
      'https://web.ovationtix.com/trs/api/rest/ClientFile(578341)',
      'https://citysprings.com/static/04c2f22f273138a6ded2cea5c6f91ad1/417f6/32_1950x1300.jpg',
      'https://www.chattnaturecenter.org/wp-content/uploads/2025/02/CNC-2025-Butterfly-Festival-Logo-FINAL.png',
      'https://www.spelman.edu/events/2026/02/_image_folder/highway-1-concert-event-thumbnail.jpg',
      'https://img1.wsimg.com/isteam/ip/34b35cc4-45b6-4f60-8b09-2e5a2f7720ec/Atlanta%20Film%20Series%20-%20Georgia%20Film%20Festival.png',
      'https://factoryatfranklin.comdata:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg=='
    ]::text[]
  ) AS url
)
UPDATE events e
SET
  image_url = NULL,
  updated_at = now()
FROM dead_urls d
WHERE e.image_url = d.url
   OR e.image_url LIKE 'https://d2snwnmzyr8jue.cloudfront.net/%'
   OR e.image_url LIKE '%data:image%';

-- Repeat for events_deduplicated.
WITH dead_urls AS (
  SELECT unnest(
    ARRAY[
      'https://www.metalsomelivebandkaraoke.com/wp-content/uploads/2023/08/metalsome-logo.png',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Fox_Theatre_%28Atlanta%29.jpg/1200px-Fox_Theatre_%28Atlanta%29.jpg',
      'https://img1.wsimg.com/isteam/ip/1cc4ae77-8071-4d2c-97b2-677e1dd3d7db/Atlanta%20Documentary%20Film%20Festival%202026%20banner-0001.jpg',
      'https://web.ovationtix.com/trs/api/rest/ClientFile(578341)',
      'https://citysprings.com/static/04c2f22f273138a6ded2cea5c6f91ad1/417f6/32_1950x1300.jpg',
      'https://www.chattnaturecenter.org/wp-content/uploads/2025/02/CNC-2025-Butterfly-Festival-Logo-FINAL.png',
      'https://www.spelman.edu/events/2026/02/_image_folder/highway-1-concert-event-thumbnail.jpg',
      'https://img1.wsimg.com/isteam/ip/34b35cc4-45b6-4f60-8b09-2e5a2f7720ec/Atlanta%20Film%20Series%20-%20Georgia%20Film%20Festival.png',
      'https://factoryatfranklin.comdata:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg=='
    ]::text[]
  ) AS url
)
UPDATE events_deduplicated e
SET
  image_url = COALESCE(v.hero_image_url, v.image_url),
  updated_at = now()
FROM venues v
WHERE (e.image_url IN (SELECT url FROM dead_urls)
    OR e.image_url LIKE 'https://d2snwnmzyr8jue.cloudfront.net/%'
    OR e.image_url LIKE '%data:image%')
  AND e.venue_id = v.id
  AND COALESCE(v.hero_image_url, v.image_url) IS NOT NULL
  AND btrim(COALESCE(v.hero_image_url, v.image_url)) <> ''
  AND COALESCE(v.hero_image_url, v.image_url) NOT LIKE 'https://d2snwnmzyr8jue.cloudfront.net/%'
  AND COALESCE(v.hero_image_url, v.image_url) NOT LIKE '%data:image%';

WITH dead_urls AS (
  SELECT unnest(
    ARRAY[
      'https://www.metalsomelivebandkaraoke.com/wp-content/uploads/2023/08/metalsome-logo.png',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Fox_Theatre_%28Atlanta%29.jpg/1200px-Fox_Theatre_%28Atlanta%29.jpg',
      'https://img1.wsimg.com/isteam/ip/1cc4ae77-8071-4d2c-97b2-677e1dd3d7db/Atlanta%20Documentary%20Film%20Festival%202026%20banner-0001.jpg',
      'https://web.ovationtix.com/trs/api/rest/ClientFile(578341)',
      'https://citysprings.com/static/04c2f22f273138a6ded2cea5c6f91ad1/417f6/32_1950x1300.jpg',
      'https://www.chattnaturecenter.org/wp-content/uploads/2025/02/CNC-2025-Butterfly-Festival-Logo-FINAL.png',
      'https://www.spelman.edu/events/2026/02/_image_folder/highway-1-concert-event-thumbnail.jpg',
      'https://img1.wsimg.com/isteam/ip/34b35cc4-45b6-4f60-8b09-2e5a2f7720ec/Atlanta%20Film%20Series%20-%20Georgia%20Film%20Festival.png',
      'https://factoryatfranklin.comdata:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg=='
    ]::text[]
  ) AS url
)
UPDATE events_deduplicated e
SET
  image_url = NULL,
  updated_at = now()
WHERE e.image_url IN (SELECT url FROM dead_urls)
   OR e.image_url LIKE 'https://d2snwnmzyr8jue.cloudfront.net/%'
   OR e.image_url LIKE '%data:image%';

COMMIT;
