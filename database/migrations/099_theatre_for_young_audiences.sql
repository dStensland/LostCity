-- Migration: Add Theatre for Young Audiences source
-- Alliance Theatre's dedicated children's and family programming
-- Includes: Theatre for Young Audiences (Goizueta Stage),
--           Bernhardt Theatre for the Very Young,
--           The Underground Rep (teen programming)

INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'theatre-for-young-audiences',
    'Theatre for Young Audiences (Alliance Theatre)',
    'https://www.alliancetheatre.org/family-programming/',
    'website',
    true,
    'weekly'
) ON CONFLICT (slug) DO NOTHING;
