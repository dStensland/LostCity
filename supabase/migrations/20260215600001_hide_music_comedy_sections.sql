-- Hide standalone Live Music and Comedy feed sections
-- These are now captured by the nightlife compound filter carousel.
-- Reversible: set is_visible = true to restore.

UPDATE portal_sections
SET is_visible = false
WHERE auto_filter IS NOT NULL
  AND is_visible = true
  AND (
    -- Music-only sections (category filter = music with no nightlife_mode)
    (auto_filter::jsonb->>'categories' IS NOT NULL
     AND auto_filter::jsonb->'categories' @> '["music"]'
     AND NOT (auto_filter::jsonb->>'nightlife_mode')::boolean IS TRUE
     AND jsonb_array_length(auto_filter::jsonb->'categories') = 1)
    OR
    -- Comedy-only sections
    (auto_filter::jsonb->>'categories' IS NOT NULL
     AND auto_filter::jsonb->'categories' @> '["comedy"]'
     AND NOT (auto_filter::jsonb->>'nightlife_mode')::boolean IS TRUE
     AND jsonb_array_length(auto_filter::jsonb->'categories') = 1)
  );
