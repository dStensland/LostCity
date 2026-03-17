-- Venue capacity and capacity tiers for planning horizon filtering.
-- Tiers: 1=intimate(<300), 2=mid(300-1500), 3=large(1500-5000), 4=amphitheater(5000-15000), 5=arena(15000+)

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS capacity INTEGER,
  ADD COLUMN IF NOT EXISTS capacity_tier SMALLINT
    CHECK (capacity_tier IS NULL OR capacity_tier BETWEEN 1 AND 5);

CREATE INDEX IF NOT EXISTS idx_venues_capacity_tier
  ON venues (capacity_tier)
  WHERE capacity_tier IS NOT NULL;

-- Seed ~20 major Atlanta venues with known capacities
UPDATE venues SET capacity = 71000, capacity_tier = 5 WHERE slug = 'mercedes-benz-stadium';
UPDATE venues SET capacity = 21000, capacity_tier = 5 WHERE slug = 'state-farm-arena';
UPDATE venues SET capacity = 41000, capacity_tier = 5 WHERE slug = 'truist-park';
UPDATE venues SET capacity = 13000, capacity_tier = 4 WHERE slug = 'gas-south-arena';
UPDATE venues SET capacity = 12000, capacity_tier = 4 WHERE slug = 'ameris-bank-amphitheatre';
UPDATE venues SET capacity = 7000,  capacity_tier = 4 WHERE slug = 'chastain-park-amphitheatre';
UPDATE venues SET capacity = 19000, capacity_tier = 4 WHERE slug = 'lakewood-amphitheatre';
UPDATE venues SET capacity = 5000,  capacity_tier = 4 WHERE slug = 'cadence-bank-amphitheatre';
UPDATE venues SET capacity = 4665,  capacity_tier = 3 WHERE slug = 'fox-theatre';
UPDATE venues SET capacity = 3600,  capacity_tier = 3 WHERE slug = 'coca-cola-roxy';
UPDATE venues SET capacity = 2600,  capacity_tier = 3 WHERE slug = 'tabernacle';
UPDATE venues SET capacity = 2400,  capacity_tier = 3 WHERE slug = 'the-eastern';
UPDATE venues SET capacity = 1100,  capacity_tier = 3 WHERE slug = 'the-masquerade';
UPDATE venues SET capacity = 1050,  capacity_tier = 3 WHERE slug = 'center-stage';
UPDATE venues SET capacity = 1100,  capacity_tier = 3 WHERE slug = 'buckhead-theatre';
UPDATE venues SET capacity = 1000,  capacity_tier = 2 WHERE slug = 'variety-playhouse';
UPDATE venues SET capacity = 1000,  capacity_tier = 2 WHERE slug = 'terminal-west';
UPDATE venues SET capacity = 600,   capacity_tier = 2 WHERE slug = 'the-loft';
