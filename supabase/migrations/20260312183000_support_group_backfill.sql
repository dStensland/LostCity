-- Backfill legacy support inventory into the canonical support_group category.
-- New crawler writes already do this via infer_is_support_group(); this fixes
-- older rows that still sit inside wellness/community despite support tags.

INSERT INTO categories (id, name, display_order, icon, color)
VALUES ('support_group', 'Support Groups', 22, 'heart', '#94A3B8')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  display_order = EXCLUDED.display_order,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color;

UPDATE events
SET category_id = 'support_group',
  is_sensitive = true,
  updated_at = NOW()
WHERE COALESCE(tags, '{}'::text[]) && ARRAY['support-group']
  AND (
    category_id IS DISTINCT FROM 'support_group'
    OR is_sensitive IS DISTINCT FROM true
  );
