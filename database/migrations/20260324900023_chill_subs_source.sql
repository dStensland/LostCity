-- Add Chill Subs as a literary magazine submission source for the Arts portal.
--
-- Chill Subs (chillsubs.com) aggregates 3,000–4,000+ literary magazines with
-- rich submission data: reading periods, acceptance rates, payment info, genres.
-- It complements The Submission Grinder (our other literary market source) with
-- different coverage and a modern, well-maintained dataset used by 69,000+ writers.
--
-- Owner portal: arts-atlanta (Arts portal).
-- Crawl frequency: weekly — reading periods open/close throughout the year.

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'Chill Subs (Literary Magazines)',
  'open-calls-chill-subs',
  'scrape',
  'https://www.chillsubs.com/browse/magazines',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
