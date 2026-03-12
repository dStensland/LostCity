-- Phase 2 portal-presentation upgrade:
-- make the new sports/group structure legible in Atlanta and Hooky by
-- using the existing portal settings hooks for labels and descriptions.

UPDATE portals
SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
  'interest_channels_label', 'Scenes & Groups',
  'interest_channels_subtitle', 'Follow watch parties, public play, run clubs, aquatics, and sports communities around Atlanta.',
  'groups_page_description', 'Browse Atlanta scenes and groups for watch parties, public play, run clubs, aquatics, and join-first sports communities.',
  'groups_meta_description', 'Follow Atlanta scenes and groups for watch parties, public play, run clubs, aquatics, and sports communities.'
)
WHERE slug = 'atlanta';

UPDATE portals
SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
  'interest_channels_label', 'Program Tracks',
  'interest_channels_subtitle', 'Follow swim lessons and youth sports programs for Atlanta families.',
  'groups_page_description', 'Browse swim lessons, youth sports programs, and family activity tracks that help Hooky feel organized instead of overwhelming.',
  'groups_meta_description', 'Follow swim lessons, youth sports programs, and family activity tracks in Hooky.'
)
WHERE slug = 'hooky';
