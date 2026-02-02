-- Migration: Add College Park Main Street Association source
-- Primary community event source for Historic College Park
-- Events include: JazzFest, Wine Walks, Dog Days of Summer, Holiday on the Drive, ReKindle Art Walk

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'college-park-main-street',
    'College Park Main Street Association',
    'https://www.eventbrite.com/o/college-park-main-street-association-78944267493',
    'website',
    true,
    'daily'
) ON CONFLICT (slug) DO NOTHING;
