-- Expand festival_type: add market, fair, expo, tournament
-- festival_type is already TEXT, no schema change needed

-- Reclassify festivals by primary_type
UPDATE festivals SET festival_type = 'market' WHERE primary_type IN ('market', 'fair') AND festival_type = 'festival';
UPDATE festivals SET festival_type = 'expo' WHERE primary_type = 'hobby_expo' AND festival_type = 'festival';

-- Keyword-based reclassification for records without a telling primary_type
UPDATE festivals SET festival_type = 'market' WHERE festival_type = 'festival' AND (name ILIKE '%market%' OR name ILIKE '%flea%' OR name ILIKE '%bazaar%');
UPDATE festivals SET festival_type = 'fair' WHERE festival_type = 'festival' AND (name ILIKE '%fair%' AND name NOT ILIKE '%affair%');
UPDATE festivals SET festival_type = 'expo' WHERE festival_type = 'festival' AND (name ILIKE '%expo %' OR name ILIKE '%expo' OR name ILIKE '%trade show%');
UPDATE festivals SET festival_type = 'tournament' WHERE festival_type = 'festival' AND (name ILIKE '%tournament%' OR name ILIKE '%tourney%');
