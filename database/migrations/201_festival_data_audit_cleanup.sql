-- Migration 201: Festival data audit cleanup
--
-- Fixes credibility-killing data issues discovered via DB audit:
--   A. Demote stale dates (announced_start in the past) to pending
--   B. Fix absurd date ranges (Shaky Knees 143d, Roswell Roots 234d, Stone Mountain year wrap)
--   C. Merge 12 duplicate festival pairs (reassign series, delete dupes)

BEGIN;

-- ============================================================
-- A. Demote stale dates (announced_start before today) to pending
-- ============================================================
-- Any festival whose announced_start is already past should not display
-- as if those are upcoming dates. Move to pending for re-verification.

UPDATE festivals
SET pending_start = COALESCE(pending_start, announced_start),
    pending_end = COALESCE(pending_end, announced_end),
    announced_start = NULL,
    announced_end = NULL,
    date_confidence = 20,
    date_source = 'audit-demoted-stale'
WHERE announced_start IS NOT NULL
  AND announced_start < CURRENT_DATE
  AND (announced_end IS NULL OR announced_end < CURRENT_DATE);

-- ============================================================
-- B. Fix absurd date ranges
-- ============================================================

-- Shaky Knees: was showing May 1 – Sep 20 (143 days). It's a 3-day fest in September.
-- Correct to Sep 18-20, 2026 (typical dates) and set typical_month=9.
UPDATE festivals
SET announced_start = '2026-09-18',
    announced_end = '2026-09-20',
    typical_month = 9,
    typical_duration_days = 3,
    date_confidence = 60,
    date_source = 'audit-manual-fix'
WHERE slug = 'shaky-knees'
  AND announced_start IS NOT NULL;

-- If Shaky Knees dates were already demoted in step A, set pending dates instead
UPDATE festivals
SET pending_start = '2026-09-18',
    pending_end = '2026-09-20',
    typical_month = 9,
    typical_duration_days = 3,
    date_confidence = 60,
    date_source = 'audit-manual-fix'
WHERE slug = 'shaky-knees'
  AND announced_start IS NULL;

-- Roswell Roots Festival: was showing May 9 – Dec 29 (234 days). Clear all dates.
UPDATE festivals
SET announced_start = NULL,
    announced_end = NULL,
    pending_start = NULL,
    pending_end = NULL,
    date_confidence = NULL,
    date_source = 'audit-cleared-absurd'
WHERE slug = 'roswell-roots-festival';

-- Stone Mountain Christmas: end date before start (year wraparound bug).
-- Nov 7 2027 – Jan 3 2027 should be Nov 7 2027 – Jan 3 2028.
UPDATE festivals
SET announced_end = ((EXTRACT(YEAR FROM announced_start) + 1)::TEXT || '-01-03')::DATE
WHERE slug = 'stone-mountain-christmas'
  AND announced_start IS NOT NULL
  AND announced_end IS NOT NULL
  AND announced_end < announced_start;

-- Also fix if dates were demoted to pending
UPDATE festivals
SET pending_end = ((EXTRACT(YEAR FROM pending_start) + 1)::TEXT || '-01-03')::DATE
WHERE slug = 'stone-mountain-christmas'
  AND pending_start IS NOT NULL
  AND pending_end IS NOT NULL
  AND pending_end < pending_start;

-- ============================================================
-- C. Merge 12 duplicate festival pairs
-- ============================================================
-- For each pair: reassign linked series to the survivor, then delete the dupe.

-- 1. dogwood-festival (keep) <- atlanta-dogwood (delete)
UPDATE series SET festival_id = 'dogwood-festival'
WHERE festival_id = 'atlanta-dogwood';
DELETE FROM festivals WHERE slug = 'atlanta-dogwood';

-- 2. atlanta-food-wine-festival (keep) <- atlanta-food-wine (delete)
UPDATE series SET festival_id = 'atlanta-food-wine-festival'
WHERE festival_id = 'atlanta-food-wine';
DELETE FROM festivals WHERE slug = 'atlanta-food-wine';

-- 3. atlanta-jazz-fest (keep) <- atlanta-jazz-festival (delete)
UPDATE series SET festival_id = 'atlanta-jazz-fest'
WHERE festival_id = 'atlanta-jazz-festival';
DELETE FROM festivals WHERE slug = 'atlanta-jazz-festival';

-- 4. atlanta-jewish-film-festival (keep) <- ajff (delete)
UPDATE series SET festival_id = 'atlanta-jewish-film-festival'
WHERE festival_id = 'ajff';
DELETE FROM festivals WHERE slug = 'ajff';

-- 5. buried-alive-film-festival (keep) <- buried-alive (delete)
UPDATE series SET festival_id = 'buried-alive-film-festival'
WHERE festival_id = 'buried-alive';
DELETE FROM festivals WHERE slug = 'buried-alive';

-- 6. candler-park-fall-fest (keep) <- candler-park-fest (delete)
UPDATE series SET festival_id = 'candler-park-fall-fest'
WHERE festival_id = 'candler-park-fest';
DELETE FROM festivals WHERE slug = 'candler-park-fest';

-- 7. collect-a-con-atlanta-spring (keep) <- collect-a-con-atlanta (delete)
UPDATE series SET festival_id = 'collect-a-con-atlanta-spring'
WHERE festival_id = 'collect-a-con-atlanta';
DELETE FROM festivals WHERE slug = 'collect-a-con-atlanta';

-- 8. ga-mineral-society-show (keep) <- georgia-mineral-society-show (delete)
UPDATE series SET festival_id = 'ga-mineral-society-show'
WHERE festival_id = 'georgia-mineral-society-show';
DELETE FROM festivals WHERE slug = 'georgia-mineral-society-show';

-- 9. grant-park-summer-shade-festival (keep) <- grant-park-festival (delete)
-- grant-park-festival had the wrong Feb 17 date; the correct Aug record survives
UPDATE series SET festival_id = 'grant-park-summer-shade-festival'
WHERE festival_id = 'grant-park-festival';
DELETE FROM festivals WHERE slug = 'grant-park-festival';

-- 10. sweet-auburn-fest (keep) <- sweet-auburn-springfest (delete)
UPDATE series SET festival_id = 'sweet-auburn-fest'
WHERE festival_id = 'sweet-auburn-springfest';
DELETE FROM festivals WHERE slug = 'sweet-auburn-springfest';

-- 11. shaky-knees (keep) <- shaky-knees-festival (delete)
UPDATE series SET festival_id = 'shaky-knees'
WHERE festival_id = 'shaky-knees-festival';
DELETE FROM festivals WHERE slug = 'shaky-knees-festival';

-- 12. beer-bourbon-bbq-atlanta (keep) <- beer-bourbon-bbq (delete)
UPDATE series SET festival_id = 'beer-bourbon-bbq-atlanta'
WHERE festival_id = 'beer-bourbon-bbq';
DELETE FROM festivals WHERE slug = 'beer-bourbon-bbq';

-- ============================================================
-- D. Add CHECK constraints to prevent bad data going forward
-- ============================================================

-- End must be >= start (when both non-null)
ALTER TABLE festivals
  ADD CONSTRAINT chk_announced_end_gte_start
  CHECK (announced_end >= announced_start OR announced_end IS NULL OR announced_start IS NULL);

ALTER TABLE festivals
  ADD CONSTRAINT chk_pending_end_gte_start
  CHECK (pending_end >= pending_start OR pending_end IS NULL OR pending_start IS NULL);

-- Duration cap: 90 days (generous; Python validation is tighter at 60)
ALTER TABLE festivals
  ADD CONSTRAINT chk_announced_duration_max
  CHECK ((announced_end - announced_start) <= 90 OR announced_end IS NULL OR announced_start IS NULL);

ALTER TABLE festivals
  ADD CONSTRAINT chk_pending_duration_max
  CHECK ((pending_end - pending_start) <= 90 OR pending_end IS NULL OR pending_start IS NULL);

COMMIT;
