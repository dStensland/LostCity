-- ============================================
-- MIGRATION 408: Cleanup Atlanta DPR Aquatic Duplicates
-- ============================================
-- Deactivate weaker broad atlanta-dpr rows once dedicated Atlanta aquatic
-- class sources own those programs with occurrence-level time fidelity.

UPDATE events
SET is_active = false,
    updated_at = NOW()
WHERE source_id IN (
    SELECT id FROM sources WHERE slug = 'atlanta-dpr'
)
AND is_active = true
AND start_date >= CURRENT_DATE
AND (
    lower(title) LIKE '%adult swim lessons%'
    OR lower(title) LIKE '%water aerobics%'
    OR lower(title) LIKE '%water awareness%'
);
