-- Source registration for EntryThingy open calls aggregator.
-- EntryThingy aggregates ~1,370 active calls from CaFE, Zapplication,
-- ArtCall, ShowSubmit, and independent galleries. This is the largest
-- single open-calls source in the pipeline.
--
-- crawl_frequency: weekly (calls update frequently as deadlines roll over)
-- owner_portal_id: arts-atlanta portal

INSERT INTO sources (
    name,
    slug,
    source_type,
    url,
    is_active,
    crawl_frequency,
    owner_portal_id
)
VALUES (
    'EntryThingy (Open Calls)',
    'open-calls-entrythingy',
    'scrape',
    'https://app.entrythingy.com/calls_list/',
    true,
    'weekly',
    (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
    is_active     = true,
    url           = EXCLUDED.url,
    crawl_frequency = EXCLUDED.crawl_frequency;
