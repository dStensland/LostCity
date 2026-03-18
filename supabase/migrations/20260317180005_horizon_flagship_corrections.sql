-- Horizon flagship corrections: promote under-elevated tentpoles,
-- demote non-consumer events that don't belong in the planning horizon.

-- ============================================================================
-- PROMOTE TO FLAGSHIP: major Atlanta events that should be city-defining
-- ============================================================================

-- Dragon Con — largest multi-media convention in the US, 80k+ attendees
UPDATE events
SET importance = 'flagship'
WHERE importance IN ('standard', 'major')
  AND is_active = true
  AND title ILIKE '%dragon con%'
  AND start_date >= CURRENT_DATE;

-- Music Midtown — major Atlanta music festival
UPDATE events
SET importance = 'flagship'
WHERE importance IN ('standard', 'major')
  AND is_active = true
  AND title ILIKE '%music midtown%'
  AND start_date >= CURRENT_DATE;

-- Taste of Atlanta — major food festival, 25th anniversary year
UPDATE events
SET importance = 'flagship'
WHERE importance IN ('standard', 'major')
  AND is_active = true
  AND title ILIKE '%taste of atlanta%'
  AND start_date >= CURRENT_DATE;

-- Candler Park Fall Fest — big neighborhood festival
UPDATE events
SET importance = 'flagship'
WHERE importance IN ('standard', 'major')
  AND is_active = true
  AND title ILIKE '%candler park fall fest%'
  AND start_date >= CURRENT_DATE;

-- Atlanta BeltLine Lantern Parade — iconic community event
UPDATE events
SET importance = 'flagship'
WHERE importance IN ('standard', 'major')
  AND is_active = true
  AND (title ILIKE '%lantern parade%' AND title ILIKE '%beltline%')
  AND start_date >= CURRENT_DATE;

-- ============================================================================
-- DEMOTE FROM FLAGSHIP: non-consumer events that don't warrant planning horizon
-- ============================================================================

-- Red Hat Summit — tech industry conference, not consumer event
UPDATE events
SET importance = 'standard'
WHERE importance = 'flagship'
  AND is_active = true
  AND title ILIKE '%red hat summit%';

-- Invest Fest — business/finance conference
UPDATE events
SET importance = 'standard'
WHERE importance = 'flagship'
  AND is_active = true
  AND title ILIKE '%invest fest%';

-- Geranium Festival — very small local event
UPDATE events
SET importance = 'major'
WHERE importance = 'flagship'
  AND is_active = true
  AND title ILIKE '%geranium festival%';

-- Georgia Celebrates Quilts — niche craft event
UPDATE events
SET importance = 'major'
WHERE importance = 'flagship'
  AND is_active = true
  AND title ILIKE '%georgia celebrates quilts%';

-- Conyers Kennel Club Dog Show — niche
UPDATE events
SET importance = 'major'
WHERE importance = 'flagship'
  AND is_active = true
  AND title ILIKE '%conyers kennel club%';

-- Atlanta Tech Week — industry event, not consumer
UPDATE events
SET importance = 'standard'
WHERE importance = 'flagship'
  AND is_active = true
  AND title ILIKE '%atlanta tech week%';
