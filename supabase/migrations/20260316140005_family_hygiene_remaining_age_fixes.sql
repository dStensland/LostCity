-- Migration: Fix remaining 15 programs with age_min=0 and age_max=0 that couldn't
-- be auto-extracted from names in the previous migration.
--
-- Two groups:
-- (A) Senior camp programs (PrimeTime Senior Camp, 55+) — tag adults-only, set age_min=55
-- (B) Youth programs with generic names (Spring Break Camp, overnight camp) — set typical
--     Atlanta DPR summer camp age range (6-17)
-- (C) "C.T Martin CBF 2026 Teens" — set age_min=13, age_max=17
-- (D) "Cooking with waylon" (DeKalb) — set typical kids cooking class range (6-14)

DO $$
DECLARE
  senior_count INTEGER;
  youth_count INTEGER;
BEGIN
  -- Senior camps: set age_min=55, age_max=100 (must set both to satisfy age_range_check),
  -- tag adults-only. The check requires age_min <= age_max.
  UPDATE programs
  SET
    age_min = 55,
    age_max = 100,
    tags = COALESCE(tags, ARRAY[]::TEXT[]) || ARRAY['adults-only'],
    updated_at = NOW()
  WHERE age_min = 0 AND age_max = 0
    AND status = 'active'
    AND (name ILIKE '%Senior Camp%' OR name ILIKE '%PrimeTime%' OR name ILIKE '%55+%');

  GET DIAGNOSTICS senior_count = ROW_COUNT;
  RAISE NOTICE 'Fixed % senior camp programs', senior_count;

  -- Teen program
  UPDATE programs
  SET age_min = 13, age_max = 17, updated_at = NOW()
  WHERE age_min = 0 AND age_max = 0
    AND status = 'active'
    AND name ILIKE '%Teens%';

  GET DIAGNOSTICS youth_count = ROW_COUNT;
  RAISE NOTICE 'Fixed % teen programs', youth_count;

  -- Generic youth spring break / overnight camps from Atlanta DPR
  -- These are CBF (Community Based Fitness) camps for school-age kids (5-17)
  UPDATE programs
  SET age_min = 5, age_max = 17, updated_at = NOW()
  WHERE age_min = 0 AND age_max = 0
    AND status = 'active'
    AND source_id = 1437  -- Atlanta Family Programs (DPR)
    AND (
      name ILIKE '%Spring Break Camp%'
      OR name ILIKE '%Overnight Camp%'
      OR name ILIKE '%Youth Football%'
    );

  GET DIAGNOSTICS youth_count = ROW_COUNT;
  RAISE NOTICE 'Fixed % generic DPR youth camp programs', youth_count;

  -- Remaining single record (Cooking with waylon from DeKalb)
  UPDATE programs
  SET age_min = 6, age_max = 14, updated_at = NOW()
  WHERE age_min = 0 AND age_max = 0
    AND status = 'active'
    AND source_id = 1438
    AND name ILIKE '%Cooking%';

  GET DIAGNOSTICS youth_count = ROW_COUNT;
  RAISE NOTICE 'Fixed % cooking program', youth_count;
END $$;

-- Verification:
-- SELECT name, age_min, age_max FROM programs
-- WHERE age_min = 0 AND age_max = 0 AND status = 'active';
-- Expected: 0 rows
