-- Migration 020: Add 33 new sources - Colleges, Venues, Bookstores, Organizations
-- Created: 2026-01-20

-- Colleges & Universities (12)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES
    ('Georgia Tech Athletics', 'georgia-tech-athletics', 'https://ramblinwreck.com', 'scrape', 'daily', true),
    ('Georgia Tech Events', 'georgia-tech-events', 'https://calendar.gatech.edu', 'scrape', 'daily', true),
    ('Emory Events', 'emory-events', 'https://emory.edu/events', 'scrape', 'daily', true),
    ('Georgia State Athletics', 'gsu-athletics', 'https://georgiastatesports.com', 'scrape', 'daily', true),
    ('Spelman College', 'spelman-college', 'https://www.spelman.edu/events', 'scrape', 'weekly', true),
    ('Morehouse College', 'morehouse-college', 'https://www.morehouse.edu/events', 'scrape', 'weekly', true),
    ('Clark Atlanta University', 'clark-atlanta', 'https://www.cau.edu/events', 'scrape', 'weekly', true),
    ('Kennesaw State University', 'kennesaw-state', 'https://arts.kennesaw.edu', 'scrape', 'weekly', true),
    ('SCAD Atlanta', 'scad-atlanta', 'https://www.scad.edu/atlanta', 'scrape', 'weekly', true),
    ('Agnes Scott College', 'agnes-scott', 'https://www.agnesscott.edu/events', 'scrape', 'weekly', true),
    ('Spivey Hall', 'spivey-hall', 'https://www.spiveyhall.org', 'scrape', 'weekly', true),
    ('Oglethorpe University', 'oglethorpe-university', 'https://oglethorpe.edu/events', 'scrape', 'weekly', true)
ON CONFLICT (slug) DO NOTHING;

-- New Venues (8)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES
    ('Knock Music House', 'knock-music-house', 'https://www.knockmusichouse.com', 'scrape', 'daily', true),
    ('Side Saddle', 'side-saddle', 'https://www.sidesaddleatl.com', 'scrape', 'weekly', true),
    ('Woofs Atlanta', 'woofs-atlanta', 'https://www.woofsatlanta.com', 'scrape', 'weekly', true),
    ('Sports Social', 'sports-social', 'https://www.sportssocial.com', 'scrape', 'daily', true),
    ('Park Tavern', 'park-tavern', 'https://www.parktavern.com', 'scrape', 'weekly', true),
    ('Midway Pub', 'midway-pub', 'https://www.midwaypub.com', 'scrape', 'weekly', true),
    ('Spaceman Rooftop', 'spaceman-rooftop', 'https://www.spacemanrooftop.com', 'scrape', 'weekly', true),
    ('Rowdy Tiger', 'rowdy-tiger', 'https://www.rowdytigeratl.com', 'scrape', 'weekly', true)
ON CONFLICT (slug) DO NOTHING;

-- Bookstores (3)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES
    ('Bookish Atlanta', 'bookish-atlanta', 'https://www.bookishatlanta.com', 'scrape', 'weekly', true),
    ('Wild Aster Books', 'wild-aster-books', 'https://www.wildasterbooks.com', 'scrape', 'weekly', true),
    ('The Book Boutique', 'book-boutique', 'https://www.thebookboutiqueatl.com', 'scrape', 'weekly', true)
ON CONFLICT (slug) DO NOTHING;

-- Organizations (3)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES
    ('ArtsATL', 'arts-atl', 'https://www.artsatl.org', 'scrape', 'daily', true),
    ('Atlanta Cultural Affairs', 'atlanta-cultural-affairs', 'https://www.atlantaga.gov/government/mayor-s-office/executive-offices/office-of-cultural-affairs', 'scrape', 'weekly', true),
    ('Community Foundation Atlanta', 'community-foundation-atl', 'https://www.cfgreateratlanta.org', 'scrape', 'weekly', true)
ON CONFLICT (slug) DO NOTHING;

-- Tier 2 Sports Bars & Venues (7)
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES
    ('Fado Irish Pub', 'fado-irish-pub', 'https://www.fadoirishpub.com/atlanta', 'scrape', 'weekly', true),
    ('Stats Brewpub', 'stats-downtown', 'https://www.statsatl.com', 'scrape', 'weekly', true),
    ('Meehan''s Public House', 'meehans-pub', 'https://www.meehanspublichouse.com', 'scrape', 'weekly', true),
    ('Urban Grind', 'urban-grind', 'https://www.urbangrindcoffee.com', 'scrape', 'weekly', true),
    ('Kat''s Cafe', 'kats-cafe', 'https://www.katscafe.com', 'scrape', 'weekly', true),
    ('Gypsy Kitchen', 'gypsy-kitchen', 'https://www.gypsykitchen.com', 'scrape', 'weekly', true),
    ('The Sun Dial Restaurant', 'sun-dial-restaurant', 'https://www.sundialrestaurant.com', 'scrape', 'weekly', true)
ON CONFLICT (slug) DO NOTHING;

-- Summary: 33 new sources added
-- Colleges & Universities: 12
-- New Venues: 8
-- Bookstores: 3
-- Organizations: 3
-- Tier 2 Sports Bars & Venues: 7
