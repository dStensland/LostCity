-- Flagship corrections round 2: promote under-elevated city-defining events,
-- demote over-elevated niche/suburban events.

-- ============================================================================
-- PROMOTE TO FLAGSHIP: city-defining events stuck at standard
-- ============================================================================

-- Juneteenth Atlanta Parade & Music Festival — major citywide cultural celebration
UPDATE events
SET importance = 'flagship'
WHERE importance IN ('standard', 'major')
  AND is_active = true
  AND title ILIKE '%juneteenth atlanta parade%'
  AND start_date >= CURRENT_DATE;

-- Atlanta Science Festival Exploration Expo — free expo in Piedmont Park, 50k+ visitors
UPDATE events
SET importance = 'flagship'
WHERE importance IN ('standard', 'major')
  AND is_active = true
  AND title ILIKE '%atlanta science festival%'
  AND title ILIKE '%expo%'
  AND start_date >= CURRENT_DATE;

-- Atlanta Greek Festival — 100k+ visitors, longest-running cultural festival in Atlanta
UPDATE events
SET importance = 'flagship'
WHERE importance IN ('standard', 'major')
  AND is_active = true
  AND title ILIKE '%atlanta greek festival%'
  AND start_date >= CURRENT_DATE;

-- Garden Lights, Holiday Nights — Atlanta Botanical Garden signature holiday event, 200k+ visitors
UPDATE events
SET importance = 'flagship'
WHERE importance IN ('standard', 'major')
  AND is_active = true
  AND title ILIKE '%garden lights%holiday%'
  AND start_date >= CURRENT_DATE;

-- Stone Mountain Christmas — massive holiday attraction
UPDATE events
SET importance = 'flagship'
WHERE importance IN ('standard', 'major')
  AND is_active = true
  AND title ILIKE '%stone mountain christmas%'
  AND start_date >= CURRENT_DATE;

-- Georgia Renaissance Festival — runs 8 weekends, huge attendance, 200k+
UPDATE events
SET importance = 'flagship'
WHERE importance IN ('standard', 'major')
  AND is_active = true
  AND title ILIKE '%georgia renaissance festival%'
  AND start_date >= CURRENT_DATE;

-- Virginia-Highland Summerfest — major neighborhood festival
UPDATE events
SET importance = 'flagship'
WHERE importance IN ('standard', 'major')
  AND is_active = true
  AND title ILIKE '%virginia%highland%summerfest%'
  AND start_date >= CURRENT_DATE;

-- ============================================================================
-- DEMOTE FROM FLAGSHIP: niche/suburban events that don't warrant flagship
-- ============================================================================

-- Frolicon — niche adult sci-fi/fantasy convention, ~3k attendees
UPDATE events
SET importance = 'major'
WHERE importance = 'flagship'
  AND is_active = true
  AND title ILIKE '%frolicon%';

-- Taste of Alpharetta — suburban food festival, not city-defining
UPDATE events
SET importance = 'major'
WHERE importance = 'flagship'
  AND is_active = true
  AND title ILIKE '%taste of alpharetta%';

-- Lilburn Daze — small suburban festival
UPDATE events
SET importance = 'major'
WHERE importance = 'flagship'
  AND is_active = true
  AND title ILIKE '%lilburn daze%';

-- Canton Riverfest — small-town festival
UPDATE events
SET importance = 'major'
WHERE importance = 'flagship'
  AND is_active = true
  AND title ILIKE '%canton riverfest%';

-- Smoke on the Lake BBQ Festival — regional BBQ competition
UPDATE events
SET importance = 'major'
WHERE importance = 'flagship'
  AND is_active = true
  AND title ILIKE '%smoke on the lake%';

-- Atlanta Shortsfest — niche film shorts festival
UPDATE events
SET importance = 'major'
WHERE importance = 'flagship'
  AND is_active = true
  AND title ILIKE '%shortsfest%';

-- Atlanta Horror Film Festival — niche horror film fest
UPDATE events
SET importance = 'major'
WHERE importance = 'flagship'
  AND is_active = true
  AND title ILIKE '%horror film festival%';
