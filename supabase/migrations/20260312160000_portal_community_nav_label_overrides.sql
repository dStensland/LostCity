-- ============================================================
-- MIGRATION 488: Per-portal nav label overrides for "community" key
-- ============================================================
-- The default label for the "community" nav key is "Going Out".
-- This migration sets per-portal overrides for verticals where
-- "Going Out" is contextually wrong.
--
-- Portal slugs:
--   helpatl      → civic/volunteer portal      → "Organize"
--   hooky        → family portal               → "Plan a Day"
--   arts-atlanta → arts/gallery portal         → "Shows"
--
-- FORTH (hotel) and Sports portals use the default "Going Out" — no override needed.
-- Adventure portal is not yet registered — update when it is provisioned.
-- ============================================================

-- HelpATL: civic action context — "Organize" replaces legacy "Groups" label
UPDATE portals
SET
  settings = jsonb_set(
    COALESCE(settings, '{}'::jsonb),
    '{nav_labels,community}',
    '"Organize"'
  ),
  updated_at = NOW()
WHERE slug = 'helpatl';

-- Hooky (Family portal): family planning context — "Plan a Day"
UPDATE portals
SET
  settings = jsonb_set(
    COALESCE(settings, '{}'::jsonb),
    '{nav_labels,community}',
    '"Plan a Day"'
  ),
  updated_at = NOW()
WHERE slug = 'hooky';

-- Arts Atlanta: exhibition/performance context — "Shows"
UPDATE portals
SET
  settings = jsonb_set(
    COALESCE(settings, '{}'::jsonb),
    '{nav_labels,community}',
    '"Shows"'
  ),
  updated_at = NOW()
WHERE slug = 'arts-atlanta';
