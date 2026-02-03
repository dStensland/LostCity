-- ============================================
-- MIGRATION 109: Fix portal ambient effects
-- ============================================
-- Atlanta: Use rain effect (the signature neon rain)
-- Nashville: Use neon_broadway effect (custom Nashville animation)

-- Update Nashville to use the new neon_broadway ambient effect
UPDATE portals
SET branding = jsonb_set(
  branding::jsonb,
  '{ambient,effect}',
  '"neon_broadway"'
)::json
WHERE slug = 'nashville';

-- Update Atlanta to use rain ambient effect
UPDATE portals
SET branding = jsonb_set(
  branding::jsonb,
  '{ambient,effect}',
  '"rain"'
)::json
WHERE slug = 'atlanta';
