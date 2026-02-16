-- Walkable venue neighbors — precomputed pairs within 0.3 miles
-- Populated by enrich_transit.py --walkable

CREATE TABLE IF NOT EXISTS walkable_neighbors (
    venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    neighbor_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    walk_minutes INTEGER NOT NULL,
    distance_miles NUMERIC(4,3) NOT NULL,
    PRIMARY KEY (venue_id, neighbor_id)
);

-- Index for fast lookups from either direction
CREATE INDEX IF NOT EXISTS idx_walkable_neighbors_venue ON walkable_neighbors(venue_id);
CREATE INDEX IF NOT EXISTS idx_walkable_neighbors_neighbor ON walkable_neighbors(neighbor_id);

-- Walkable cluster count on venues for quick filtering
ALTER TABLE venues ADD COLUMN IF NOT EXISTS walkable_neighbor_count INTEGER DEFAULT 0;

COMMENT ON TABLE walkable_neighbors IS 'Precomputed walkable venue pairs within 0.3 miles';
COMMENT ON COLUMN venues.walkable_neighbor_count IS 'Number of other venues within 0.3 mile walk';
