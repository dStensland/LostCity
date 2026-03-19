-- ============================================
-- MIGRATION 519: Fix is_feed_ready for family venue events
-- ============================================
-- Problem: Events from high-value family venues (Children's Museum,
-- Zoo Atlanta, Georgia Aquarium, YMCA, parks/rec programs) have
-- is_active=true but is_feed_ready=false. These events are invisible
-- in the portal feed and search because applyFeedGate filters on
-- is_feed_ready.
--
-- Root cause: The compute_is_feed_ready trigger correctly holds events
-- with no description, no image, and no series_id. However, for family
-- programs and attractions, a title like "Camp H2O Session 2 (Ages 8-12)"
-- is genuinely useful to families even without a prose description.
-- The quality gate is too strict for this content category.
--
-- Fix: Promote is_feed_ready=true for all future active events from the
-- named family-critical sources where the event title alone provides
-- sufficient context (attractions, camps, programs).
--
-- NOTE: This is a targeted backfill, not a trigger change. The quality
-- gate remains correct for general sources. The longer-term fix is to
-- improve crawlers to capture descriptions on first pass.
--
-- Clarification on is_live (not the issue here):
-- is_live=false on future events is EXPECTED and CORRECT. is_live is a
-- time-based "happening right now" flag — it starts false and flips to
-- true while an event is in progress. It does NOT gate feed visibility.
-- Feed visibility is controlled entirely by is_feed_ready. This migration
-- does NOT touch is_live.

DO $$
DECLARE
  promoted_count INTEGER;
BEGIN
  UPDATE events
  SET is_feed_ready = true
  WHERE is_feed_ready = false
    AND is_active = true
    AND start_date >= CURRENT_DATE
    AND canonical_event_id IS NULL
    AND source_id IN (
      SELECT s.id FROM sources s
      WHERE s.slug IN (
        -- Tier 1: Core family attractions (daily visits, summer programs)
        'childrens-museum',
        'zoo-atlanta',
        'georgia-aquarium',
        'fernbank',
        'fernbank-science-center',
        'high-museum',
        'atlanta-botanical',
        'carlos-museum',
        'atlanta-history-center',
        'puppetry-arts',
        'theatre-for-young-audiences',
        'stone-mountain-park',
        'six-flags',
        'sky-zone-atlanta',
        'illuminarium',
        'fun-spot-atlanta',
        'lego-discovery-center',
        -- Tier 2: Parks & recreation programs
        'ymca-atlanta',
        'atlanta-dpr',
        'atlanta-family-programs',
        'cobb-family-programs',
        'cobb-parks-rec',
        'dekalb-family-programs',
        'dekalb-parks-rec',
        'gwinnett-family-programs',
        'gwinnett-parks-rec',
        'decatur-recreation',
        'piedmont-park',
        -- Tier 3: Enrichment programs
        'callanwolde',
        'spruill-center-for-the-arts',
        'home-depot-kids-workshops',
        'chastain-arts',
        'marcus-jcc',
        'gigis-playhouse-atlanta',
        -- Tier 4: Nature / outdoor programs
        'chattahoochee-nature',
        'south-river-forest',
        -- Tier 5: Swim school programs (title-only by design from iClassPro API)
        'goldfish-swim-dunwoody',
        'goldfish-swim-brookhaven',
        'big-blue-swim-johns-creek',
        'diventures-alpharetta'
      )
      AND s.is_active = true
    );

  GET DIAGNOSTICS promoted_count = ROW_COUNT;
  RAISE NOTICE 'Promoted % family venue events to is_feed_ready=true', promoted_count;
END $$;

-- Verification query (run after migration to confirm):
-- SELECT s.slug, s.name,
--   COUNT(*) FILTER (WHERE e.is_feed_ready = true) AS feed_ready,
--   COUNT(*) FILTER (WHERE e.is_feed_ready = false) AS held,
--   COUNT(*) AS total
-- FROM events e
-- JOIN sources s ON e.source_id = s.id
-- WHERE e.start_date >= CURRENT_DATE
--   AND e.is_active = true
--   AND s.slug IN ('childrens-museum', 'zoo-atlanta', 'georgia-aquarium',
--                  'ymca-atlanta', 'callanwolde')
-- GROUP BY s.slug, s.name ORDER BY total DESC;

-- DOWN: Revert by re-running the trigger backfill on the affected rows.
-- The trigger on UPDATE OF title will re-evaluate is_feed_ready:
-- UPDATE events SET title = title
-- WHERE start_date >= CURRENT_DATE
--   AND source_id IN (SELECT id FROM sources WHERE slug IN (
--     'childrens-museum', 'zoo-atlanta', 'georgia-aquarium', ...));
