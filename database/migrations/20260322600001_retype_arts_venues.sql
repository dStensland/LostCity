-- MIGRATION: Retype mistyped arts venues
--
-- These venues should surface in gallery/arts discovery filters but have wrong
-- venue_type values. Correcting to arts_center or gallery as appropriate.
--
-- arts_center: venues with dedicated arts programming, classes, and exhibitions
-- gallery: venues whose primary function is displaying/selling art
--
-- NOTE: Avondale Arts Alliance (1097) and Southeast Fiber Arts Alliance (2606)
-- were previously retyped to 'organization' because they host events at OTHER
-- venues. They are not physical gallery spaces — keeping as organization.

-- Arts centers: dedicated arts programming facilities
UPDATE venues SET venue_type = 'arts_center'
WHERE id IN (
    330,   -- Callanwolde Fine Arts Center (was: organization)
    1375,  -- Chastain Arts Center (was: community_center)
    4627   -- Southwest Arts Center (was: event_space)
);

-- Galleries: primary function is displaying/selling art
UPDATE venues SET venue_type = 'gallery'
WHERE id IN (
    72,    -- Distillery of Modern Art (was: event_space)
    4,     -- ABV Gallery (was: event_space)
    4172,  -- Buckhead Art & Company (was: event_space)
    4156   -- Neutral Moon Studio (was: event_space)
);
