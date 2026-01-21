-- ============================================
-- MIGRATION 021: Add Additional Piedmont Healthcare Sources
-- Adds crawlers for CME, Heart Conferences, Women's Heart,
-- Luminaria, Transplant, Athens, and piedmonthealthcare.com
-- ============================================

-- Piedmont CME Portal
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES (
    'Piedmont CME/CE Portal',
    'piedmont-cme',
    'https://piedmont.cloud-cme.com',
    'scrape',
    'weekly',
    true
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    is_active = true;

-- Piedmont Heart Conferences
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES (
    'Piedmont Heart Conferences',
    'piedmont-heart-conferences',
    'https://www.piedmont.org/heart/healthcare-professionals/conferences',
    'scrape',
    'weekly',
    true
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    is_active = true;

-- Piedmont Women's Heart Support Network
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES (
    'Piedmont Women''s Heart Support',
    'piedmont-womens-heart',
    'https://www.piedmont.org/heart/services-and-programs/womens-heart/dottie-fuqua-womens-heart-support-network',
    'scrape',
    'weekly',
    true
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    is_active = true;

-- Piedmont Luminaria (oncology gala)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES (
    'Piedmont Luminaria',
    'piedmont-luminaria',
    'https://www.piedmontluminaria.org',
    'scrape',
    'monthly',
    true
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    is_active = true;

-- Piedmont Transplant Institute Support Groups
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES (
    'Piedmont Transplant Support',
    'piedmont-transplant',
    'https://www.piedmont.org/transplant/services-treatments/support-group',
    'scrape',
    'weekly',
    true
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    is_active = true;

-- Piedmont Athens Spiritual Care
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES (
    'Piedmont Athens Spiritual Care',
    'piedmont-athens',
    'https://www.piedmont.org/locations/piedmont-athens/piedmont-athens-chapel-and-healing-places',
    'scrape',
    'weekly',
    true
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    is_active = true;

-- Piedmont HealthCare Events (piedmonthealthcare.com - different org)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES (
    'Piedmont HealthCare Events',
    'piedmonthealthcare-events',
    'https://www.piedmonthealthcare.com/events/',
    'scrape',
    'daily',
    true
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    is_active = true;

-- Piedmont Auxiliary (ensure it exists)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES (
    'Piedmont Atlanta Hospital Auxiliary',
    'piedmont-auxiliary',
    'https://www.pahauxiliary.org/calendar',
    'scrape',
    'weekly',
    true
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    is_active = true;

-- Piedmont Foundation (ensure it exists)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES (
    'Piedmont Foundation Events',
    'piedmont-foundation',
    'https://www.piedmont.org/about-piedmont-healthcare/foundation-and-giving/overview/special-events',
    'scrape',
    'weekly',
    true
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    is_active = true;

-- Piedmont Cancer Support (ensure it exists)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES (
    'Piedmont Cancer Institute Support',
    'piedmont-cancer-support',
    'https://www.piedmontcancerinstitute.com/support-groups.php',
    'scrape',
    'weekly',
    true
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    is_active = true;

-- Piedmont Classes (ensure it exists)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES (
    'Piedmont Classes',
    'piedmont-classes',
    'https://classes.inquicker.com/?ClientID=12422',
    'scrape',
    'daily',
    true
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    is_active = true;

-- Piedmont Fitness (ensure it exists)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES (
    'Piedmont Fitness Centers',
    'piedmont-fitness',
    'https://www.piedmont.org/locations/fitness-centers',
    'scrape',
    'weekly',
    true
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    is_active = true;
