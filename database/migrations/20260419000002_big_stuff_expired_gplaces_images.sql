-- ============================================================================
-- Big Stuff — clear 2 expired Google Places signed-URL hero images
-- ============================================================================
-- Follow-up to 20260419000001. Proxy-path re-test (via /api/image-proxy)
-- found two Google Places "place-photos" signed URLs that 502 even through
-- the proxy's UA + same-origin Referer rescue path — the AL8-SN... signed
-- reference has expired. Also: both event rows point to the SAME signed
-- URL, so it's also a cross-event image collision (separate data-quality
-- issue beyond the expiry).
--
-- Hero card falls back to the type-colored icon when image_url IS NULL.
-- Fresh URL capture for these two events belongs to a crawler rerun, not
-- a migration — Google Places photos require a new API fetch per row.

UPDATE events
SET image_url = NULL
WHERE id IN (
  77102,  -- Piedmont Park Arts Festival 2026
  77111   -- Atlanta Pride Festival 2026
)
  AND image_url IS NOT NULL
  AND image_url LIKE '%googleusercontent.com/place-photos/%';
