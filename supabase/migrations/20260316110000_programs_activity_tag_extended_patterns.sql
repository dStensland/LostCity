-- Migration 524: Extended activity tag patterns for programs.
--
-- Migration 522 (090004) tagged ~49% of programs with activity tags.
-- This follow-up adds patterns that were missing from the first pass,
-- targeting the vocabulary gaps identified in the 28%-coverage audit.
--
-- Additions per category:
--   gymnastics: flip (as in "flip class", "power flip")
--   music:      vocal, sing
--   swimming:   water safety, lifeguard
--   dance:      zumba
--   theater:    perform (as in "performing arts", "performance")
--   sports:     softball, flag football, cheerleading, martial arts,
--               karate, taekwondo, judo, fencing, archery, golf
--
-- Idempotent: only updates programs that do NOT already have the
-- targeted activity tag, so re-running is safe.

-- ============================================================
-- UP
-- ============================================================

DO $$
DECLARE
  updated_count INT;
BEGIN
  WITH inferred AS (
    SELECT
      id,
      ARRAY(
        SELECT DISTINCT t FROM unnest(ARRAY[
          -- gymnastics: add 'flip'
          CASE WHEN NOT (COALESCE(tags, ARRAY[]::TEXT[]) && ARRAY['gymnastics'])
                AND (
                  (name || ' ' || COALESCE(description, '')) ILIKE '%gymnast%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%tumbl%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%cheer%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%acrobat%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%flip class%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%power flip%'
                )
               THEN 'gymnastics' END,

          -- music: add vocal, sing
          CASE WHEN NOT (COALESCE(tags, ARRAY[]::TEXT[]) && ARRAY['music'])
                AND (
                  (name || ' ' || COALESCE(description, '')) ILIKE '%music%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%piano%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%guitar%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%violin%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%drum%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '% band%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%choir%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%orchestra%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%instrument%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%vocal%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%singing%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%sing %'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '% sing'
                )
               THEN 'music' END,

          -- swimming: add water safety, lifeguard
          CASE WHEN NOT (COALESCE(tags, ARRAY[]::TEXT[]) && ARRAY['swimming'])
                AND (
                  (name || ' ' || COALESCE(description, '')) ILIKE '%swim%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '% pool%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%aqua%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%water polo%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%water safety%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%lifeguard%'
                )
               THEN 'swimming' END,

          -- dance: add zumba
          CASE WHEN NOT (COALESCE(tags, ARRAY[]::TEXT[]) && ARRAY['dance'])
                AND (
                  (name || ' ' || COALESCE(description, '')) ILIKE '%dance%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%ballet%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%hip hop%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%hip-hop%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%tap dance%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%jazz dance%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%zumba%'
                )
               THEN 'dance' END,

          -- theater: add perform
          CASE WHEN NOT (COALESCE(tags, ARRAY[]::TEXT[]) && ARRAY['theater'])
                AND (
                  (name || ' ' || COALESCE(description, '')) ILIKE '%theater%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%theatre%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%drama%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%acting%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%improv%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%stage%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%perform%'
                )
               THEN 'theater' END,

          -- sports: add softball, flag football, cheerleading, martial arts,
          --         karate, taekwondo, judo, fencing, archery, golf
          CASE WHEN NOT (COALESCE(tags, ARRAY[]::TEXT[]) && ARRAY['sports'])
                AND (
                  (name || ' ' || COALESCE(description, '')) ILIKE '%soccer%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%basketball%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%tennis%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '% sport%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%baseball%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%football%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%lacrosse%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%volleyball%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%softball%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%flag football%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%cheerleading%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%martial arts%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%karate%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%taekwondo%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%tae kwon do%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%judo%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%fencing%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%archery%'
                  OR (name || ' ' || COALESCE(description, '')) ILIKE '%golf%'
                )
               THEN 'sports' END

        ]) AS t
        WHERE t IS NOT NULL
      ) AS new_tags
    FROM programs
    WHERE status = 'active'
  )
  UPDATE programs p
  SET tags = COALESCE(
    ARRAY(
      SELECT DISTINCT t
      FROM unnest(COALESCE(p.tags, ARRAY[]::TEXT[]) || inf.new_tags) AS t
    ),
    p.tags
  )
  FROM inferred inf
  WHERE p.id = inf.id
    AND array_length(inf.new_tags, 1) IS NOT NULL
    AND array_length(inf.new_tags, 1) > 0;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'programs_activity_tag_extended_patterns: updated % rows', updated_count;
END $$;

-- ============================================================
-- DOWN
-- No clean rollback: extended tags merged into existing arrays.
-- To revert specific tags, use targeted DELETE from unnest logic.
-- ============================================================
