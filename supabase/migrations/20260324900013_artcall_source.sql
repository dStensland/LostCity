-- Register ArtCall.org as an open calls source for the Arts portal.
-- ArtCall.org is a call-for-entry management platform that lists 200+ active
-- open calls across two sections: "ArtCall™ Calls" (hosted on artcall.org
-- subdomains) and "Additional Calls" (external calls listed on artcall.org
-- detail pages). Calls span submissions, exhibitions, residencies, commissions,
-- and grants.
--
-- The crawler handles both sections in a single pass. No pagination needed —
-- all calls appear on https://artcall.org/calls.

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'ArtCall.org - Open Calls',
  'open-calls-artcall',
  'scrape',
  'https://artcall.org/calls',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
