-- Migration: Atlanta Business Portal
--
-- Keep this file mirrored in database/migrations and supabase/migrations.

INSERT INTO portals (slug, name, status, portal_type, city_slug)
VALUES (
  'atlanta-business',
  'Atlanta Business',
  'draft',        -- not consumer-facing yet, just for source attribution
  'city',
  'atlanta'
)
ON CONFLICT (slug) DO NOTHING;
