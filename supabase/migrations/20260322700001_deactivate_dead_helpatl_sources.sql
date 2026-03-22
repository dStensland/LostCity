-- Deactivate HelpATL sources that will never produce events in their current form.
-- These are either pointed at wrong URLs, use generic selectors that don't match,
-- or the org simply doesn't have a public events calendar.
-- Pattern: matches 20260322400000 (health_tags + event deactivation + materialized view refresh).

-- Sources with no crawlable event calendar
-- Both slug variants included for padv and avlf since the DB slug may be
-- the long form (partnership-against-domestic-violence, atlanta-volunteer-lawyers-foundation)
-- while the crawler file is the short form (padv.py, avlf.py).
UPDATE sources SET is_active = false,
  health_tags = array_append(COALESCE(health_tags, '{}'), 'deactivated:no_calendar')
WHERE slug IN (
  'atlanta-boards-commissions',              -- Superseded by IQM2 crawler, never produced events
  'fair-fight',                              -- Volunteer signup page, not an events calendar
  'padv',                                    -- No public events calendar
  'partnership-against-domestic-violence',   -- Alternate slug for padv
  'avlf',                                    -- Volunteer signup, not events
  'atlanta-volunteer-lawyers-foundation',    -- Alternate slug for avlf
  'everybody-wins-atlanta',                  -- Genuinely sparse calendar, 0 events ever
  'atlanta-mission',                         -- Site structure changed, 0 future events
  'new-american-pathways'                    -- Volunteer signup page, not an events calendar
) AND is_active = true;

-- Deactivate future events from these sources so they don't appear in feeds
UPDATE events SET is_active = false
WHERE source_id IN (
  SELECT id FROM sources WHERE slug IN (
    'atlanta-boards-commissions',
    'fair-fight',
    'padv',
    'partnership-against-domestic-violence',
    'avlf',
    'atlanta-volunteer-lawyers-foundation',
    'everybody-wins-atlanta',
    'atlanta-mission',
    'new-american-pathways'
  )
) AND start_date >= CURRENT_DATE AND is_active = true;

-- Refresh so deactivated sources drop from portal access
REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
