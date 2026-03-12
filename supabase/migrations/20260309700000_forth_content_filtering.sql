-- Add exclude_categories to FORTH portal filters (applies globally to all queries)
UPDATE portals
SET filters = COALESCE(filters, '{}'::jsonb) || jsonb_build_object(
  'exclude_categories', jsonb_build_array(
    'community', 'volunteer', 'government', 'religion',
    'wellness', 'learning', 'fitness'
  )
)
WHERE slug = 'forth';

-- Also add to each portal_section auto_filter for defense-in-depth
UPDATE portal_sections
SET auto_filter = COALESCE(auto_filter, '{}'::jsonb) || jsonb_build_object(
  'exclude_categories', jsonb_build_array(
    'community', 'volunteer', 'government', 'religion',
    'wellness', 'learning', 'fitness'
  )
)
WHERE portal_id = (SELECT id FROM portals WHERE slug = 'forth')
  AND auto_filter IS NOT NULL;
