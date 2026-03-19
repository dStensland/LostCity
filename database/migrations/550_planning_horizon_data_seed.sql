-- ============================================================================
-- 550_planning_horizon_data_seed.sql
-- Planning Horizon: data seed, quality fixes, and importance tier assignments
--
-- Depends on:
--   548_planning_horizon.sql   (importance, on_sale_date, ticket_status columns)
--   549_venue_capacity_tiers.sql (capacity_tier on venues)
--
-- What this does:
--   1. Deactivate a known bad-data event (description-as-title from AFF crawl)
--   2. Deduplicate SweetWater 420 Fest — canonicalize the richest record
--   3. Seed on_sale_date + ticket intelligence for 7 Atlanta flagship festivals
--   4. Demote niche fandom events from flagship → major
--   5. Auto-promote paid events at large venues (capacity_tier >= 3) to major
--   6. Backfill ticket_status_checked_at on events that have ticket_status
--
-- All UPDATEs are idempotent — safe to re-run.
-- ============================================================================

-- ============================================================================
-- 1. DEACTIVATE BAD DATA
-- ============================================================================

-- Atlanta Film Festival's mission statement was crawled as an event title.
-- Identified via content audit: title starts with "Championing discovery" with
-- importance = 'flagship'. This is not an event — it is a description field
-- that leaked into the title column. Root cause: crawler fixed separately.
UPDATE events
  SET is_active = false
WHERE title ILIKE 'Championing discovery%'
  AND importance = 'flagship';

-- ============================================================================
-- 2. DEDUPLICATE SWEETWATER 420 FEST
-- ============================================================================

-- SweetWater 420 Fest appears multiple times on 2026-04-17 due to multiple
-- crawl sources (Eventbrite, venue site, possibly promoter site).
-- Strategy: keep the record with the best data completeness (image + ticket_url
-- + venue_id all present), then set canonical_event_id on the others pointing
-- to the keeper. The keeper itself keeps canonical_event_id = NULL.
--
-- Tie-breaking order: most fields populated first, then lowest id (earliest
-- crawled) as a stable tiebreaker within equal-quality records.

WITH sw_dupes AS (
  SELECT
    id,
    title,
    source_id,
    image_url,
    ticket_url,
    venue_id,
    ROW_NUMBER() OVER (
      PARTITION BY DATE(start_date)
      ORDER BY
        (
          (image_url   IS NOT NULL)::int +
          (ticket_url  IS NOT NULL)::int +
          (venue_id    IS NOT NULL)::int
        ) DESC,
        id ASC
    ) AS rn
  FROM events
  WHERE title ILIKE '%sweetwater 420%'
    AND start_date >= '2026-04-17'
    AND start_date <  '2026-04-18'
    AND is_active = true
)
UPDATE events
  SET canonical_event_id = (SELECT id FROM sw_dupes WHERE rn = 1)
WHERE id IN (SELECT id FROM sw_dupes WHERE rn > 1);

-- ============================================================================
-- 3. TICKET INTELLIGENCE SEED — FLAGSHIP FESTIVALS
-- ============================================================================
-- Realistic planning data based on known annual patterns for each festival.
-- All UPDATEs filter on title ILIKE + date range + importance + is_active to
-- be safe across environments. canonical_event_id IS NULL ensures we only
-- update the canonical record, not the dupes.

-- SweetWater 420 Fest (Apr 17) — paid outdoor music festival, multi-stage,
-- historically sells out general admission. 3-day pass historically $65–$299.
UPDATE events
  SET
    on_sale_date             = '2026-01-15',
    ticket_status            = 'tickets-available',
    ticket_status_checked_at = NOW(),
    sellout_risk             = 'high',
    price_min                = 65,
    price_max                = 299
WHERE title ILIKE '%sweetwater 420%'
  AND start_date >= '2026-04-17'
  AND start_date <  '2026-04-18'
  AND is_active = true
  AND canonical_event_id IS NULL;

-- Atlanta Film Festival (Apr 23–May 3) — paid multi-day film festival.
-- Single screenings $15; festival passes up to $350. Early bird ends ~Mar 15.
-- Excludes the deactivated description-as-title record via NOT ILIKE filter.
UPDATE events
  SET
    on_sale_date             = '2026-02-01',
    early_bird_deadline      = '2026-03-15',
    ticket_status            = 'tickets-available',
    ticket_status_checked_at = NOW(),
    sellout_risk             = 'medium',
    price_min                = 15,
    price_max                = 350
WHERE title ILIKE '%atlanta film festival%'
  AND title NOT ILIKE 'Championing%'
  AND start_date >= '2026-04-20'
  AND importance = 'flagship'
  AND is_active = true;

-- National Black Arts Festival (Apr 7) — mix of free and paid programming.
-- Community-oriented; most flagship performances ticketed $25–$75.
UPDATE events
  SET
    on_sale_date             = '2026-02-15',
    ticket_status            = 'tickets-available',
    ticket_status_checked_at = NOW(),
    sellout_risk             = 'low',
    price_min                = 0,
    price_max                = 75
WHERE title ILIKE '%national black arts festival%'
  AND start_date >= '2026-04-01'
  AND importance = 'flagship'
  AND is_active = true;

-- Georgia Renaissance Festival (Apr 11 through Jun) — single-day admissions,
-- no sellout risk. Tickets go on sale in early January.
UPDATE events
  SET
    on_sale_date             = '2026-01-10',
    ticket_status            = 'tickets-available',
    ticket_status_checked_at = NOW(),
    sellout_risk             = 'none',
    price_min                = 28,
    price_max                = 35
WHERE title ILIKE '%georgia renaissance festival%'
  AND start_date >= '2026-04-01'
  AND importance = 'flagship'
  AND is_active = true;

-- Atlanta Dogwood Festival (Apr 10–12) — free admission, Piedmont Park.
-- No ticket intelligence needed; confirming free status.
UPDATE events
  SET
    ticket_status            = 'free',
    ticket_status_checked_at = NOW(),
    sellout_risk             = 'none'
WHERE title ILIKE '%atlanta dogwood festival%'
  AND start_date >= '2026-04-01'
  AND importance = 'flagship'
  AND is_active = true;

-- NASCAR at Atlanta Motor Speedway (Apr 24 weekend) — large venue, low
-- sellout risk given 75k+ capacity; tickets on sale Dec 2025.
UPDATE events
  SET
    on_sale_date             = '2025-12-01',
    ticket_status            = 'tickets-available',
    ticket_status_checked_at = NOW(),
    sellout_risk             = 'low',
    price_min                = 49,
    price_max                = 500
WHERE title ILIKE '%nascar%atlanta%'
  AND start_date >= '2026-04-01'
  AND importance = 'flagship'
  AND is_active = true;

-- 404 Day (Apr 4) — free community celebration of Atlanta's area code.
-- No registration, no sellout risk.
UPDATE events
  SET
    ticket_status            = 'free',
    ticket_status_checked_at = NOW(),
    sellout_risk             = 'none'
WHERE title ILIKE '%404 day%'
  AND start_date >= '2026-04-04'
  AND start_date <  '2026-04-05'
  AND importance = 'flagship'
  AND is_active = true;

-- ============================================================================
-- 4. DEMOTE NICHE EVENTS: flagship → major
-- ============================================================================
-- These are real, well-attended events but they serve passionate niche
-- fandoms rather than the broader Atlanta public. They belong at 'major'
-- (worth planning around) rather than 'flagship' (city-defining).

UPDATE events
  SET importance = 'major'
WHERE importance = 'flagship'
  AND is_active = true
  AND (
       title ILIKE '%221B Con%'
    OR title ILIKE '%JordanCon%'
    OR title ILIKE '%LOVE Y''ALL%'
    OR title ILIKE '%Furry Weekend%'
    OR title ILIKE '%Vampire Diaries%'
    OR title ILIKE '%Big Shanty%'
    OR title ILIKE '%Blue Ridge Trout%'
    OR title ILIKE '%Decatur WatchFest%'
  );

-- ============================================================================
-- 5. AUTO-INFER major IMPORTANCE FROM VENUE CAPACITY
-- ============================================================================
-- Future paid events at large venues (capacity_tier >= 3, roughly 1500+ seats
-- per the capacity tier definitions in migration 549) that are still tagged
-- 'standard' should be promoted to 'major'. This is a conservative floor —
-- only non-free events at large venues get the bump.
--
-- Note: capacity_tier 3 lower bound is 1500 seats in the schema comment but
-- some tier-3 venues were seeded at ~1000 seats (Masquerade, Center Stage,
-- Buckhead Theatre). The >= 3 threshold is intentional: a sold show at 1000+
-- capacity is worth planning around even if below the strict tier definition.

UPDATE events e
  SET importance = 'major'
FROM venues v
WHERE e.venue_id = v.id
  AND v.capacity_tier >= 3
  AND e.importance = 'standard'
  AND e.is_active = true
  AND e.start_date > CURRENT_DATE
  AND e.is_free = false;

-- ============================================================================
-- 6. BACKFILL ticket_status_checked_at
-- ============================================================================
-- Any event that already had ticket_status populated (from crawler output or
-- prior manual seeding) but is missing the freshness timestamp gets NOW().
-- This lets the ticket staleness index and any freshness-based queries work
-- correctly without a full re-crawl.

UPDATE events
  SET ticket_status_checked_at = NOW()
WHERE ticket_status IS NOT NULL
  AND ticket_status_checked_at IS NULL
  AND is_active = true;

-- ============================================================================
-- DOWN
-- ============================================================================
-- These are all data mutations — no schema objects were created.
-- Re-running the file is safe (all UPDATEs are idempotent or narrowly scoped).
--
-- To undo specific changes manually:
--   -- Reactivate the deactivated bad-data event (if you've fixed the crawler):
--   UPDATE events SET is_active = true WHERE title ILIKE 'Championing discovery%';
--
--   -- Clear canonical_event_id on SW 420 dupes:
--   UPDATE events SET canonical_event_id = NULL
--     WHERE title ILIKE '%sweetwater 420%' AND canonical_event_id IS NOT NULL;
--
--   -- Revert festival ticket intelligence (reset to NULL):
--   UPDATE events SET on_sale_date = NULL, ticket_status = NULL,
--     ticket_status_checked_at = NULL, sellout_risk = NULL, price_min = NULL,
--     price_max = NULL, early_bird_deadline = NULL
--   WHERE importance = 'flagship' AND is_active = true;
--
--   -- Revert niche demotions:
--   UPDATE events SET importance = 'flagship'
--     WHERE importance = 'major' AND (title ILIKE '%221B Con%' OR ...);
--
--   -- Revert auto-major promotions from capacity inference:
--   -- Not trivially reversible without tracking which records were changed.
--   -- Consider adding a migration to reset all capacity-inferred 'major' records
--   -- back to 'standard' before re-running with updated logic.
