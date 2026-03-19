-- Migration: Fix venue_type for administrative org venues that appear as destinations
-- in the family portal but are not places a family would visit.
--
-- Four venues currently have venue_type='organization' or 'nonprofit_hq' but appear
-- in the family portal destination carousel because they're linked to events:
--   - Scraplanta (id=2595): venue_type=organization — actually a creative reuse studio
--   - Atlanta Dept of Parks & Rec (id=5445): admin office, not a park to visit
--   - DeKalb County Recreation (id=5639): admin office, not a rec center
--   - Chess.Zone (id=6068): online chess platform, not a physical location
--
-- Pebble Tossers (id=5652): nonprofit_hq — volunteer org, not a destination.
--
-- Fix: Set explore_category=null (already null) and mark admin/virtual venues
-- with venue_type that prevents them from appearing in destination carousels.
-- Scraplanta is a legitimate creative reuse space — upgrade to 'maker_space'.
-- Admin bodies get venue_type='administrative'. Chess.Zone gets is_event_venue=false.
--
-- Root cause: The family programs crawlers create venue stubs for program providers
-- without checking whether they're physical visitable places. The crawler should
-- check venue_type at creation time and use 'administrative' for county departments.

-- Note: venues table does not have an updated_at column.
UPDATE venues SET venue_type = 'maker_space'
WHERE id = 2595 AND name ILIKE '%scraplanta%';

UPDATE venues SET venue_type = 'administrative'
WHERE id = 5445 AND name ILIKE '%Parks & Recreation%' AND venue_type = 'organization';

UPDATE venues SET venue_type = 'administrative'
WHERE id = 5639 AND name ILIKE '%DeKalb%' AND venue_type = 'organization';

UPDATE venues SET
  venue_type = 'organization',
  is_event_venue = false
WHERE id = 6068 AND name ILIKE '%chess%';

-- Pebble Tossers: keep nonprofit_hq but ensure not in explore
UPDATE venues SET
  explore_category = NULL,
  explore_featured = false
WHERE id = 5652 AND name ILIKE '%pebble toss%';

-- Verification:
-- SELECT id, name, venue_type, explore_category FROM venues
-- WHERE id IN (2595, 5445, 5639, 5652, 6068);
