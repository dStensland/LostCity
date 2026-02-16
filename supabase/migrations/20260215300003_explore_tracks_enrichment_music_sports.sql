-- ============================================================================
-- Explore Tracks Enrichment: Music, Art & Sports (Batch 3)
-- Research source: AJC hip-hop landmarks, Red Bull Music Academy,
-- Discover Atlanta, The Infatuation sports bars guide
-- ============================================================================

-- ============================================================================
-- 1. THE SOUTH GOT SOMETHING TO SAY (Hip-Hop) — Track: 7e093778-4e6c-4815-a351-7248a6279c34
-- ============================================================================

INSERT INTO explore_track_venues (track_id, venue_id, status, is_featured, editorial_blurb)
VALUES
  -- Magic City (826) — strip club that shaped Southern hip-hop
  ('7e093778-4e6c-4815-a351-7248a6279c34', 826, 'approved', true,
   'Where Southern hip-hop gets road-tested. The dancers were the ultimate A&Rs.'),
  -- Lenox Square (537) — where OutKast met, where T.I. hustled mixtapes
  ('7e093778-4e6c-4815-a351-7248a6279c34', 537, 'approved', false,
   'Where Andre 3000 met Big Boi. Where T.I. handed out his first mixtapes. Buckhead''s hip-hop origin story.')
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- ============================================================================
-- 2. KEEP SWINGING (Sports/Game Day) — Track: 591dc7dd-f6ee-49bb-8381-5fa4329447f1
-- ============================================================================

INSERT INTO explore_track_venues (track_id, venue_id, status, is_featured, editorial_blurb)
VALUES
  -- Park Tavern (640) — Official Atlanta United pub partner
  ('591dc7dd-f6ee-49bb-8381-5fa4329447f1', 640, 'approved', true,
   'Official Atlanta United pub partner. 25+ screens, a projection wall, and Piedmont Park views.'),
  -- STATS Brewpub (654) — Downtown near stadiums
  ('591dc7dd-f6ee-49bb-8381-5fa4329447f1', 654, 'approved', false,
   'Steps from Mercedes-Benz Stadium. Good wings, cold brews, and the energy of game day downtown.'),
  -- Midway Pub (1147) — EAV neighborhood sports bar
  ('591dc7dd-f6ee-49bb-8381-5fa4329447f1', 1147, 'approved', false,
   'EAV''s chill neighborhood sports bar. Pool tables, bar bites, and every game on.'),
  -- The Beverly (715) — Morehouse grad-owned, HBCU community
  ('591dc7dd-f6ee-49bb-8381-5fa4329447f1', 715, 'approved', false,
   'Morehouse grad-owned neighborhood bar. Strong HBCU alumni community on game days.')
ON CONFLICT (track_id, venue_id) DO NOTHING;

-- ============================================================================
-- 3. HARD IN DA PAINT (Nightlife/Culture) — Track: 5601c078-2327-48fc-800f-87c03b1cc363
--    Magic City is also a nightlife/culture landmark
-- ============================================================================

INSERT INTO explore_track_venues (track_id, venue_id, status, is_featured, editorial_blurb)
VALUES
  ('5601c078-2327-48fc-800f-87c03b1cc363', 826, 'approved', true,
   'The Black Studio 54 of the South. Where hip-hop careers are made on the dance floor.')
ON CONFLICT (track_id, venue_id) DO NOTHING;
