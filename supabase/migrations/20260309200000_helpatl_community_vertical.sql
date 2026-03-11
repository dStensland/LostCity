-- Set vertical = 'community' on helpatl portal.
-- This was in database migration 288 but never applied via supabase migrations.

UPDATE portals
SET settings = COALESCE(settings, '{}'::jsonb) || '{"vertical": "community"}'::jsonb,
    updated_at = now()
WHERE slug = 'helpatl';
