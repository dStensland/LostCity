-- Migration 179: Reactivate civic/volunteer source shortlist
-- Purpose: restore upcoming volunteer and activism coverage in Atlanta.
-- Note: mobilize-* sources remain disabled by design (see 086_disable_mobilize_sources.sql).

BEGIN;

UPDATE sources
SET is_active = true
WHERE slug IN (
  'c4-atlanta',
  'cair-georgia',
  'dogwood-alliance',
  'everybody-wins-atlanta',
  'georgia-peace',
  'hosea-helps',
  'meals-on-wheels-atlanta',
  'new-georgia-project',
  'project-south',
  'south-river-forest'
);

COMMIT;

