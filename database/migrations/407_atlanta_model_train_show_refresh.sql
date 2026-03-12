-- ============================================
-- MIGRATION 407: Atlanta Model Train Show Refresh
-- ============================================
-- Retargets the stale Atlanta Model Train Show festival metadata to the
-- official GSERR schedule page and the current future 2026 Duluth date.

UPDATE festivals
SET website = 'https://gserr.com/shows.htm',
    announced_2026 = true,
    announced_start = '2026-08-22',
    announced_end = '2026-08-22',
    pending_start = '2026-08-22',
    pending_end = '2026-08-22',
    date_confidence = 70,
    date_source = 'official-schedule'
WHERE slug = 'atlanta-model-train-show';
