-- Database-side parity copy of Supabase migration 20260316090000.

ALTER TABLE editorial_mentions
ADD COLUMN IF NOT EXISTS relevance TEXT NOT NULL DEFAULT 'primary'
CHECK (relevance IN ('primary', 'incidental'));

UPDATE editorial_mentions em
SET relevance = 'incidental'
FROM venues v
WHERE em.venue_id = v.id
  AND em.mention_type IN ('best_of', 'guide_inclusion')
  AND em.guide_name IS NOT NULL
  AND (
    (em.guide_name ILIKE '%hotel%' AND v.venue_type NOT IN ('hotel'))
    OR (em.guide_name ILIKE '%restaurant%' AND v.venue_type NOT IN ('restaurant', 'food_hall', 'cafe'))
    OR (em.guide_name ILIKE '%bar %' AND v.venue_type NOT IN ('bar', 'sports_bar', 'nightclub', 'brewery', 'distillery', 'winery', 'rooftop', 'restaurant'))
    OR (em.guide_name ILIKE '%cocktail%' AND v.venue_type NOT IN ('bar', 'sports_bar', 'nightclub', 'restaurant', 'rooftop', 'hotel'))
    OR (em.guide_name ILIKE '%coffee%' AND v.venue_type NOT IN ('coffee_shop', 'cafe', 'bakery', 'restaurant'))
    OR (em.guide_name ILIKE '%brewer%' AND v.venue_type NOT IN ('brewery', 'bar', 'restaurant'))
    OR (em.guide_name ILIKE '%pizza%' AND v.venue_type NOT IN ('restaurant', 'food_hall'))
    OR (em.guide_name ILIKE '%bakery%' AND v.venue_type NOT IN ('restaurant', 'bakery', 'cafe', 'coffee_shop'))
    OR (em.guide_name ILIKE '%taco%' AND v.venue_type NOT IN ('restaurant', 'food_hall'))
    OR (em.guide_name ILIKE '%burger%' AND v.venue_type NOT IN ('restaurant', 'food_hall', 'bar', 'sports_bar'))
    OR (em.guide_name ILIKE '%sushi%' AND v.venue_type NOT IN ('restaurant'))
    OR (em.guide_name ILIKE '%ramen%' AND v.venue_type NOT IN ('restaurant'))
    OR (em.guide_name ILIKE '%bbq%' AND v.venue_type NOT IN ('restaurant'))
    OR (em.guide_name ILIKE '%steakhouse%' AND v.venue_type NOT IN ('restaurant'))
  );

CREATE INDEX IF NOT EXISTS idx_editorial_mentions_relevance
ON editorial_mentions (venue_id, is_active, relevance)
WHERE relevance = 'primary';
