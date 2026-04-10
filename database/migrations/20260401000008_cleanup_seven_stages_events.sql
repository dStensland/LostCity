-- Clean up 7 Stages event data after crawler fix.
-- The dead 'seven-stages' source (id=1093) produced 72 orphaned events.
-- The active '7-stages' source (id=150) has duplicates from broken date hashing.

-- 1. Deactivate ALL events from the dead 'seven-stages' source
UPDATE events SET is_active = false
WHERE source_id IN (SELECT id FROM sources WHERE slug = 'seven-stages');

-- 2. Deactivate past events from the active source
UPDATE events SET is_active = false
WHERE source_id IN (SELECT id FROM sources WHERE slug = '7-stages')
  AND (
    -- End date is past (show run is over)
    (end_date IS NOT NULL AND end_date < CURRENT_DATE)
    -- Or start date is past and no end date
    OR (end_date IS NULL AND start_date < CURRENT_DATE)
  );

-- 3. Deactivate events with dates embedded in titles (archive artifacts)
UPDATE events SET is_active = false
WHERE source_id IN (SELECT id FROM sources WHERE slug IN ('7-stages', 'seven-stages'))
  AND (
    title ~ '\d{1,2}\.\d{1,2}\.\d{2,4}'
    OR title ~ '\d{1,2}/\d{1,2}/\d{2,4}'
  )
  AND is_active = true;

-- 4. Deduplicate: for each title, keep only the row with the latest start_date
-- and deactivate older duplicates
WITH ranked AS (
  SELECT id, title,
    ROW_NUMBER() OVER (PARTITION BY title ORDER BY start_date DESC, id DESC) AS rn
  FROM events
  WHERE source_id IN (SELECT id FROM sources WHERE slug = '7-stages')
    AND is_active = true
)
UPDATE events SET is_active = false
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
