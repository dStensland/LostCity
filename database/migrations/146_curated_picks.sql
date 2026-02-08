-- Migration: Add curated_picks table for manual tonight's picks curation
-- Allows editors to override the algorithmic picks for a specific date

CREATE TABLE IF NOT EXISTS curated_picks (
    id SERIAL PRIMARY KEY,
    pick_date DATE NOT NULL,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(pick_date, event_id)
);

CREATE INDEX idx_curated_picks_date ON curated_picks(pick_date);

COMMENT ON TABLE curated_picks IS 'Manual override for tonight''s picks. When rows exist for a date, the /api/tonight endpoint returns these instead of algorithmic picks.';

-- Curated picks for Feb 8, 2026 (Super Bowl Sunday social push)
INSERT INTO curated_picks (pick_date, event_id, position) VALUES
    ('2026-02-08', 3066, 1),   -- New Faces Amateur Drag Competition
    ('2026-02-08', 21600, 2),  -- Serial Killer: The Exhibition World Tour
    ('2026-02-08', 17545, 3),  -- UPS Second Sunday
    ('2026-02-08', 20184, 4),  -- Mitski with support from Bleary
    ('2026-02-08', 2054, 5),   -- Best of Atlanta Comedy Showcase (has image)
    ('2026-02-08', 13976, 6),  -- Alchemical String Theory
    ('2026-02-08', 12167, 7),  -- Da Sunday Open Jam
    ('2026-02-08', 611, 8),    -- The Big Game: Watch Party (has image)
    ('2026-02-08', 9616, 9),   -- Team Trivia
    ('2026-02-08', 604, 10),   -- Harry Potter Deathly Hallows Live in Concert
    ('2026-02-08', 14027, 11), -- HBCU Sunday
    ('2026-02-08', 5183, 12)   -- Sunday Jazz Brunch
ON CONFLICT (pick_date, event_id) DO NOTHING;
