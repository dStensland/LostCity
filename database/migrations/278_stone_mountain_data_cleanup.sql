-- Stone Mountain data quality cleanup
-- Fixes hollow venue stub, misattributed event, and exhibit double-writes.

-- Fix event 83723: correct venue (Walk-Up Trail) and category
UPDATE events SET venue_id = 5114, category_id = 'outdoors', updated_at = now()
WHERE id = 83723;

-- Deactivate hollow venue stub
UPDATE venues SET is_active = false, updated_at = now()
WHERE id = 5129;

-- Deactivate exhibit event rows at Stone Mountain Park (now in venue_features)
UPDATE events SET is_active = false, updated_at = now()
WHERE venue_id = 992 AND content_kind = 'exhibit' AND is_active = true;

-- Deactivate exhibit event rows at Chattahoochee Nature Center
UPDATE events SET is_active = false, updated_at = now()
WHERE venue_id = (SELECT id FROM venues WHERE slug = 'chattahoochee-nature-center' LIMIT 1)
  AND content_kind = 'exhibit' AND is_active = true;
