-- Add cuisine classification for restaurants, bars, and food venues.
-- Using TEXT[] (array) because many Atlanta venues are fusion or multi-concept
-- (e.g., a Korean-BBQ taco spot = {korean,mexican}).
-- No CHECK constraint — the classification script enforces a controlled vocabulary.

ALTER TABLE venues ADD COLUMN IF NOT EXISTS cuisine TEXT[];

-- GIN index enables fast queries like: WHERE cuisine @> '{mexican}'
-- or WHERE 'thai' = ANY(cuisine)
CREATE INDEX IF NOT EXISTS idx_venues_cuisine ON venues USING GIN (cuisine);

COMMENT ON COLUMN venues.cuisine IS 'Cuisine types e.g. {mexican,thai,southern}. Array for fusion/multi-concept venues.';
