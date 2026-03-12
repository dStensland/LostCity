-- P0 nav divergence lock:
-- Ensure atlanta remains discovery-oriented while helpatl is civic/action-oriented.

UPDATE portals
SET
  settings = jsonb_set(
    COALESCE(settings, '{}'::jsonb),
    '{nav_labels}',
    COALESCE(settings->'nav_labels', '{}'::jsonb) || jsonb_build_object(
      'feed', 'Discover',
      'find', 'What''s On',
      'community', 'Scene',
      'events', 'Stuff',
      'spots', 'Places'
    ),
    true
  ),
  updated_at = NOW()
WHERE slug = 'atlanta';

UPDATE portals
SET
  settings = jsonb_set(
    COALESCE(settings, '{}'::jsonb),
    '{nav_labels}',
    COALESCE(settings->'nav_labels', '{}'::jsonb) || jsonb_build_object(
      'feed', 'Act',
      'find', 'Calendar',
      'community', 'Groups',
      'events', 'Calendar',
      'spots', 'Community Spots'
    ),
    true
  ),
  updated_at = NOW()
WHERE slug = 'helpatl';
