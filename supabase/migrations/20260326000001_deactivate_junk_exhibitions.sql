-- Deactivate junk exhibition records: UI artifacts, bare numbers, and
-- sub-3-char titles that passed through before title validation was tightened.

UPDATE exhibitions
SET is_active = false
WHERE is_active = true
  AND (
    title IN (
      'View fullsize', 'View Fullsize',
      'Download Press Release', 'Click Here',
      'Read More', 'Learn More'
    )
    OR title ~ '^\d+$'
    OR length(trim(title)) < 3
  );
