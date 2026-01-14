-- ============================================
-- MIGRATION 007: Meetup Source
-- ============================================
-- Adds Meetup.com as an event source for Atlanta meetup events

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'meetup',
    'Meetup.com',
    'https://www.meetup.com',
    'website',
    true,
    'daily'
)
ON CONFLICT (slug) DO NOTHING;
