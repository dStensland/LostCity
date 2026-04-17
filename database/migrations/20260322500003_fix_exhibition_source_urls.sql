-- ============================================================
-- MIGRATION: Fix exhibition source URLs discovered during recon
-- ============================================================
-- Several source URLs were incorrect when registered. Updating to
-- the actual crawlable URLs discovered during site recon.

-- Ernest Welch Gallery GSU: art.gsu.edu/gallery/ doesn't exist
-- Actual calendar with JSON-LD data: calendar.gsu.edu/welch-galleries
UPDATE sources SET url = 'https://calendar.gsu.edu/welch-galleries'
WHERE slug = 'ernest-welch-gallery-gsu';

-- Echo Contemporary: echocontemporary.com → www.echocontemporary.com
UPDATE sources SET url = 'https://www.echocontemporary.com/events'
WHERE slug = 'echo-contemporary';

-- Hathaway Contemporary: hathawaygallery.com → www.hathawaycontemporary.com
UPDATE sources SET url = 'https://www.hathawaycontemporary.com/exhibitions1'
WHERE slug = 'hathaway-contemporary';

-- Day & Night Projects: daynightprojects.art → www.daynightprojects.art/current-projects
UPDATE sources SET url = 'https://www.daynightprojects.art/current-projects'
WHERE slug = 'day-night-projects';

-- Windmill Arts: windmillarts.org → www.windmillarts.org/events
UPDATE sources SET url = 'https://www.windmillarts.org/events'
WHERE slug = 'windmill-arts';

-- Chastain Arts Center: ocaatlanta.com/chastain-arts-center → OCA MEC API
UPDATE sources SET url = 'https://ocaatlanta.com/wp-json/wp/v2/mec-events'
WHERE slug = 'chastain-arts-center';

-- Emory Visual Arts Gallery: arts.emory.edu → filmandmedia.emory.edu
UPDATE sources SET url = 'https://filmandmedia.emory.edu/news/vizartsgallery.html'
WHERE slug = 'emory-visual-arts-gallery';

-- Tew Galleries: fix to www subdomain
UPDATE sources SET url = 'https://tewgalleries.com'
WHERE slug = 'tew-galleries';
