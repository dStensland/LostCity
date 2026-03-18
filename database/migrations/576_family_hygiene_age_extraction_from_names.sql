-- Migration: Extract age ranges from program names where age_min=0 AND age_max=0
-- 74 programs from Atlanta Family Programs (source 1437) have age_min=0 and age_max=0
-- but carry the age range clearly in their name (e.g., "CBF26- C.T. Martin 7 to 8 Boys Summer 2026").
-- 59 of these 74 have extractable age ranges.
--
-- Root cause: The Atlanta Family Programs crawler (atlanta_family_programs.py) crawls
-- Atlanta DPR's ACTIVENet catalog but either (a) fails to parse the age field from the
-- API response, or (b) the API returns 0/0 as the default and the crawler doesn't fall
-- back to name parsing. Fix needed in the crawler: parse age from program name when the
-- API returns 0/0 or null.
--
-- This migration applies the extraction in SQL using regexp patterns that mirror what
-- the crawler fix should implement.

DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  WITH age_extracted AS (
    SELECT
      id,
      -- 'X to Y' pattern (e.g., "7 to 8")
      CASE
        WHEN name ~* '\m(\d+)\s+to\s+(\d+)\M'
        THEN (regexp_match(name, '\m(\d+)\s+to\s+(\d+)\M', 'i'))[1]::INTEGER
        -- 'X-Y' pattern where both are plausible child ages (3-18)
        WHEN name ~ '\m([3-9]|1[0-8])-([3-9]|1[0-8])\M'
        THEN (regexp_match(name, '\m([3-9]|1[0-8])-([3-9]|1[0-8])\M'))[1]::INTEGER
        ELSE NULL
      END AS extracted_min,
      CASE
        WHEN name ~* '\m(\d+)\s+to\s+(\d+)\M'
        THEN (regexp_match(name, '\m(\d+)\s+to\s+(\d+)\M', 'i'))[2]::INTEGER
        WHEN name ~ '\m([3-9]|1[0-8])-([3-9]|1[0-8])\M'
        THEN (regexp_match(name, '\m([3-9]|1[0-8])-([3-9]|1[0-8])\M'))[2]::INTEGER
        ELSE NULL
      END AS extracted_max
    FROM programs
    WHERE age_min = 0
      AND age_max = 0
      AND status = 'active'
  )
  UPDATE programs p
  SET
    age_min = ae.extracted_min,
    age_max = ae.extracted_max,
    updated_at = NOW()
  FROM age_extracted ae
  WHERE p.id = ae.id
    AND ae.extracted_min IS NOT NULL
    AND ae.extracted_max IS NOT NULL
    -- Only update when extracted_min < extracted_max and both are child ages
    AND ae.extracted_min < ae.extracted_max
    AND ae.extracted_max <= 18;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Extracted age ranges from names for % programs', updated_count;
END $$;

-- Verification:
-- SELECT name, age_min, age_max FROM programs
-- WHERE age_min = 0 AND age_max = 0 AND status = 'active'
-- ORDER BY name LIMIT 20;
-- Expected: only the ~15 programs whose ages couldn't be extracted from the name
