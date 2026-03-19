-- Add relevance column to editorial_mentions to distinguish
-- venues that are the SUBJECT of an article vs merely mentioned in passing.
-- 'primary' = venue is a subject (matched in title, or category-coherent with guide topic)
-- 'incidental' = venue is casually referenced (e.g., museum mentioned in a "Best Hotels" article)

ALTER TABLE editorial_mentions
ADD COLUMN relevance TEXT NOT NULL DEFAULT 'primary'
CHECK (relevance IN ('primary', 'incidental'));

-- Backfill: demote obvious category mismatches for best_of/guide_inclusion mentions.
-- A venue whose type doesn't match the guide topic is almost certainly incidental.
-- e.g., High Museum appearing in a "Best Hotels" article.

UPDATE editorial_mentions em
SET relevance = 'incidental'
FROM venues v
WHERE em.venue_id = v.id
  AND em.mention_type IN ('best_of', 'guide_inclusion')
  AND em.guide_name IS NOT NULL
  AND (
    -- Hotel guides: only hotels are primary
    (em.guide_name ILIKE '%hotel%' AND v.venue_type NOT IN ('hotel'))
    -- Restaurant guides: restaurants + food halls
    OR (em.guide_name ILIKE '%restaurant%' AND v.venue_type NOT IN ('restaurant', 'food_hall', 'cafe'))
    -- Bar/cocktail guides: bars, nightclubs, breweries, etc.
    OR (em.guide_name ILIKE '%bar %' AND v.venue_type NOT IN ('bar', 'sports_bar', 'nightclub', 'brewery', 'distillery', 'winery', 'rooftop', 'restaurant'))
    OR (em.guide_name ILIKE '%cocktail%' AND v.venue_type NOT IN ('bar', 'sports_bar', 'nightclub', 'restaurant', 'rooftop', 'hotel'))
    -- Coffee guides
    OR (em.guide_name ILIKE '%coffee%' AND v.venue_type NOT IN ('coffee_shop', 'cafe', 'bakery', 'restaurant'))
    -- Brewery guides
    OR (em.guide_name ILIKE '%brewer%' AND v.venue_type NOT IN ('brewery', 'bar', 'restaurant'))
    -- Specific food type guides
    OR (em.guide_name ILIKE '%pizza%' AND v.venue_type NOT IN ('restaurant', 'food_hall'))
    OR (em.guide_name ILIKE '%bakery%' AND v.venue_type NOT IN ('restaurant', 'bakery', 'cafe', 'coffee_shop'))
    OR (em.guide_name ILIKE '%taco%' AND v.venue_type NOT IN ('restaurant', 'food_hall'))
    OR (em.guide_name ILIKE '%burger%' AND v.venue_type NOT IN ('restaurant', 'food_hall', 'bar', 'sports_bar'))
    OR (em.guide_name ILIKE '%sushi%' AND v.venue_type NOT IN ('restaurant'))
    OR (em.guide_name ILIKE '%ramen%' AND v.venue_type NOT IN ('restaurant'))
    OR (em.guide_name ILIKE '%bbq%' AND v.venue_type NOT IN ('restaurant'))
    OR (em.guide_name ILIKE '%steakhouse%' AND v.venue_type NOT IN ('restaurant'))
  );

-- Index for the web query (filters on venue_id + is_active + relevance)
CREATE INDEX idx_editorial_mentions_relevance
ON editorial_mentions (venue_id, is_active, relevance)
WHERE relevance = 'primary';
