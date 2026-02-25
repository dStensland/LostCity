-- Phase 1 content pass for Explore tracks:
-- 1) Repair known broken/unreliable image URLs
-- 2) Backfill missing source URLs from venue websites
-- 3) Backfill missing editorial blurbs from existing venue text
-- 4) Seed one factual highlight per approved venue lacking highlights

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) P0 media fixes
-- ---------------------------------------------------------------------------

-- Use a first-party image from Bank of America Plaza's official site.
UPDATE venues
SET image_url = 'https://www.bankofamericaplaza.com/wp-content/uploads/2025/06/04-25-CP-Gensler-BoA-Lobby-0537-1-jpg.webp'
WHERE slug = 'bank-of-america-plaza';

-- Use a stable image from Shrine of the Black Madonna's official Wix site.
UPDATE venues
SET image_url = 'https://static.wixstatic.com/media/15574d_5c733308e7144be4882be653956f6389~mv2.jpg/v1/fill/w_1200,h_900,al_c,q_85,enc_avif,quality_auto/Shrine%20of%20the%20Black%20Madonna%20Cultural%20Center.jpg'
WHERE slug = 'shrine-black-madonna';

-- Remove known tracker pixel URL; better to fall back than ship a tracking pixel as artwork.
UPDATE venues
SET image_url = NULL
WHERE slug = 'compound-atlanta'
  AND image_url LIKE 'https://tag.simpli.fi/%';

-- ---------------------------------------------------------------------------
-- 2) Backfill missing source URLs from venue website
-- ---------------------------------------------------------------------------

WITH normalized_websites AS (
  SELECT
    v.id AS venue_id,
    CASE
      WHEN v.website IS NULL OR btrim(v.website) = '' THEN NULL
      WHEN v.website ~* '^https?://' THEN v.website
      WHEN v.website ~* '^[a-z0-9.-]+\.[a-z]{2,}(/.*)?$' THEN 'https://' || v.website
      ELSE NULL
    END AS normalized_website
  FROM venues v
)
UPDATE explore_track_venues etv
SET
  source_url = nw.normalized_website,
  source_label = COALESCE(NULLIF(etv.source_label, ''), 'Official Site'),
  updated_at = now()
FROM normalized_websites nw
WHERE etv.venue_id = nw.venue_id
  AND etv.status = 'approved'
  AND (etv.source_url IS NULL OR btrim(etv.source_url) = '')
  AND nw.normalized_website IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3) Backfill missing editorial blurbs from existing venue copy
-- ---------------------------------------------------------------------------

WITH blurb_candidates AS (
  SELECT
    etv.id AS track_venue_id,
    left(
      regexp_replace(
        coalesce(
          NULLIF(v.explore_blurb, ''),
          NULLIF(v.short_description, ''),
          NULLIF(v.description, '')
        ),
        E'\\s+',
        ' ',
        'g'
      ),
      220
    ) AS candidate_blurb
  FROM explore_track_venues etv
  JOIN venues v
    ON v.id = etv.venue_id
  WHERE etv.status = 'approved'
    AND (etv.editorial_blurb IS NULL OR btrim(etv.editorial_blurb) = '')
)
UPDATE explore_track_venues etv
SET
  editorial_blurb = bc.candidate_blurb,
  updated_at = now()
FROM blurb_candidates bc
WHERE etv.id = bc.track_venue_id
  AND bc.candidate_blurb IS NOT NULL
  AND length(bc.candidate_blurb) >= 32;

-- ---------------------------------------------------------------------------
-- 4) Seed one factual highlight for approved venues with none
-- ---------------------------------------------------------------------------

WITH venues_with_highlights AS (
  SELECT DISTINCT venue_id
  FROM venue_highlights
),
highlight_candidates AS (
  SELECT DISTINCT ON (v.id)
    v.id AS venue_id,
    CASE
      WHEN coalesce(v.venue_type, '') IN ('museum', 'historic_site', 'historical_site', 'landmark', 'monument') THEN 'history'
      WHEN coalesce(v.venue_type, '') IN ('park', 'garden', 'trail') THEN 'nature'
      WHEN coalesce(v.venue_type, '') IN ('gallery', 'art_gallery') THEN 'art'
      ELSE 'hidden_feature'
    END AS highlight_type,
    CASE
      WHEN v.neighborhood IS NOT NULL AND btrim(v.neighborhood) <> '' THEN v.neighborhood || ' context'
      WHEN v.venue_type IS NOT NULL AND btrim(v.venue_type) <> '' THEN initcap(replace(v.venue_type, '_', ' ')) || ' fact'
      ELSE 'Local context'
    END AS title,
    left(
      regexp_replace(
        coalesce(
          NULLIF(etv.editorial_blurb, ''),
          NULLIF(v.explore_blurb, ''),
          NULLIF(v.short_description, ''),
          NULLIF(v.description, '')
        ),
        E'\\s+',
        ' ',
        'g'
      ),
      220
    ) AS description
  FROM explore_track_venues etv
  JOIN venues v
    ON v.id = etv.venue_id
  LEFT JOIN venues_with_highlights vwh
    ON vwh.venue_id = v.id
  WHERE etv.status = 'approved'
    AND vwh.venue_id IS NULL
    AND coalesce(
      NULLIF(etv.editorial_blurb, ''),
      NULLIF(v.explore_blurb, ''),
      NULLIF(v.short_description, ''),
      NULLIF(v.description, '')
    ) IS NOT NULL
  ORDER BY v.id, etv.is_featured DESC, etv.sort_order ASC NULLS LAST
)
INSERT INTO venue_highlights (
  venue_id,
  highlight_type,
  title,
  description,
  sort_order,
  created_at
)
SELECT
  hc.venue_id,
  hc.highlight_type,
  hc.title,
  hc.description,
  900,
  now()
FROM highlight_candidates hc
WHERE hc.description IS NOT NULL
  AND length(hc.description) >= 40;

COMMIT;
