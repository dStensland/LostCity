-- ============================================
-- MIGRATION 004: Phase 2 High-Volume Aggregators
-- ============================================
-- Adds event sources from Phase 2:
-- 1. Access Atlanta (AJC events)
-- 2. FanCons Georgia (conventions)
-- 3. 10times (trade shows)
-- 4. Atlanta BeltLine (outdoor events)

-- Access Atlanta (AJC)
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'access-atlanta',
    'Access Atlanta',
    'https://events.accessatlanta.com',
    'website',
    true,
    'daily'
)
ON CONFLICT (slug) DO NOTHING;

-- FanCons Georgia
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'fancons',
    'FanCons Georgia',
    'https://fancons.com/events/schedule.php?loc=usGA',
    'website',
    true,
    'weekly'
)
ON CONFLICT (slug) DO NOTHING;

-- 10times Atlanta
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    '10times',
    '10times Atlanta',
    'https://10times.com/atlanta-us/tradeshows',
    'website',
    true,
    'weekly'
)
ON CONFLICT (slug) DO NOTHING;

-- Atlanta BeltLine
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'beltline',
    'Atlanta BeltLine',
    'https://beltline.org/visit/events/',
    'website',
    true,
    'daily'
)
ON CONFLICT (slug) DO NOTHING;

-- Add BeltLine venue
INSERT INTO venues (slug, name, address, neighborhood, city, state, zip, venue_type, website)
VALUES (
    'atlanta-beltline',
    'Atlanta BeltLine',
    '112 Krog Street NE',
    'Inman Park',
    'Atlanta',
    'GA',
    '30307',
    'outdoor',
    'https://beltline.org'
)
ON CONFLICT (slug) DO NOTHING;
