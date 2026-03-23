-- Deactivate IRC Atlanta and New Georgia Project individual crawlers.
--
-- Investigation (2026-03-22): Neither org was found on Mobilize.us after scanning
-- all 14,501 orgs in the public API. The existing crawlers use generic CSS selectors
-- that don't match real HTML and have never produced events.
--
-- IRC Atlanta: Does not use Mobilize.us. Their public events use irc.donordrive.com
-- (fundraising platform), not a civic-event aggregator we can easily ingest.
-- Recommend manual investigation to identify their actual event calendar.
--
-- New Georgia Project: Their website links to mobilize.us/ngp but that slug does not
-- exist in the Mobilize API org list (404 on /v1/organizations/ngp/events). Possible
-- the org was removed or the URL is stale. Recommend manual re-check of ngp website.
--
-- Both are deactivated here rather than left as false-positive active crawlers.
-- Reactivate when a working data source is identified.

UPDATE sources SET
  is_active = false,
  health_tags = array_append(COALESCE(health_tags, '{}'), 'deactivated:no_working_event_source')
WHERE slug IN ('irc-atlanta', 'new-georgia-project')
  AND is_active = true;

-- Deactivate any future events from these sources that may have been inserted
UPDATE events SET is_active = false
WHERE source_id IN (
  SELECT id FROM sources WHERE slug IN ('irc-atlanta', 'new-georgia-project')
)
  AND start_date >= CURRENT_DATE
  AND is_active = true;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
