-- =============================================================================
-- Horizon Data P0 Fixes: category corrections + stub description cleanup
-- =============================================================================

-- ============================================================================
-- P0-4: Category corrections for misassigned flagship events
-- ============================================================================

-- Inman Park Festival: food_drink → community (neighborhood arts/parade festival)
UPDATE events
SET category_id = 'community'
WHERE title ILIKE '%inman park festival%'
  AND category_id = 'food_drink'
  AND is_active = true
  AND start_date >= CURRENT_DATE;

-- Juneteenth: food_drink → community
UPDATE events
SET category_id = 'community'
WHERE title ILIKE '%juneteenth%'
  AND category_id = 'food_drink'
  AND is_active = true
  AND start_date >= CURRENT_DATE;

-- MomoCon: workshops → conventions
UPDATE events
SET category_id = 'conventions'
WHERE title ILIKE '%momocon%'
  AND category_id = 'workshops'
  AND is_active = true
  AND start_date >= CURRENT_DATE;

-- ============================================================================
-- P0-5: Null out existing stub descriptions
-- Matches the same patterns that classify_description() catches as boilerplate.
-- Going forward, _step_set_flags nullifies these at insert time.
-- ============================================================================

-- Pattern: "[Name] is a local event"
UPDATE events
SET description = NULL
WHERE description ~* 'is a (local|community|live music|family|food|arts|sports) event'
  AND is_active = true
  AND start_date >= CURRENT_DATE;

-- Pattern: "Event at [Venue]"
UPDATE events
SET description = NULL
WHERE description ~* '^(Event at |Live music at .+ featuring|Comedy show at |Theater performance at |Film screening at |Sporting event at |Arts event at |Food & drink event at |Fitness class at |Performance at |Show at )'
  AND is_active = true
  AND start_date >= CURRENT_DATE;

-- Pattern: Eventbrite assembly strings with "Location: [venue], [City], [ST]."
UPDATE events
SET description = NULL
WHERE description ~* 'Location: .+, (Atlanta|Decatur|Marietta|Kennesaw|Roswell|Alpharetta), (GA|Georgia)\.'
  AND length(description) < 200
  AND is_active = true
  AND start_date >= CURRENT_DATE;
