-- Deactivate 11 HelpATL sources that have no crawlable event calendar.
-- These are pointed at info pages, dead URLs, or redundant with other sources.
-- Triage performed 2026-03-22: each source was verified manually.

-- Sources pointed at volunteer info pages (not event calendars)
UPDATE sources SET is_active = false,
  health_tags = array_append(COALESCE(health_tags, '{}'), 'deactivated:no_calendar')
WHERE slug IN (
  'keep-atlanta-beautiful',       -- Static recycling directory, no events on site
  'atlanta-casa',                 -- Tribe Events returns 404, no calendar mechanism found
  'atlanta-victim-assistance',    -- /get-involved/ is a signup page, not a calendar
  'our-house',                    -- /volunteer/ is a general info page, no dates
  'dekalb-medical-reserve-corps', -- Page has operational alerts, not volunteer events
  'canopy-atlanta',               -- Journalism nonprofit, documenters page has no calendar
  'pad-atlanta'                   -- /volunteer/ is an info page, not an events calendar
) AND is_active = true;

-- Sources with dead URLs, redundant with georgia-elections-calendar
UPDATE sources SET is_active = false,
  health_tags = array_append(COALESCE(health_tags, '{}'), 'deactivated:dead_url_redundant')
WHERE slug IN (
  'cobb-county-elections',        -- 404, redundant with georgia-elections-calendar
  'fulton-county-elections',      -- 404, redundant with georgia-elections-calendar
  'gwinnett-county-elections'     -- 404, redundant with georgia-elections-calendar
) AND is_active = true;

-- Red Cross volunteer recruitment page (no calendar)
UPDATE sources SET is_active = false,
  health_tags = array_append(COALESCE(health_tags, '{}'), 'deactivated:no_calendar')
WHERE slug = 'red-cross-georgia' AND is_active = true;

-- Deactivate future events from these sources so they don't appear in feeds
UPDATE events SET is_active = false
WHERE source_id IN (
  SELECT id FROM sources WHERE slug IN (
    'keep-atlanta-beautiful',
    'atlanta-casa',
    'atlanta-victim-assistance',
    'our-house',
    'dekalb-medical-reserve-corps',
    'canopy-atlanta',
    'pad-atlanta',
    'cobb-county-elections',
    'fulton-county-elections',
    'gwinnett-county-elections',
    'red-cross-georgia'
  )
) AND start_date >= CURRENT_DATE AND is_active = true;
