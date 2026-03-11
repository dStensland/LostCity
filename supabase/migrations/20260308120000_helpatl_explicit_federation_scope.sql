-- HelpATL should only show portal-owned or explicitly federated content.
-- Also lock the civic visual preset so provisioning is repeatable.

UPDATE portals
SET
  branding = jsonb_set(
    COALESCE(branding, '{}'::jsonb),
    '{visual_preset}',
    '"editorial_light"'::jsonb,
    true
  ),
  settings = jsonb_set(
    COALESCE(settings, '{}'::jsonb),
    '{federation_scope}',
    '"explicit_only"'::jsonb,
    true
  ),
  updated_at = NOW()
WHERE slug = 'helpatl';
