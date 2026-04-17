-- Backfill series.image_url from the venue's image when:
-- 1. Series has no image
-- 2. Series is not a film (TMDB handles those)
-- 3. Series has a venue_id pointing to a venue with an image
--
-- This is the venue fallback layer — the event image cascade
-- (migration 20260322900000) already ran. This catches series
-- where no events had images either.

UPDATE series s
SET image_url = v.image_url
FROM venues v
WHERE s.venue_id = v.id
  AND s.image_url IS NULL
  AND s.series_type != 'film'
  AND v.image_url IS NOT NULL;
