-- ============================================================================
-- FIFA World Cup 26 — tournament festival + match linking
-- ============================================================================
-- Context: Mercedes-Benz Stadium hosts 8 FIFA World Cup 26 matches (group stage,
-- Round of 32, Round of 16, semifinal) between 2026-06-13 and 2026-07-15.
-- These have been auto-promoted to is_tentpole=true by
-- crawlers/scripts/remediate_festival_tentpole_foundation.py (FIFA block),
-- causing 8+ rows to compete for June/July slots in the Big Stuff month ribbon.
--
-- Fix: model the tournament itself as a festival row (distinct from the existing
-- fifa-fan-festival-atlanta, which models the city-wide viewing experience),
-- and link every match event to it via events.festival_id. The Big Stuff loader
-- already filters `festival_id IS NULL` for tentpoles, so the matches drop out
-- of the ribbon automatically. The parent festival takes their place as a
-- single entry.
--
-- Idempotency:
--   - Festival INSERT uses ON CONFLICT (id) DO UPDATE to re-run safely.
--   - Event UPDATE guards on festival_id IS NULL so re-runs don't stomp later
--     manual reassignments.

DO $$
DECLARE
  atlanta_id UUID;
BEGIN
  SELECT id INTO atlanta_id FROM portals WHERE slug = 'atlanta';
  IF atlanta_id IS NULL THEN
    RAISE EXCEPTION 'Atlanta portal not found. Cannot seed FIFA World Cup 26 festival.';
  END IF;

  INSERT INTO festivals (
    id,
    slug,
    name,
    website,
    typical_month,
    typical_duration_days,
    location,
    neighborhood,
    categories,
    free,
    festival_type,
    description,
    ticket_url,
    announced_2026,
    announced_start,
    announced_end,
    primary_type,
    experience_tags,
    audience,
    size_tier,
    indoor_outdoor,
    price_tier,
    portal_id
  )
  VALUES (
    'fifa-world-cup-26',
    'fifa-world-cup-26',
    'FIFA World Cup 26',
    'https://www.fifa.com/en/tournaments/mens/worldcup/26',
    6,
    39,
    'Mercedes-Benz Stadium',
    'Downtown',
    '{sports}',
    false,
    'tournament',
    'Atlanta hosts eight FIFA World Cup 26 matches at Mercedes-Benz Stadium between mid-June and mid-July 2026 — group stage, Round of 32, Round of 16, and a semifinal — as part of the 48-team tournament co-hosted by the United States, Canada, and Mexico.',
    'https://www.fifa.com/en/tickets',
    true,
    '2026-06-13',
    '2026-07-15',
    'tournament',
    '{sports,international,stadium}',
    'general',
    'flagship',
    'indoor',
    'premium',
    atlanta_id
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    website = EXCLUDED.website,
    description = EXCLUDED.description,
    ticket_url = EXCLUDED.ticket_url,
    announced_2026 = EXCLUDED.announced_2026,
    announced_start = EXCLUDED.announced_start,
    announced_end = EXCLUDED.announced_end,
    festival_type = EXCLUDED.festival_type,
    primary_type = EXCLUDED.primary_type,
    experience_tags = EXCLUDED.experience_tags,
    audience = EXCLUDED.audience,
    size_tier = EXCLUDED.size_tier,
    indoor_outdoor = EXCLUDED.indoor_outdoor,
    price_tier = EXCLUDED.price_tier,
    portal_id = EXCLUDED.portal_id;

  -- Link all FIFA World Cup match events to the tournament festival.
  -- Scope: match-like rows in the tournament window, not yet linked to any festival,
  -- not soft-deleted as dupes. Matches a dedicated Atlanta-portal query so we don't
  -- touch other portals' rows.
  UPDATE events
  SET festival_id = 'fifa-world-cup-26'
  WHERE title ILIKE '%FIFA World Cup%'
    AND start_date >= '2026-06-01'
    AND start_date <= '2026-08-01'
    AND festival_id IS NULL
    AND canonical_event_id IS NULL
    AND is_active = true
    AND portal_id = atlanta_id;
END $$;
