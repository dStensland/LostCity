-- Migration 172: Pre-crawl cleanup
-- 1. Disable sources for permanently closed venues
-- 2. Merge 6 duplicate venue pairs (reassign events, soft-delete dupes)
-- 3. Disable 50+ zero-event bar/restaurant/venue sources (no event calendars)

BEGIN;

-- ============================================================
-- 1. CLOSED VENUE SOURCES — disable
-- ============================================================
-- These venues were deactivated in migration 168 but their sources
-- remained active, wasting crawl cycles.

UPDATE sources SET is_active = false WHERE id IN (
  525,  -- bookhouse-pub (permanently closed Dec 2024)
  115,  -- orpheus-brewing (permanently closed)
  536   -- torched-hop (permanently closed Dec 2024)
);

-- ============================================================
-- 2. DUPLICATE VENUE MERGES
-- ============================================================
-- For each pair: reassign events from dupe → canonical, then deactivate dupe.
-- Keep the record with more events as canonical.

-- Atlanta Botanical Garden: keep 100 (36 events), merge 373 (0 events, -test slug)
UPDATE events SET venue_id = 100 WHERE venue_id = 373;
UPDATE venue_specials SET venue_id = 100 WHERE venue_id = 373;
DELETE FROM venues WHERE id = 373;

-- AmericasMart: keep 186 (3 events), merge 228 (0 events)
UPDATE events SET venue_id = 186 WHERE venue_id = 228;
UPDATE venue_specials SET venue_id = 186 WHERE venue_id = 228;
DELETE FROM venues WHERE id = 228;

-- MODA: keep 1105 (26 events, slug=moda), merge 7 (0 events)
UPDATE events SET venue_id = 1105 WHERE venue_id = 7;
UPDATE venue_specials SET venue_id = 1105 WHERE venue_id = 7;
DELETE FROM venues WHERE id = 7;

-- Piedmont Park: keep 305 (76 events), merge 368 (0 events, -test slug)
UPDATE events SET venue_id = 305 WHERE venue_id = 368;
UPDATE venue_specials SET venue_id = 305 WHERE venue_id = 368;
DELETE FROM venues WHERE id = 368;

-- Renaissance Midtown: keep 180 (1 event), merge 819 (0 events)
UPDATE events SET venue_id = 180 WHERE venue_id = 819;
UPDATE venue_specials SET venue_id = 180 WHERE venue_id = 819;
DELETE FROM venues WHERE id = 819;

-- Breman Museum: keep 892 (5 events, newer data), merge 41 (0 events)
UPDATE events SET venue_id = 892 WHERE venue_id = 41;
UPDATE venue_specials SET venue_id = 892 WHERE venue_id = 41;
DELETE FROM venues WHERE id = 41;

-- ============================================================
-- 3. DISABLE ZERO-EVENT BAR/RESTAURANT/VENUE SOURCES
-- ============================================================
-- These are all bars, restaurants, nightclubs, breweries, and other
-- venues that have NEVER produced events from their crawlers (0 lifetime).
-- They're valuable as venue/spot records but have no event calendars
-- to crawl. Disabling saves crawl cycles and reduces noise.
--
-- NOT disabled: Festival sources (seasonal), broken-but-fixable sources.

UPDATE sources SET is_active = false WHERE id IN (
  -- Bars (no event calendars)
  539,  -- argosy
  521,  -- atkins-park
  409,  -- brake-pad
  167,  -- brewhouse-cafe
  516,  -- church-bar
  519,  -- dark-horse-tavern
  513,  -- elmyr
  283,  -- fado-irish-pub
  515,  -- flatiron
  288,  -- gypsy-kitchen
  534,  -- havana-club
  522,  -- highland-tap
  142,  -- joystick-gamebar
  524,  -- ladybird-grove
  538,  -- manuels-tavern
  285,  -- meehans-pub
  274,  -- midway-pub
  520,  -- moes-and-joes
  517,  -- mother-bar
  518,  -- nonis
  530,  -- ormsbys
  276,  -- rowdy-tiger
  533,  -- sidebar
  523,  -- sister-louisas
  199,  -- sound-table
  514,  -- the-glenwood
  177,  -- painted-duck
  453,  -- the-porter
  528,  -- the-square-pub
  512,  -- the-vortex
  529,  -- twains-brewpub
  527,  -- victory-sandwich-bar
  165,  -- wax-n-facts
  149,  -- church-atlanta (The Church nightclub)

  -- Restaurants (no event calendars)
  532,  -- der-biergarten
  141,  -- lips-atlanta
  286,  -- urban-grind

  -- Nightclubs (0 events found despite crawling)
  73,   -- opera-nightclub
  147,  -- domaine-atlanta
  135,  -- the-heretic

  -- Breweries (no event calendars)
  117,  -- pontoon-brewing
  408,  -- schoolhouse-brewing
  57,   -- second-self-brewing
  440,  -- variant-brewing
  228,  -- monday-night-run-club

  -- Other venues without event calendars
  136,  -- my-sisters-room
  279,  -- book-boutique
  194,  -- atlutd-pubs (organization, no events)

  -- Broken crawlers (timeout/error, 0 events ever)
  175,  -- publix-aprons (site timeout)
  269,  -- knock-music-house (0 events 30 days)
  265   -- scad-atlanta (0 events 30 days)
);

COMMIT;

-- DOWN (restore sources, recreate duped venues would require full data backup)
-- UPDATE sources SET is_active = true WHERE id IN (525, 115, 536);
-- UPDATE sources SET is_active = true WHERE id IN (539, 521, 409, 167, 516, 519, 513, 283, 515, 288, 534, 522, 142, 524, 538, 285, 274, 520, 517, 518, 530, 276, 533, 523, 199, 514, 177, 453, 528, 512, 529, 527, 165, 149, 532, 141, 286, 73, 147, 135, 117, 408, 57, 440, 228, 136, 279, 194, 175, 269, 265);
