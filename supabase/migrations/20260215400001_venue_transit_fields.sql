-- Add MARTA, BeltLine, and walkability fields to venues table
-- Populated by enrich_transit.py backfill from GTFS + BeltLine coordinate data

-- MARTA proximity
ALTER TABLE venues ADD COLUMN IF NOT EXISTS nearest_marta_station TEXT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS marta_walk_minutes INTEGER;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS marta_lines TEXT[];

-- BeltLine adjacency
ALTER TABLE venues ADD COLUMN IF NOT EXISTS beltline_adjacent BOOLEAN DEFAULT FALSE;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS beltline_segment TEXT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS beltline_walk_minutes INTEGER;

-- Transit score (computed from MARTA + BeltLine + parking)
ALTER TABLE venues ADD COLUMN IF NOT EXISTS transit_score INTEGER;

COMMENT ON COLUMN venues.nearest_marta_station IS 'Name of closest MARTA rail station';
COMMENT ON COLUMN venues.marta_walk_minutes IS 'Walking time in minutes to nearest station';
COMMENT ON COLUMN venues.marta_lines IS 'MARTA rail lines at nearest station (red, gold, blue, green)';
COMMENT ON COLUMN venues.beltline_adjacent IS 'Within 0.25 miles of BeltLine trail';
COMMENT ON COLUMN venues.beltline_segment IS 'Nearest BeltLine segment name (Eastside Trail, etc.)';
COMMENT ON COLUMN venues.beltline_walk_minutes IS 'Walking time to nearest BeltLine trail access';
COMMENT ON COLUMN venues.transit_score IS 'Composite transit accessibility score 1-10';
