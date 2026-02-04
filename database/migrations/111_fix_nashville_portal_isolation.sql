-- ============================================
-- MIGRATION 111: Fix Nashville Portal Isolation
-- ============================================
-- Nashville events were being created without portal_id because:
-- 1. Nashville crawler files didn't set portal_id on event records
-- 2. Nashville sources may not have owner_portal_id set
--
-- This migration:
-- 1. Ensures all Nashville sources have owner_portal_id set
-- 2. Backfills portal_id on existing Nashville events
-- 3. Verifies no Nashville events remain without portal_id

-- ============================================
-- STEP 1: Ensure Nashville sources have owner_portal_id
-- ============================================

UPDATE sources
SET owner_portal_id = (SELECT id FROM portals WHERE slug = 'nashville')
WHERE slug IN (
    'ticketmaster-nashville',
    'eventbrite-nashville',
    'nashville-com',
    'brooklyn-bowl-nashville',
    'nashville-scene',
    'nashville-example'
)
AND (owner_portal_id IS NULL OR owner_portal_id != (SELECT id FROM portals WHERE slug = 'nashville'));

-- ============================================
-- STEP 2: Backfill portal_id on Nashville events
-- ============================================
-- Set portal_id on events that belong to Nashville sources but have NULL portal_id

UPDATE events e
SET portal_id = s.owner_portal_id
FROM sources s
WHERE e.source_id = s.id
AND s.owner_portal_id = (SELECT id FROM portals WHERE slug = 'nashville')
AND e.portal_id IS NULL;

-- ============================================
-- STEP 3: Verification query (for manual inspection)
-- ============================================
-- Run this after migration to verify:
-- SELECT COUNT(*) as orphaned_nashville_events
-- FROM events e
-- JOIN sources s ON e.source_id = s.id
-- WHERE s.slug LIKE '%nashville%'
-- AND e.portal_id IS NULL;
-- Expected result: 0
