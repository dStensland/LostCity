ALTER TABLE venues ADD COLUMN IF NOT EXISTS phone TEXT;
COMMENT ON COLUMN venues.phone IS 'Venue phone number';
