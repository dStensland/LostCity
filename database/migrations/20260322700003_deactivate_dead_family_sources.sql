-- Deactivate dead family sources.
-- barnes-noble-atlanta: superseded by barnes-noble-events (different API endpoint)
-- lego-discovery-center: Playwright scraper never matched site structure; legoland-atlanta works
-- sealife-georgia: no Georgia location exists
-- Uses health_tags pattern (no deactivation_reason column on sources).

UPDATE sources
SET is_active = false,
    health_tags = array_append(COALESCE(health_tags, '{}'), 'deactivated:superseded_by_barnes_noble_events')
WHERE slug = 'barnes-noble-atlanta';

UPDATE sources
SET is_active = false,
    health_tags = array_append(COALESCE(health_tags, '{}'), 'deactivated:replaced_by_legoland_atlanta')
WHERE slug = 'lego-discovery-center';

UPDATE sources
SET is_active = false,
    health_tags = array_append(COALESCE(health_tags, '{}'), 'deactivated:no_georgia_location')
WHERE slug = 'sealife-georgia';
