-- Hope Atlanta (hopeatlanta.org) has no crawlable event calendar.
--
-- Investigation (2026-03-22):
-- - GET https://hopeatlanta.org/events/ → HTTP 403 Cloudflare block ("Sorry, you have been blocked")
-- - GET https://hopeatlanta.org/news-and-events/ → HTTP 403 Cloudflare block
-- - GET https://hopeatlanta.org/ → HTTP 403 Cloudflare block
-- - GET https://hopeatlanta.org/wp-json/tribe/events/v1/events → HTTP 403 Cloudflare block
--
-- The entire domain is behind a Cloudflare security rule that blocks all
-- non-browser automated requests. This is a CDN-level hard block, not a
-- JavaScript-rendering issue Playwright could bypass (Cloudflare bot detection
-- would still fire). The crawler at sources/hope_atlanta.py has never produced
-- a single event, confirmed by the generic regex selectors that were written
-- without inspecting the actual site.
--
-- Action: Deactivate the source. If Hope Atlanta later moves to a crawlable
-- platform (Eventbrite, Mobilize, etc.) or provides a public API, re-activate
-- with a rewritten crawler targeting that platform.

UPDATE sources
SET
    is_active = false,
    health_tags = array_append(COALESCE(health_tags, '{}'), 'deactivated:cloudflare_block')
WHERE slug IN ('hope-atlanta')
  AND is_active = true;

UPDATE events
SET is_active = false
WHERE source_id IN (
    SELECT id FROM sources WHERE slug = 'hope-atlanta'
)
  AND start_date >= CURRENT_DATE
  AND is_active = true;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
