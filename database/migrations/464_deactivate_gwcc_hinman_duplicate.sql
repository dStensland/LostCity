-- ============================================
-- MIGRATION 464: Deactivate GWCC Hinman Duplicate
-- ============================================
UPDATE events
SET is_active = false
WHERE source_id IN (
  SELECT id
  FROM sources
  WHERE slug = 'gwcc'
)
AND lower(title) = 'the thomas p. hinman dental meeting 2026';
