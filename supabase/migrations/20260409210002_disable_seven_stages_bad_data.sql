-- Disable 7 Stages sources — crawler is scraping archive page and
-- hallucinating today's date on historical shows (~29 fabricated events/day).
-- Needs crawler fix before re-enabling.

UPDATE sources SET is_active = false
WHERE slug IN ('7-stages', 'seven-stages');

-- Clean up fabricated events: any event from these sources with a date
-- embedded in the title (indicates archive scraping artifact)
UPDATE events SET is_active = false
WHERE source_id IN (SELECT id FROM sources WHERE slug IN ('7-stages', 'seven-stages'))
  AND (
    title ~ '\d{1,2}\.\d{1,2}\.\d{2,4}'  -- dates like 8.19.25
    OR title ~ '\d{1,2}/\d{1,2}/\d{2,4}'  -- dates like 8/19/25
  );
