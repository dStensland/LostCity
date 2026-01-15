-- Add Atlanta Farmers Markets as venues
-- These are the major recurring farmers markets in the Atlanta area

INSERT INTO venues (name, slug, address, neighborhood, city, state, spot_type, spot_types, description, vibes, active)
VALUES
  (
    'Freedom Farmers Market',
    'freedom-farmers-market',
    '675 Ponce De Leon Ave NE',
    'Poncey-Highland',
    'Atlanta',
    'GA',
    'farmers_market',
    ARRAY['farmers_market'],
    'Atlanta''s largest organic and locally-grown farmers market, located at the Carter Center. Features 100+ vendors with produce, meats, baked goods, and prepared foods.',
    ARRAY['outdoor-seating', 'family-friendly', 'dog-friendly'],
    true
  ),
  (
    'Grant Park Farmers Market',
    'grant-park-farmers-market',
    '547 Park Ave SE',
    'Grant Park',
    'Atlanta',
    'GA',
    'farmers_market',
    ARRAY['farmers_market'],
    'Community farmers market in the heart of Grant Park, offering fresh produce, artisan goods, and live music on Sundays.',
    ARRAY['outdoor-seating', 'family-friendly', 'dog-friendly', 'live-music'],
    true
  ),
  (
    'Piedmont Park Green Market',
    'piedmont-park-green-market',
    '400 Park Dr NE',
    'Midtown',
    'Atlanta',
    'GA',
    'farmers_market',
    ARRAY['farmers_market'],
    'Year-round Saturday market at Piedmont Park featuring Georgia-grown produce, local meats, cheeses, and artisan products.',
    ARRAY['outdoor-seating', 'family-friendly', 'dog-friendly'],
    true
  ),
  (
    'Peachtree Road Farmers Market',
    'peachtree-road-farmers-market',
    '2744 Peachtree Rd NW',
    'Buckhead',
    'Atlanta',
    'GA',
    'farmers_market',
    ARRAY['farmers_market'],
    'Buckhead''s premier farmers market at the Cathedral of St. Philip, featuring local farmers, bakers, and food artisans.',
    ARRAY['outdoor-seating', 'family-friendly'],
    true
  ),
  (
    'East Atlanta Village Farmers Market',
    'east-atlanta-village-farmers-market',
    '572 Stokeswood Ave SE',
    'East Atlanta Village',
    'Atlanta',
    'GA',
    'farmers_market',
    ARRAY['farmers_market'],
    'Neighborhood market featuring local produce, prepared foods, and crafts in the heart of East Atlanta Village.',
    ARRAY['outdoor-seating', 'family-friendly', 'dog-friendly', 'artsy'],
    true
  ),
  (
    'Decatur Farmers Market',
    'decatur-farmers-market',
    '308 W Ponce de Leon Ave',
    'Decatur',
    'Decatur',
    'GA',
    'farmers_market',
    ARRAY['farmers_market'],
    'Award-winning farmers market in downtown Decatur with over 50 vendors offering produce, meats, dairy, and baked goods.',
    ARRAY['outdoor-seating', 'family-friendly', 'dog-friendly'],
    true
  ),
  (
    'Morningside Farmers Market',
    'morningside-farmers-market',
    '1393 N Highland Ave NE',
    'Virginia-Highland',
    'Atlanta',
    'GA',
    'farmers_market',
    ARRAY['farmers_market'],
    'Saturday morning market featuring local and organic produce, artisan foods, and community gathering in Morningside.',
    ARRAY['outdoor-seating', 'family-friendly', 'dog-friendly'],
    true
  ),
  (
    'West End Farmers Market',
    'west-end-farmers-market',
    '868 Oak St SW',
    'West End',
    'Atlanta',
    'GA',
    'farmers_market',
    ARRAY['farmers_market'],
    'Community-focused market in historic West End offering fresh produce, prepared foods, and local crafts.',
    ARRAY['outdoor-seating', 'family-friendly', 'black-owned'],
    true
  ),
  (
    'Sweet Auburn Curb Market',
    'sweet-auburn-curb-market',
    '209 Edgewood Ave SE',
    'Sweet Auburn',
    'Atlanta',
    'GA',
    'farmers_market',
    ARRAY['farmers_market', 'restaurant'],
    'Atlanta''s original municipal market since 1924. A daily market featuring fresh produce, meats, seafood, baked goods, and diverse food vendors.',
    ARRAY['historic', 'family-friendly', 'casual'],
    true
  ),
  (
    'Ponce City Farmers Market',
    'ponce-city-farmers-market',
    '675 Ponce De Leon Ave NE',
    'Old Fourth Ward',
    'Atlanta',
    'GA',
    'farmers_market',
    ARRAY['farmers_market'],
    'Seasonal farmers market at Ponce City Market featuring local vendors and fresh produce on the Beltline.',
    ARRAY['outdoor-seating', 'family-friendly', 'dog-friendly'],
    true
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  neighborhood = EXCLUDED.neighborhood,
  spot_type = EXCLUDED.spot_type,
  spot_types = EXCLUDED.spot_types,
  description = EXCLUDED.description,
  vibes = EXCLUDED.vibes,
  active = EXCLUDED.active;
