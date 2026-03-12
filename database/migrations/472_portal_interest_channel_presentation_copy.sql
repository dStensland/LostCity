-- Phase 2 presentation polish for Atlanta sports and Hooky family-program tracks.
-- Reuse the existing settings-driven groups/feed UI instead of introducing
-- a new portal-specific component path.

UPDATE portals
SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
  'groups_page_title', 'Scenes & Groups',
  'interest_channels_feed_title', 'Follow Scenes',
  'interest_channels_see_all_label', 'All scenes',
  'joined_channels_label', 'Joined Scenes',
  'interest_channels_search_placeholder', 'Search scenes (watch parties, public play, run clubs...)',
  'interest_channel_type_labels', jsonb_build_object(
    'topic', 'Scene',
    'community', 'Group'
  )
)
WHERE slug = 'atlanta';

UPDATE portals
SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
  'groups_page_title', 'Program Tracks',
  'interest_channels_feed_title', 'Follow Tracks',
  'interest_channels_see_all_label', 'All tracks',
  'joined_channels_label', 'Saved Tracks',
  'interest_channels_search_placeholder', 'Search tracks (swim lessons, youth sports...)',
  'interest_channel_type_labels', jsonb_build_object(
    'topic', 'Track',
    'community', 'Group'
  )
)
WHERE slug = 'hooky';
