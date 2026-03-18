-- Migration 522: Infer activity type tags on programs from name/description patterns.
-- Tags are stored as TEXT[] and a program can carry multiple activity tags.
-- This migration only updates rows that currently have no activity tags (or NULL tags),
-- so it is safe to re-run (idempotent by the WHERE filter).

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
      -- Build the new tag array by collecting every matching activity tag.
      -- Use array_remove to strip NULLs, then deduplicate with ARRAY(SELECT DISTINCT …).
      ARRAY(
        SELECT DISTINCT t FROM unnest(ARRAY[
          CASE WHEN (name || ' ' || COALESCE(description, '')) ILIKE '%soccer%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%basketball%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%tennis%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '% sport%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%baseball%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%football%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%lacrosse%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%volleyball%'
               THEN 'sports' END,

          CASE WHEN (name || ' ' || COALESCE(description, '')) ILIKE '%art%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%craft%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%paint%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%pottery%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%ceramics%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%drawing%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%sculpt%'
               THEN 'arts' END,

          CASE WHEN (name || ' ' || COALESCE(description, '')) ILIKE '%science%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%stem%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%robot%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%engineer%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%physics%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%chemistry%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%math%'
               THEN 'stem' END,

          CASE WHEN (name || ' ' || COALESCE(description, '')) ILIKE '%nature%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%outdoor%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%hike%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%garden%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%ecology%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%wildlife%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%forest%'
               THEN 'nature' END,

          CASE WHEN (name || ' ' || COALESCE(description, '')) ILIKE '%swim%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '% pool%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%aqua%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%water polo%'
               THEN 'swimming' END,

          CASE WHEN (name || ' ' || COALESCE(description, '')) ILIKE '%code%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%coding%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '% tech%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%computer%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%cyber%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%programming%'
               THEN 'coding' END,

          CASE WHEN (name || ' ' || COALESCE(description, '')) ILIKE '%theater%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%theatre%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%drama%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%acting%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%improv%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%stage%'
               THEN 'theater' END,

          CASE WHEN (name || ' ' || COALESCE(description, '')) ILIKE '%dance%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%ballet%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%hip hop%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%hip-hop%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%tap dance%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%jazz dance%'
               THEN 'dance' END,

          CASE WHEN (name || ' ' || COALESCE(description, '')) ILIKE '%gymnast%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%tumbl%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%cheer%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%acrobat%'
               THEN 'gymnastics' END,

          CASE WHEN (name || ' ' || COALESCE(description, '')) ILIKE '%music%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%piano%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%guitar%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%violin%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%drum%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '% band%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%choir%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%orchestra%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%instrument%'
               THEN 'music' END,

          CASE WHEN (name || ' ' || COALESCE(description, '')) ILIKE '%cook%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%bak%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%chef%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%culinary%'
                 OR (name || ' ' || COALESCE(description, '')) ILIKE '%kitchen%'
               THEN 'cooking' END
        ]) AS t
        WHERE t IS NOT NULL
      ) AS inferred_tags
    FROM programs
    -- Only process rows that don't already have activity tags set.
    -- An activity tag is one of the 12 known keys; if tags contains ANY of them,
    -- skip the row so we don't overwrite hand-curated data.
    WHERE (tags IS NULL OR NOT (tags && ARRAY[
      'sports','arts','stem','nature','swimming','coding',
      'theater','dance','gymnastics','music','cooking','general'
    ]))
    AND status = 'active'
  )
  UPDATE programs p
  SET tags = CASE
    -- If inferred_tags is empty, leave tags unchanged (don't stomp other non-activity tags)
    WHEN array_length(inf.inferred_tags, 1) IS NULL THEN p.tags
    -- Otherwise merge: keep existing non-activity tags and append inferred activity tags
    ELSE COALESCE(
      ARRAY(
        SELECT DISTINCT t
        FROM unnest(COALESCE(p.tags, ARRAY[]::TEXT[]) || inf.inferred_tags) AS t
      ),
      inf.inferred_tags
    )
  END
  FROM inferred inf
  WHERE p.id = inf.id
    AND array_length(inf.inferred_tags, 1) IS NOT NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'programs_activity_tag_inference: updated % rows', updated_count;
END $$;

-- Add a GIN index on the tags column if it doesn't already exist,
-- to support efficient array containment queries (tags @> ARRAY[...]).
CREATE INDEX IF NOT EXISTS idx_programs_tags ON programs USING GIN(tags)
  WHERE tags IS NOT NULL;


-- ============================================================
-- DOWN (manual rollback: not auto-reversible because we merged arrays)
-- To rollback: remove inferred activity tags from programs.
-- UPDATE programs SET tags = ARRAY(
--   SELECT t FROM unnest(tags) AS t
--   WHERE t NOT IN (
--     'sports','arts','stem','nature','swimming','coding',
--     'theater','dance','gymnastics','music','cooking','general'
--   )
-- );
-- DROP INDEX IF EXISTS idx_programs_tags;
-- ============================================================
