-- Migration: Tag adult-only programs from county parks sources so the family portal
-- API can filter them out.
--
-- Context: Cobb County (1303) and Gwinnett County (1304) are general county parks
-- sources owned by the Atlanta portal. They produce a mix of kids programs AND
-- adult/senior programs (AARP driving courses, senior fitness, adult leagues,
-- adult computer classes, lifeguard training, food vendor registrations).
-- 136 adult programs from these sources currently appear alongside kid programs.
--
-- The family portal programs API should filter WHERE (age_max < 18 OR age_max IS NULL)
-- AND NOT (adult-keyword tags). Until the crawler can set explicit age ranges
-- for all adult programs, we tag them with 'adults-only' so the API can exclude them.
--
-- Root cause: The county parks crawlers do not identify program audience type.
-- Fix needed in crawlers: detect adult-targeted programs at extraction time and
-- either set age_min >= 18 or skip them for the family portal feed.

DO $$
DECLARE
  tagged_count INTEGER;
BEGIN
  -- Tag programs that are clearly adult-only based on name patterns
  UPDATE programs
  SET
    tags = COALESCE(tags, ARRAY[]::TEXT[]) || ARRAY['adults-only'],
    updated_at = NOW()
  WHERE status = 'active'
    AND source_id IN (1303, 1304)  -- Cobb and Gwinnett county parks
    AND NOT (tags @> ARRAY['adults-only'])  -- idempotent
    AND (
      -- AARP programs
      name ILIKE '%AARP%'
      -- Senior programs
      OR name ILIKE '%senior%'
      OR name ILIKE '%Stretch for Gold%'
      -- Adult explicit
      OR name ILIKE '% adult %'
      OR name ILIKE 'adult %'
      OR name ILIKE '% adults%'
      -- Computer classes aimed at seniors
      OR name ILIKE '%Computer Basics%'
      OR name ILIKE '%TLCS %'
      OR name ILIKE '%TLSC %'
      -- Lifeguard training (requires min age 15, certification course not kids program)
      OR name ILIKE '%Lifeguard Training%'
      -- Adult leagues
      OR (name ILIKE '%League%' AND name NOT ILIKE '%ages%' AND name NOT ILIKE '% \d\d?\-\d\d? %')
      -- Food vendor registrations (not a program)
      OR name ILIKE '%Food Vendor%'
      OR name ILIKE '% Vendor%'
    );

  GET DIAGNOSTICS tagged_count = ROW_COUNT;
  RAISE NOTICE 'Tagged % adult-only programs from county parks sources', tagged_count;

  -- Also set age_min >= 18 for programs that already have confirmed adult age ranges
  UPDATE programs
  SET
    tags = COALESCE(tags, ARRAY[]::TEXT[]) || ARRAY['adults-only'],
    updated_at = NOW()
  WHERE status = 'active'
    AND source_id IN (1303, 1304)
    AND age_min >= 18
    AND NOT (tags @> ARRAY['adults-only']);

  GET DIAGNOSTICS tagged_count = ROW_COUNT;
  RAISE NOTICE 'Tagged % additional programs by age_min>=18 from county parks', tagged_count;
END $$;

-- The family portal programs API should add this to its WHERE clause:
--   AND NOT (tags @> ARRAY['adults-only'])
-- or equivalently:
--   AND (age_min IS NULL OR age_min < 18 OR source_id NOT IN (1303, 1304))
--
-- Verification:
-- SELECT name, age_min, age_max, tags FROM programs
-- WHERE source_id IN (1303, 1304) AND tags @> ARRAY['adults-only']
-- ORDER BY name LIMIT 20;
