-- Canonical Atlanta music-venue tier seed.
-- See docs/superpowers/specs/2026-04-17-live-music-feed-and-explore-design.md §3.
-- See docs/superpowers/plans/2026-04-17-music-plans-revisions.md R2 for slug corrections.
-- All slugs below verified against live DB; UPDATEs scoped to the exact canonical slug.

-- ═══ EDITORIAL (music_programming_style set) ════════════════════════════
UPDATE places SET music_programming_style = 'listening_room',
  music_venue_formats = ARRAY['listening_room','seated']::text[], capacity = 200
WHERE slug = 'eddies-attic';

UPDATE places SET music_programming_style = 'listening_room',
  music_venue_formats = ARRAY['listening_room','seated']::text[], capacity = 100
WHERE slug = 'red-light-cafe';

UPDATE places SET music_programming_style = 'listening_room',
  music_venue_formats = ARRAY['listening_room','seated']::text[], capacity = 300
WHERE slug = 'city-winery-atlanta';

UPDATE places SET music_programming_style = 'curated_indie',
  music_venue_formats = ARRAY['standing_room','seated']::text[], capacity = 300
WHERE slug = 'smiths-olde-bar';

UPDATE places SET music_programming_style = 'curated_indie',
  music_venue_formats = ARRAY['standing_room']::text[], capacity = 600
WHERE slug = 'terminal-west';

UPDATE places SET music_programming_style = 'curated_indie',
  music_venue_formats = ARRAY['seated','standing_room']::text[], capacity = 1050
WHERE slug = 'variety-playhouse';

UPDATE places SET music_programming_style = 'curated_indie',
  music_venue_formats = ARRAY['standing_room']::text[], capacity = 300
WHERE slug = 'the-earl';

UPDATE places SET music_programming_style = 'curated_indie',
  music_venue_formats = ARRAY['standing_room']::text[], capacity = 150
WHERE slug = '529';

UPDATE places SET music_programming_style = 'curated_indie',
  music_venue_formats = ARRAY['standing_room']::text[], capacity = 200
WHERE slug = 'star-community-bar';

UPDATE places SET music_programming_style = 'curated_indie',
  music_venue_formats = ARRAY['standing_room']::text[], capacity = 400
WHERE slug = 'aisle-5';

-- Masquerade — 3 discrete rooms (per Revisions R2; DO NOT use LIKE wildcard).
UPDATE places SET music_programming_style = 'curated_indie',
  music_venue_formats = ARRAY['standing_room']::text[], capacity = 1000
WHERE slug = 'the-masquerade-heaven';

UPDATE places SET music_programming_style = 'curated_indie',
  music_venue_formats = ARRAY['standing_room']::text[], capacity = 450
WHERE slug = 'the-masquerade-hell';

UPDATE places SET music_programming_style = 'curated_indie',
  music_venue_formats = ARRAY['standing_room']::text[], capacity = 300
WHERE slug = 'the-masquerade-purgatory';

UPDATE places SET music_programming_style = 'dj_electronic',
  music_venue_formats = ARRAY['dj_booth','standing_room']::text[], capacity = 300
WHERE slug = 'mjq-concourse';

UPDATE places SET music_programming_style = 'dj_electronic',
  music_venue_formats = ARRAY['dj_booth','standing_room']::text[], capacity = 400
WHERE slug = 'the-bakery-atlanta';

-- ═══ MARQUEE (music_programming_style NULL, capacity >= 1000) ═══════════
UPDATE places SET capacity = 2600,
  music_venue_formats = ARRAY['standing_room','seated']::text[]
WHERE slug = 'tabernacle' AND music_programming_style IS NULL;

UPDATE places SET capacity = 2200,
  music_venue_formats = ARRAY['standing_room','seated']::text[]
WHERE slug = 'the-eastern' AND music_programming_style IS NULL;

UPDATE places SET capacity = 1800,
  music_venue_formats = ARRAY['standing_room','seated']::text[]
WHERE slug = 'buckhead-theatre' AND music_programming_style IS NULL;

UPDATE places SET capacity = 3600,
  music_venue_formats = ARRAY['standing_room','seated']::text[]
WHERE slug = 'coca-cola-roxy' AND music_programming_style IS NULL;

UPDATE places SET capacity = 1050,
  music_venue_formats = ARRAY['seated','standing_room']::text[]
WHERE slug = 'center-stage-atlanta' AND music_programming_style IS NULL;

UPDATE places SET capacity = 4665,
  music_venue_formats = ARRAY['seated']::text[]
WHERE slug = 'fox-theatre-atlanta' AND music_programming_style IS NULL;

UPDATE places SET capacity = 21000,
  music_venue_formats = ARRAY['arena','seated']::text[]
WHERE slug = 'state-farm-arena' AND music_programming_style IS NULL;

UPDATE places SET capacity = 19000,
  music_venue_formats = ARRAY['outdoor','seated','lawn']::text[]
WHERE slug = 'lakewood-amphitheatre' AND music_programming_style IS NULL;

UPDATE places SET capacity = 12000,
  music_venue_formats = ARRAY['outdoor','seated','lawn']::text[]
WHERE slug = 'ameris-bank-amphitheatre' AND music_programming_style IS NULL;

UPDATE places SET capacity = 2400,
  music_venue_formats = ARRAY['standing_room']::text[]
WHERE slug = 'believe-music-hall' AND music_programming_style IS NULL;
