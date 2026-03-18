-- Migration: Normalize unknown pricing
--
-- 52 events have is_free=false with both price_min and price_max NULL.
-- This is semantically wrong — if we don't know the price, is_free should be
-- NULL (unknown), not FALSE (definitely not free). UI shows empty price for these.

UPDATE events
SET is_free = NULL
WHERE is_free = FALSE
  AND price_min IS NULL
  AND price_max IS NULL;
