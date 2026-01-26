-- Migration 065: Add Le Colonial Atlanta restaurant
-- Created: 2026-01-26
-- Upscale French-Vietnamese restaurant in Buckhead with special events calendar

INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES
    ('Le Colonial Atlanta', 'le-colonial-atlanta', 'https://www.lecolonial.com/atlanta/happenings/', 'scrape', 'weekly', true)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    source_type = EXCLUDED.source_type,
    crawl_frequency = EXCLUDED.crawl_frequency,
    is_active = EXCLUDED.is_active;

-- Le Colonial Atlanta Notes:
-- - Upscale French-Vietnamese restaurant in Buckhead at 3060 Peachtree Rd NW
-- - Hosts special holiday events and seasonal dining experiences
-- - Events include: Valentine's Day prix fixe dinners, Lunar New Year celebrations, Dragon Dances
-- - Uses WordPress with simple section-based event layout
-- - Events are typically reservation-based dining experiences
-- - Categories: food, special_dining
-- - Tags: restaurant, buckhead, french-vietnamese, fine-dining, special-event, holiday
-- - Reservation links to OpenTable for event bookings
