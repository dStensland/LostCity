-- Fix orphaned data: sources and events missing portal assignments
-- See audit findings from 2026-02-27

-- ============================================
-- P0: Fix Piedmont source ownership
-- These 6 sources are Piedmont's core content but were incorrectly
-- assigned to atlanta-support. Piedmont portal feed is entirely empty.
-- ============================================

UPDATE sources
SET owner_portal_id = '0624f034-5f71-4247-a322-c872c598eb06'  -- piedmont
WHERE id IN (244, 247, 249, 250, 255, 256)
  AND owner_portal_id = 'cf53e4b1-7689-42bd-9a50-042a87fb5bbd';  -- atlanta-support

-- ============================================
-- P2: Assign 51 global sources to Atlanta
-- These are all Atlanta venues (Elmyr, Clermont, Leon's, Vortex, etc.)
-- with owner_portal_id = NULL. Will leak into other cities once Nashville
-- goes live. Also fixes 39 events with null portal_id.
-- ============================================

UPDATE sources
SET owner_portal_id = '74c2f211-ee11-453d-8386-ac2861705695'  -- atlanta
WHERE owner_portal_id IS NULL
  AND is_active = true;

-- Backfill portal_id on events from newly-assigned sources
UPDATE events e
SET portal_id = s.owner_portal_id
FROM sources s
WHERE e.source_id = s.id
  AND e.portal_id IS NULL
  AND s.owner_portal_id = '74c2f211-ee11-453d-8386-ac2861705695';

-- ============================================
-- P3: Backfill portal_id on sourceless festival events
-- 75 manually-entered events (Atlanta Marathon, Georgia Renaissance
-- Festival, etc.) with no source_id and no portal_id.
-- ============================================

UPDATE events
SET portal_id = '74c2f211-ee11-453d-8386-ac2861705695'  -- atlanta
WHERE source_id IS NULL
  AND portal_id IS NULL
  AND is_active = true;

-- ============================================
-- P4: Fix Emory-demo source ownership
-- NGHS Community Events source owned by atlanta-support but events
-- stamped emory-demo.
-- ============================================

UPDATE sources
SET owner_portal_id = 'fba590ce-85ca-41fb-a50f-fdd36af2b5b0'  -- emory-demo
WHERE id = 1032
  AND owner_portal_id = 'cf53e4b1-7689-42bd-9a50-042a87fb5bbd';  -- atlanta-support

-- ============================================
-- Final: Refresh materialized view
-- The source ownership changes above should trigger the auto-refresh
-- from migration 268, but force a refresh to be safe.
-- ============================================

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
