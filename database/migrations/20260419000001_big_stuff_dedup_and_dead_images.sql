-- ============================================================================
-- Big Stuff data cleanup — dedup + dead hero image URLs
-- ============================================================================
-- Diagnostic: crawlers/scripts/check_big_stuff_data_health.py run on 2026-04-19
-- found one true near-duplicate and four genuinely-404 hero image URLs in the
-- Big Stuff see-all page's query surface. Both fixes are point-scoped row
-- updates; the dedup relies on the loader's canonical_event_id IS NULL filter
-- to hide the dupe, and the NULL'd images let BigStuffHeroCard fall back to
-- its type-colored icon rather than render a broken-image placeholder.
--
-- NOT covered here (deliberately):
--   - 403 images on wp-content / Google Photos hosts (6 rows). These hotlink
--     cleanly through the /api/image-proxy proxy (PR #69 UA + same-origin
--     Referer fix). Requires a proxy-path re-test, not a migration.
--   - Atlanta Streets Alive "duplicate" flag (3 rows at separate dates). These
--     are legitimately distinct recurring-tentpole instances — diagnostic
--     false positive, captured as a detector improvement.

-- ----------------------------------------------------------------------------
-- 1. Georgia Renaissance Festival dedup
-- ----------------------------------------------------------------------------
-- id 66825: festival-window row (2026-04-11 → 2026-05-31), crawled 2026-02-20.
--           Canonical — full festival run, richer description, stable image_url.
-- id 206971: single-day row on 2026-05-31 (the festival's closing date),
--            crawled 2026-04-13. Misparsed as a standalone event instead of
--            the last weekend of the existing festival run.
UPDATE events
SET canonical_event_id = 66825
WHERE id = 206971
  AND canonical_event_id IS NULL;

-- ----------------------------------------------------------------------------
-- 2. Dead hero image URLs (confirmed 404 upstream)
-- ----------------------------------------------------------------------------
-- Clearing to NULL rather than replacing: the hero card has a per-type icon
-- fallback that looks intentional. Fresh URL capture belongs to the
-- crawler-rerun workstream, not this migration.
--
-- id 77121, 77114, 77120 (Atlanta Streets Alive):
--   all three point to atlantastreetsalive.com/wp-content/uploads/2024/08/
--   Atlanta-Streets-Alive-Banner-2024.jpg → 404. The 2024 banner was removed.
-- id 66853 (Gwinnett County Fair):
--   saffire.com CDN returns 404 for the cached image.
UPDATE events
SET image_url = NULL
WHERE id IN (77121, 77114, 77120, 66853)
  AND image_url IS NOT NULL;
