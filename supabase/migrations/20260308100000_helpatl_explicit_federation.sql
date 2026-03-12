-- Fix HelpATL portal to use explicit_only federation scope.
-- Without this, the default "inherited_public" mode includes ALL events
-- with portal_id=NULL, which leaks the entire Atlanta event catalog.

UPDATE portals
SET settings = settings || '{"federation_scope": "explicit_only"}'::jsonb
WHERE slug = 'helpatl';
