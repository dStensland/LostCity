-- ============================================================
-- MIGRATION 416: Cleanup Georgia Tech Same-Slot Duplicates
-- ============================================================

WITH ranked AS (
  SELECT
    e.id,
    ROW_NUMBER() OVER (
      PARTITION BY e.source_id, e.venue_id, e.start_date
      ORDER BY
        CASE WHEN e.ticket_url IS NOT NULL AND e.ticket_url <> '' THEN 1 ELSE 0 END DESC,
        length(coalesce(e.title, '')) DESC,
        e.updated_at DESC,
        e.id DESC
    ) AS row_rank
  FROM events e
  WHERE e.source_id = (
      SELECT id
      FROM sources
      WHERE slug = 'georgia-tech-athletics'
      LIMIT 1
    )
    AND e.is_active = true
    AND e.start_date >= CURRENT_DATE
    AND e.venue_id IS NOT NULL
)
UPDATE events
SET is_active = false,
    updated_at = NOW()
WHERE id IN (
  SELECT id
  FROM ranked
  WHERE row_rank > 1
);
