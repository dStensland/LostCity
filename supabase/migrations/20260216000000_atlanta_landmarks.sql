-- Seed Atlanta landmark venues
-- These are destinations people seek out that define the city's identity

INSERT INTO venues (name, slug, venue_type, city, state, neighborhood, lat, lng, description, short_description, active, explore_category)
VALUES
  (
    'Krog Street Tunnel',
    'krog-street-tunnel',
    'landmark',
    'Atlanta', 'GA', 'Cabbagetown',
    33.7530, -84.3633,
    'Atlanta''s most famous street art gallery, this railroad underpass connects Cabbagetown to Inman Park and is covered floor-to-ceiling in constantly evolving murals and graffiti. A rite of passage for anyone exploring the city.',
    'Iconic street art tunnel connecting Cabbagetown to Inman Park',
    true,
    'landmarks_attractions'
  ),
  (
    'Jackson Street Bridge',
    'jackson-street-bridge',
    'viewpoint',
    'Atlanta', 'GA', 'Old Fourth Ward',
    33.7588, -84.3722,
    'The most photographed skyline view in Atlanta. This pedestrian-friendly overpass offers a stunning panorama of the Downtown and Midtown skyline, especially at sunset. Made famous by The Walking Dead.',
    'Atlanta''s most iconic skyline photo spot',
    true,
    'landmarks_attractions'
  ),
  (
    'BeltLine Eastside Trail',
    'beltline-eastside-trail',
    'trail',
    'Atlanta', 'GA', 'Old Fourth Ward',
    33.7690, -84.3640,
    'The crown jewel of Atlanta''s 22-mile BeltLine loop, this 2.25-mile paved trail connects Piedmont Park to Inman Park through a corridor of public art, restaurants, and parks. The best way to experience Atlanta on foot.',
    'Atlanta''s signature urban trail with art, food, and parks',
    true,
    'parks_outdoors'
  ),
  (
    'Freedom Parkway Trail',
    'freedom-parkway-trail',
    'trail',
    'Atlanta', 'GA', 'Poncey-Highland',
    33.7670, -84.3570,
    'A scenic multi-use path connecting the Carter Center to the BeltLine, winding through the Freedom Park corridor with views of the Downtown skyline and lush tree canopy.',
    'Scenic path from Carter Center to the BeltLine',
    true,
    'parks_outdoors'
  ),
  (
    'Cabbagetown Murals',
    'cabbagetown-murals',
    'public_art',
    'Atlanta', 'GA', 'Cabbagetown',
    33.7500, -84.3610,
    'A living outdoor gallery spread across the historic mill village of Cabbagetown. Large-scale murals by local and international artists cover walls, fences, and buildings throughout the neighborhood.',
    'Outdoor mural gallery across a historic mill village',
    true,
    'landmarks_attractions'
  ),
  (
    'King Memorial Station Art',
    'king-memorial-station-art',
    'public_art',
    'Atlanta', 'GA', 'Sweet Auburn',
    33.7490, -84.3760,
    'The MARTA station honoring Dr. Martin Luther King Jr. features striking public art installations that tell the story of the civil rights movement and the surrounding Sweet Auburn district.',
    'Civil rights-themed public art at MARTA station',
    true,
    'landmarks_attractions'
  ),
  (
    'Oakland Cemetery',
    'oakland-cemetery',
    'historic_site',
    'Atlanta', 'GA', 'Grant Park',
    33.7486, -84.3713,
    'Founded in 1850, Oakland Cemetery is Atlanta''s oldest cemetery and a stunning 48-acre Victorian garden landscape. Self-guided tours wind past ornate monuments, Confederate memorials, and the graves of the city''s founders including Margaret Mitchell and Bobby Jones.',
    'Atlanta''s oldest cemetery — 48 acres of Victorian gardens and history',
    true,
    'landmarks_attractions'
  ),
  (
    'Castleberry Hill Art District',
    'castleberry-hill-art-district',
    'public_art',
    'Atlanta', 'GA', 'Castleberry Hill',
    33.7475, -84.4000,
    'One of Atlanta''s original arts districts, Castleberry Hill is home to galleries, street art, and the monthly Second Friday Art Stroll. The neighborhood''s warehouse buildings and brick facades provide a canvas for large-scale murals.',
    'Historic arts district with galleries and monthly art strolls',
    true,
    'landmarks_attractions'
  )
ON CONFLICT (slug) DO NOTHING;
