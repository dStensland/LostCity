-- Venue enrichment fields for specials scraper
-- dietary_options, parking, menu_highlights, payment_notes, is_chain

ALTER TABLE venues ADD COLUMN IF NOT EXISTS dietary_options TEXT[];
ALTER TABLE venues ADD COLUMN IF NOT EXISTS parking TEXT[];
ALTER TABLE venues ADD COLUMN IF NOT EXISTS menu_highlights JSONB;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS payment_notes TEXT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS is_chain BOOLEAN;

CREATE INDEX IF NOT EXISTS idx_venues_dietary_options ON venues USING GIN (dietary_options);
CREATE INDEX IF NOT EXISTS idx_venues_parking ON venues USING GIN (parking);
CREATE INDEX IF NOT EXISTS idx_venues_is_chain ON venues(is_chain) WHERE is_chain = TRUE;

COMMENT ON COLUMN venues.dietary_options IS 'Dietary accommodations: vegetarian-friendly, vegan-options, gluten-free-options, halal, kosher, allergy-aware';
COMMENT ON COLUMN venues.parking IS 'Parking options: street, lot, garage, valet, no-parking';
COMMENT ON COLUMN venues.menu_highlights IS 'JSON array of 3-5 signature dishes [{name, price, category}]';
COMMENT ON COLUMN venues.payment_notes IS 'Payment quirks: cash-only, card minimum, etc.';
COMMENT ON COLUMN venues.is_chain IS 'Whether this is a chain restaurant/bar (true) or independent (false)';
