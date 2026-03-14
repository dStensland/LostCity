-- Generate stronger shorthand aliases from venue/organization/program/festival names.
-- This helps proper-noun queries like "callanwolde" hit the canonical venue
-- instead of relying on manual overrides or app-layer reranking.

CREATE OR REPLACE FUNCTION search_term_alias_candidates(
  p_display_term TEXT,
  p_slug TEXT DEFAULT NULL
)
RETURNS TEXT[] AS $$
  WITH normalized_base AS (
    SELECT normalize_search_term(p_display_term) AS base_term
  ),
  raw_candidates AS (
    SELECT normalize_search_term(candidate) AS candidate
    FROM unnest(
      ARRAY[
        regexp_replace(COALESCE(p_display_term, ''), '\s*\([^)]*\)\s*', ' ', 'g'),
        regexp_replace(COALESCE(p_display_term, ''), '^\s*the\s+', '', 'i'),
        regexp_replace(
          COALESCE(p_display_term, ''),
          '\s+(fine arts center|performing arts center|arts center|art center|community center|cultural center|event center|music hall|theatre|theater|playhouse|museum|gallery|studios?|hall|association|foundation|society|collective|project|initiative|coalition|alliance|committee|council|inc|llc)\s*$',
          '',
          'i'
        ),
        replace(COALESCE(p_slug, ''), '-', ' ')
      ]
    ) AS raw(candidate)
  )
  SELECT COALESCE(
    array_agg(DISTINCT rc.candidate) FILTER (
      WHERE rc.candidate IS NOT NULL
        AND char_length(rc.candidate) >= 4
        AND rc.candidate <> nb.base_term
    ),
    ARRAY[]::TEXT[]
  )
  FROM raw_candidates rc
  CROSS JOIN normalized_base nb;
$$ LANGUAGE sql IMMUTABLE;

SELECT refresh_search_suggestions();
