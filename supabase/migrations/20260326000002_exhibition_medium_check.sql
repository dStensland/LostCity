-- Add CHECK constraint on exhibitions.medium to enforce the 10-value taxonomy.
-- Prevents typos and undocumented values.

ALTER TABLE exhibitions
ADD CONSTRAINT exhibitions_medium_check
CHECK (
  medium IS NULL
  OR medium IN (
    'painting', 'photography', 'sculpture', 'mixed_media',
    'printmaking', 'drawing', 'textile', 'digital',
    'ceramics', 'installation'
  )
);
