-- Activate HelpATL portal and fix vertical value.
--
-- The portal was created with status='draft' and settings.vertical='civic',
-- but the frontend code checks vertical === 'community' to render CivicFeedShell.
-- This migration:
--   1. Sets status to 'active' so the portal resolves via getPortalBySlug()
--   2. Fixes vertical from 'civic' to 'community' to match the code path

UPDATE portals
SET
  status = 'active',
  settings = jsonb_set(
    COALESCE(settings, '{}'::jsonb),
    '{vertical}',
    '"community"'
  ),
  updated_at = now()
WHERE slug = 'helpatl';
