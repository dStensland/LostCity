-- Birthday Party Venue Tags
--
-- Adds 'birthday_party' to the venue_occasions occasion CHECK constraint, then
-- tags known family-friendly party venues with the new occasion at full
-- manual confidence.
--
-- Venues covered:
--   Trampoline / adventure parks: Sky Zone, Defy, Urban Air (all locations)
--   Karting / arcade entertainment: Andretti (all locations), Round 1
--   Kids entertainment: LEGO Discovery Center, Painted Duck
--   Art studios: All Fired Up Art (all locations)
--   Museums with party packages: Children's Museum of Atlanta,
--                                 Fernbank Museum, Fernbank Science Center
--   Nature / animals: Zoo Atlanta, Georgia Aquarium, Chattahoochee Nature Center

-- ─── 1. Expand the occasion CHECK constraint ─────────────────────────────────

ALTER TABLE venue_occasions DROP CONSTRAINT IF EXISTS venue_occasions_occasion_check;

ALTER TABLE venue_occasions ADD CONSTRAINT venue_occasions_occasion_check CHECK (
  occasion IN (
    'date_night',
    'groups',
    'solo',
    'outdoor_dining',
    'late_night',
    'quick_bite',
    'special_occasion',
    'beltline',
    'pre_game',
    'brunch',
    'family_friendly',
    'dog_friendly',
    'live_music',
    'dancing',
    'birthday_party'
  )
);

-- ─── 2. Insert birthday_party tags for known party venues ────────────────────

INSERT INTO venue_occasions (venue_id, occasion, confidence, source)
SELECT v.id, 'birthday_party', 0.95, 'manual'
FROM venues v
WHERE v.slug IN (
    -- Trampoline / adventure parks
    'sky-zone-atlanta',
    'defy-atlanta',
    -- Urban Air has several Atlanta-area locations
    'urban-air-adventure-park',
    'urban-air-buford',
    'urban-air-snellville',
    'urban-air-kennesaw',
    -- Karting / arcade entertainment
    'andretti-indoor-karting-atlanta',
    'andretti-buford',
    'andretti-marietta',
    'round-1-arcade-alpharetta',
    -- Kids entertainment
    'lego-discovery-center-atlanta',
    'painted-duck',
    -- Art studios
    'all-fired-up-art',
    'all-fired-up-art-alpharetta',
    'all-fired-up-art-marietta',
    'all-fired-up-art-emory-village',
    -- Museums with party packages
    'childrens-museum-atlanta',
    'fernbank-museum',
    'fernbank-museum-atlanta',
    'fernbank-science-center',
    -- Nature / animals
    'zoo-atlanta',
    'georgia-aquarium',
    'chattahoochee-nature-center'
)
AND v.active = true
ON CONFLICT (venue_id, occasion) DO NOTHING;
