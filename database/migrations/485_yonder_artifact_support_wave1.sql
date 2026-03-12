-- Migration 485: Yonder artifact support wave 1
--
-- Clean up a few high-value launch/support destination rows and attach
-- first-pass guide references for existing artifact-supporting places.

UPDATE venues
SET
  city = 'Helen',
  neighborhood = 'Helen',
  website = 'https://www.fs.usda.gov/r08/chattahoochee-oconee/recreation/anna-ruby-falls-recreation-area',
  short_description = 'Twin waterfalls on a paved, family-friendly trail with one of North Georgia''s clearest low-friction scenic payoffs.',
  planning_notes = 'Promote as a high-payoff waterfall stop with easy access and strong beginner appeal. Use official Forest Service guidance for hours, fees, and access conditions.'
WHERE slug = 'anna-ruby-falls';

UPDATE venues
SET
  city = 'Clarkesville',
  neighborhood = 'Habersham County',
  website = 'https://www.fs.usda.gov/r08/chattahoochee-oconee/recreation/panther-creek-recreation-area',
  short_description = 'North Georgia waterfall destination with a more demanding trail and a stronger day-hike payoff than the beginner waterfall set.',
  planning_notes = 'Promote as an intermediate-to-advanced waterfall outing. Check current Forest Service conditions before featuring access or trail readiness.'
WHERE slug = 'panther-creek-falls';

UPDATE venues
SET
  planning_notes = 'Best promoted as a flexible urban nature stop paired with Doll''s Head Trail or Grant Park-side Atlanta exploration.'
WHERE slug = 'constitution-lakes';

WITH guide_seed(slug, source_key, article_url, article_title, mention_type, guide_name, snippet) AS (
  VALUES
    (
      'anna-ruby-falls',
      'atlanta_trails',
      'https://www.atlantatrails.com/hiking-trails/anna-ruby-falls-trail/',
      'Anna Ruby Falls Trail',
      'guide_inclusion',
      'Waterfalls',
      'Useful route-depth guide for one of the easiest big-payoff waterfall stops in North Georgia.'
    ),
    (
      'panther-creek-falls',
      'atlanta_trails',
      'https://www.atlantatrails.com/hiking-trails/panther-creek-falls-trail-yonah-dam/',
      'Panther Creek Falls Trail: Yonah Dam to Panther Creek Falls',
      'guide_inclusion',
      'Waterfalls',
      'Best external route guide for this stronger, longer waterfall hike.'
    ),
    (
      'constitution-lakes',
      'atlas_obscura',
      'https://www.atlasobscura.com/places/dolls-head-trail-2',
      'Doll''s Head Trail',
      'feature',
      'Secret Atlanta',
      'Useful story source for the broader Constitution Lakes / Doll''s Head landscape and why it feels distinct.'
    )
)
INSERT INTO editorial_mentions (
  venue_id,
  source_key,
  article_url,
  article_title,
  mention_type,
  guide_name,
  snippet,
  is_active
)
SELECT
  v.id,
  guide_seed.source_key,
  guide_seed.article_url,
  guide_seed.article_title,
  guide_seed.mention_type,
  guide_seed.guide_name,
  guide_seed.snippet,
  true
FROM guide_seed
JOIN venues v ON v.slug = guide_seed.slug
ON CONFLICT (article_url, venue_id) DO UPDATE
SET
  source_key = EXCLUDED.source_key,
  article_title = EXCLUDED.article_title,
  mention_type = EXCLUDED.mention_type,
  guide_name = EXCLUDED.guide_name,
  snippet = EXCLUDED.snippet,
  is_active = true,
  updated_at = now();
