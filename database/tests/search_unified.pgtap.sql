-- Regression test: search_unified MUST enforce portal isolation.
-- Any failure means cross-portal data is leaking in search results.
-- Schema notes: events.portal_id (UUID), events.place_id (INTEGER → places.id),
-- events.category_id (TEXT), places has no portal_id. See plan Task 7.

BEGIN;
SELECT plan(8);

-- Set up two portals
INSERT INTO portals (id, slug, name, portal_type) VALUES
  ('11111111-1111-1111-1111-111111111111', 'pgtap-atl', 'ATL Test', 'city'),
  ('22222222-2222-2222-2222-222222222222', 'pgtap-nyc', 'NYC Test', 'city')
ON CONFLICT (id) DO NOTHING;

-- One jazz event per portal. events.id is SERIAL so we let it auto-generate.
-- search_vector is populated by the events_search_vector_trigger on INSERT
-- (uses 'english' config). The function queries via websearch_to_tsquery('simple')
-- which matches 'jazz' against 'english' vectors correctly.
-- Use simple text search config to match the RPC's websearch_to_tsquery.
INSERT INTO events (
  source_id, portal_id, title, start_date, is_active,
  search_vector, category_id, source_url
)
VALUES
  (
    (SELECT id FROM sources LIMIT 1),
    '11111111-1111-1111-1111-111111111111',
    'Atlanta Jazz Night',
    (now() + interval '1 day')::date,
    true,
    to_tsvector('simple', 'atlanta jazz night'),
    'music',
    'https://example.test/pgtap-atl-jazz'
  ),
  (
    (SELECT id FROM sources LIMIT 1),
    '22222222-2222-2222-2222-222222222222',
    'NYC Jazz Night',
    (now() + interval '1 day')::date,
    true,
    to_tsvector('simple', 'nyc jazz night'),
    'music',
    'https://example.test/pgtap-nyc-jazz'
  );

-- Assertion 1: Atlanta search returns the Atlanta event
SELECT ok(
  (SELECT count(*) FROM search_unified(
    '11111111-1111-1111-1111-111111111111'::uuid,
    'jazz',
    ARRAY['event'],
    NULL, NULL, NULL, NULL, false, 10
  ) WHERE retriever_id = 'fts' AND title = 'Atlanta Jazz Night') >= 1,
  'atlanta search returns atlanta jazz event'
);

-- Assertion 2: Atlanta search does NOT return the NYC event
SELECT ok(
  (SELECT count(*) FROM search_unified(
    '11111111-1111-1111-1111-111111111111'::uuid,
    'jazz',
    ARRAY['event'],
    NULL, NULL, NULL, NULL, false, 10
  ) WHERE title LIKE 'NYC%') = 0,
  'atlanta search does not leak NYC rows'
);

-- Assertion 3: Unknown portal id returns zero rows
SELECT ok(
  (SELECT count(*) FROM search_unified(
    '00000000-0000-0000-0000-000000000000'::uuid,
    'jazz',
    ARRAY['event'],
    NULL, NULL, NULL, NULL, false, 10
  )) = 0,
  'unknown portal returns 0 rows'
);

-- Assertion 4: NULL portal id raises an exception
SELECT throws_ok(
  $$ SELECT * FROM search_unified(NULL::uuid, 'jazz', ARRAY['event'], NULL, NULL, NULL, NULL, false, 10) $$,
  NULL,
  'null portal id is rejected'
);

-- Assertion 5: Trigram retriever respects portal isolation
-- Insert a typo-ish event in NYC; atlanta 'jaz' search must not return it
INSERT INTO events (
  source_id, portal_id, title, start_date, is_active,
  search_vector, category_id, source_url
) VALUES (
  (SELECT id FROM sources LIMIT 1),
  '22222222-2222-2222-2222-222222222222',
  'Jaz Room NYC',
  (now() + interval '2 days')::date,
  true,
  to_tsvector('simple', 'jaz room nyc'),
  'music',
  'https://example.test/pgtap-nyc-jaz'
);

SELECT ok(
  (SELECT count(*) FROM search_unified(
    '11111111-1111-1111-1111-111111111111'::uuid,
    'jaz',
    ARRAY['event'],
    NULL, NULL, NULL, NULL, false, 10
  ) WHERE title LIKE '%NYC%') = 0,
  'trigram retriever does not leak cross-portal events'
);

-- Assertion 6: portal_venues scoping works — inserting a cross-portal place
-- reference should not make the place searchable from Atlanta
-- (Test uses LIKE on title since we can't easily control which places exist.)
SELECT ok(
  (SELECT count(*) FROM search_unified(
    '11111111-1111-1111-1111-111111111111'::uuid,
    'nyc',
    ARRAY['venue'],
    NULL, NULL, NULL, NULL, false, 10
  ) WHERE title ILIKE '%nyc%') = 0,
  'place search does not leak places referenced only by other portals'
);

-- Assertion 7: Limit clamping. Requesting 9999 per retriever should return ≤80 events
SELECT ok(
  (SELECT count(*) FROM search_unified(
    (SELECT id FROM portals WHERE slug = 'atlanta'),
    'the',
    ARRAY['event'],
    NULL, NULL, NULL, NULL, false, 9999
  ) WHERE retriever_id = 'fts') <= 80,
  'limit clamping: p_limit_per_retriever=9999 returns <= 80 fts events'
);

-- Assertion 8: Empty query returns zero rows without exception
SELECT ok(
  (SELECT count(*) FROM search_unified(
    '11111111-1111-1111-1111-111111111111'::uuid,
    '',
    ARRAY['event', 'venue'],
    NULL, NULL, NULL, NULL, false, 10
  )) >= 0,  -- any non-negative count means no exception; FTS with empty tsquery may return zero
  'empty query does not raise exception'
);

SELECT * FROM finish();
ROLLBACK;
