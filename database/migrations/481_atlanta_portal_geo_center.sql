-- Add geo_center to Atlanta portal filters
-- Enables weather pill in CityBriefing hero + evening planner features
-- Coordinates: downtown Atlanta (Five Points / city center)

UPDATE portals
SET filters = COALESCE(filters, '{}'::jsonb) || '{"geo_center": [33.7490, -84.3880]}'::jsonb
WHERE slug = 'atlanta';
