-- Migration: Tentpole Importance Corrections
-- Migration 571
--
-- Corrects importance/tentpole classifications that were over-promoted:
--   - Demotes good plan-ahead events that don't meet the 30K+ city-defining bar
--   - Demotes FIFA group stage matches (keep semifinal + fan fest as flagship)
--   - Removes tentpole from conferences and very niche conventions
--   - Fixes category misclassifications on known tentpoles
--   - Deduplicates recurring tentpole entries
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- No schema changes — data-only migration.

-- =============================================================================
-- SECTION 1: Demote over-promoted flagships to major
-- Good plan-ahead events but NOT city-defining (under 30K attendees)
-- =============================================================================

-- Georgia Renaissance Festival — regional family draw, not city-defining
UPDATE events SET importance = 'major' WHERE importance = 'flagship' AND title ILIKE '%georgia renaissance%';

-- Atlanta Film Festival — important but niche (~10K)
UPDATE events SET importance = 'major' WHERE importance = 'flagship' AND title ILIKE '%atlanta film festival%';

-- Piedmont Park Arts Festival — solid but mid-tier
UPDATE events SET importance = 'major' WHERE importance = 'flagship' AND title ILIKE '%piedmont park arts%';

-- Yellow Daisy Festival — Stone Mountain tradition but suburban
UPDATE events SET importance = 'major' WHERE importance = 'flagship' AND title ILIKE '%yellow daisy%';

-- Decatur Book Festival — beloved but small
UPDATE events SET importance = 'major' WHERE importance = 'flagship' AND title ILIKE '%decatur book%';

-- Anime Weekend Atlanta — large con but niche
UPDATE events SET importance = 'major' WHERE importance = 'flagship' AND title ILIKE '%anime weekend%';

-- Grant Park Summer Shade Festival — neighborhood event
UPDATE events SET importance = 'major' WHERE importance = 'flagship' AND title ILIKE '%summer shade%';

-- Atlanta BeltLine Lantern Parade — beloved but walkable-scale
UPDATE events SET importance = 'major' WHERE importance = 'flagship' AND title ILIKE '%lantern parade%';

-- Sweet Auburn Springfest — neighborhood fest
UPDATE events SET importance = 'major' WHERE importance = 'flagship' AND title ILIKE '%sweet auburn%springfest%';

-- Virginia-Highland Summerfest — neighborhood fest
UPDATE events SET importance = 'major' WHERE importance = 'flagship' AND title ILIKE '%virginia.highland summerfest%';

-- East Atlanta Strut — neighborhood fest
UPDATE events SET importance = 'major' WHERE importance = 'flagship' AND title ILIKE '%east atlanta strut%';

-- Atlanta Caribbean Carnival — growing but not 30K+
UPDATE events SET importance = 'major' WHERE importance = 'flagship' AND title ILIKE '%caribbean carnival%';

-- Gwinnett County Fair — suburban
UPDATE events SET importance = 'major' WHERE importance = 'flagship' AND title ILIKE '%gwinnett%fair%';

-- North Georgia State Fair — suburban
UPDATE events SET importance = 'major' WHERE importance = 'flagship' AND title ILIKE '%north georgia state fair%';

-- Atlanta Christkindl Market — growing but niche
UPDATE events SET importance = 'major' WHERE importance = 'flagship' AND title ILIKE '%christkindl%';

-- BronzeLens Film Festival — niche film fest
UPDATE events SET importance = 'major' WHERE importance = 'flagship' AND title ILIKE '%bronzelens%';

-- TOUR Championship — golf, niche sports audience
UPDATE events SET importance = 'major' WHERE importance = 'flagship' AND title ILIKE '%tour championship%';

-- Atlanta Fringe Festival — arts, small
UPDATE events SET importance = 'major' WHERE importance = 'flagship' AND title ILIKE '%atlanta fringe%';

-- Atlanta Food & Wine Festival — plan-ahead but not 30K+
UPDATE events SET importance = 'major' WHERE importance = 'flagship' AND title ILIKE '%atlanta food%wine%';

-- Taste of Atlanta — plan-ahead but not 30K+
UPDATE events SET importance = 'major' WHERE importance = 'flagship' AND title ILIKE '%taste of atlanta%';


-- =============================================================================
-- SECTION 2: Demote FIFA World Cup group stage to major
-- Keep semifinal + fan fest as flagship — only individually city-defining matches
-- =============================================================================

UPDATE events SET importance = 'major'
WHERE importance = 'flagship'
  AND title ILIKE '%fifa world cup%'
  AND title NOT ILIKE '%semifinal%'
  AND title NOT ILIKE '%fan festival%'
  AND title NOT ILIKE '%fan fest%';


-- =============================================================================
-- SECTION 3: Remove tentpole status from conferences and very niche events
-- =============================================================================

-- Conferences are not tentpole public events
UPDATE events SET is_tentpole = false, importance = 'standard'
WHERE is_tentpole = true AND title ILIKE '%red hat summit%';

UPDATE events SET is_tentpole = false, importance = 'standard'
WHERE is_tentpole = true AND title ILIKE '%invest fest%';

UPDATE events SET is_tentpole = false, importance = 'standard'
WHERE is_tentpole = true AND title ILIKE '%atlanta tech week%';

-- Niche conventions that don't define the city calendar
UPDATE events SET is_tentpole = false, importance = 'standard'
WHERE is_tentpole = true AND title ILIKE '%jordancon%';

UPDATE events SET is_tentpole = false, importance = 'standard'
WHERE is_tentpole = true AND title ILIKE '%vampire diaries%';

UPDATE events SET is_tentpole = false, importance = 'standard'
WHERE is_tentpole = true AND title ILIKE '%furry weekend%';

-- ESFNA — niche community sports festival
UPDATE events SET is_tentpole = false, importance = 'standard'
WHERE is_tentpole = true AND title ILIKE '%esfna%';

-- Southern-Fried Gaming Expo — niche
UPDATE events SET is_tentpole = false, importance = 'standard'
WHERE is_tentpole = true AND title ILIKE '%southern.fried gaming%';

-- Atlanta Underground Film Festival — very niche
UPDATE events SET is_tentpole = false, importance = 'standard'
WHERE is_tentpole = true AND title ILIKE '%underground film%';

-- Atlanta Magazine Whiskey Festival — small ticketed event
UPDATE events SET is_tentpole = false, importance = 'standard'
WHERE is_tentpole = true AND title ILIKE '%whiskey festival%';

-- Decatur Beach Party — neighborhood event
UPDATE events SET is_tentpole = false, importance = 'standard'
WHERE is_tentpole = true AND title ILIKE '%decatur beach%';

-- Atlanta Greek Picnic — niche cultural
UPDATE events SET is_tentpole = false, importance = 'standard'
WHERE is_tentpole = true AND title ILIKE '%atlanta greek picnic%';

-- Atlanta Ice Cream Festival — fun but small
UPDATE events SET is_tentpole = false, importance = 'standard'
WHERE is_tentpole = true AND title ILIKE '%ice cream festival%';


-- =============================================================================
-- SECTION 4: Fix category misclassifications on tentpoles
-- =============================================================================

-- SweetWater 420 Fest with unknown category → music
UPDATE events SET category_id = 'music'
WHERE title ILIKE '%sweetwater 420%' AND category_id = 'unknown';

-- NASCAR at Atlanta Motor Speedway: exercise → sports
UPDATE events SET category_id = 'sports'
WHERE title ILIKE '%nascar%atlanta%' AND category_id = 'exercise';

-- TOUR Championship: exercise → sports
UPDATE events SET category_id = 'sports'
WHERE title ILIKE '%tour championship%' AND category_id = 'exercise';

-- Juneteenth Parade & Music Festival: learning → community
UPDATE events SET category_id = 'community'
WHERE title ILIKE '%juneteenth%' AND category_id = 'learning';

-- Geranium Festival: learning → community
UPDATE events SET category_id = 'community'
WHERE title ILIKE '%geranium festival%' AND category_id = 'learning';

-- Atlanta Christkindl Market: outdoors → community
UPDATE events SET category_id = 'community'
WHERE title ILIKE '%christkindl%' AND category_id = 'outdoors';

-- Chomp & Stomp: outdoors → food_drink
UPDATE events SET category_id = 'food_drink'
WHERE title ILIKE '%chomp%stomp%' AND category_id = 'outdoors';


-- =============================================================================
-- SECTION 5: Dedup — deactivate duplicate tentpole entries
-- Keep the one with the lowest ID per month/date window
-- =============================================================================

-- Deactivate duplicate Atlanta Streets Alive entries (keep lowest ID per month)
UPDATE events SET is_active = false
WHERE title ILIKE '%atlanta streets alive%'
  AND is_tentpole = true
  AND id NOT IN (
    SELECT MIN(id) FROM events
    WHERE title ILIKE '%atlanta streets alive%' AND is_tentpole = true AND is_active = true
    GROUP BY DATE_TRUNC('month', start_date)
  );

-- Deactivate duplicate 404 Day entries (keep lowest ID per date)
UPDATE events SET is_active = false
WHERE title ILIKE '%404 day%'
  AND is_tentpole = true
  AND id NOT IN (
    SELECT MIN(id) FROM events
    WHERE title ILIKE '%404 day%' AND is_tentpole = true AND is_active = true
    GROUP BY start_date
  );
