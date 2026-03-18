-- Migration: Venue Library Pass
--
-- Adds a library_pass JSONB column to venues.
-- Seeds known Georgia Library Experience Pass venues.
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.

-- ── UP ─────────────────────────────────────────────────────────────────────

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS library_pass JSONB;

COMMENT ON COLUMN venues.library_pass IS
  'Georgia Library Experience Pass data. Nullable. When present and eligible=true, '
  'patrons can use a library card for free or discounted admission. '
  'Schema: {eligible: bool, program: str, benefit: str, passes_per_checkout: int|null, notes: str|null, url: str}';

-- ── SEED ───────────────────────────────────────────────────────────────────
-- Match on ILIKE name patterns. We update rather than upsert so we don't
-- create stale rows if a venue was renamed.

-- Georgia Aquarium
UPDATE venues
SET library_pass = '{
  "eligible": true,
  "program": "Georgia Experience Passes",
  "benefit": "Free general admission",
  "passes_per_checkout": null,
  "notes": "Available at any Georgia public library branch",
  "url": "https://georgialibraries.org/passes/"
}'::jsonb
WHERE active = true
  AND name ILIKE '%georgia aquarium%';

-- Zoo Atlanta
UPDATE venues
SET library_pass = '{
  "eligible": true,
  "program": "Georgia Experience Passes",
  "benefit": "Free general admission",
  "passes_per_checkout": null,
  "notes": "Available at any Georgia public library branch",
  "url": "https://georgialibraries.org/passes/"
}'::jsonb
WHERE active = true
  AND name ILIKE '%zoo atlanta%';

-- High Museum of Art
UPDATE venues
SET library_pass = '{
  "eligible": true,
  "program": "Georgia Experience Passes",
  "benefit": "6 free general admission passes per checkout",
  "passes_per_checkout": 6,
  "notes": "Available at any Georgia public library branch",
  "url": "https://georgialibraries.org/passes/"
}'::jsonb
WHERE active = true
  AND name ILIKE '%high museum%';

-- Atlanta History Center
UPDATE venues
SET library_pass = '{
  "eligible": true,
  "program": "Georgia Experience Passes",
  "benefit": "6 free general admissions per checkout",
  "passes_per_checkout": 6,
  "notes": "Available at any Georgia public library branch",
  "url": "https://georgialibraries.org/passes/"
}'::jsonb
WHERE active = true
  AND name ILIKE '%atlanta history center%';

-- Center for Puppetry Arts
UPDATE venues
SET library_pass = '{
  "eligible": true,
  "program": "Georgia Experience Passes",
  "benefit": "4 free museum admissions OR 25% off All-Inclusive tickets",
  "passes_per_checkout": 4,
  "notes": "Museum admission only; additional fee for puppet shows",
  "url": "https://georgialibraries.org/passes/"
}'::jsonb
WHERE active = true
  AND (name ILIKE '%center for puppetry%' OR name ILIKE '%puppetry arts%');

-- Chattahoochee Nature Center
UPDATE venues
SET library_pass = '{
  "eligible": true,
  "program": "Georgia Experience Passes",
  "benefit": "4 free admissions per checkout",
  "passes_per_checkout": 4,
  "notes": "Available at any Georgia public library branch",
  "url": "https://georgialibraries.org/passes/"
}'::jsonb
WHERE active = true
  AND name ILIKE '%chattahoochee nature%';

-- Michael C. Carlos Museum
UPDATE venues
SET library_pass = '{
  "eligible": true,
  "program": "Georgia Experience Passes",
  "benefit": "6 free admissions per checkout",
  "passes_per_checkout": 6,
  "notes": "Available at any Georgia public library branch",
  "url": "https://georgialibraries.org/passes/"
}'::jsonb
WHERE active = true
  AND (name ILIKE '%carlos museum%' OR name ILIKE '%michael c. carlos%' OR name ILIKE '%michael c carlos%');

-- Fernbank Museum of Natural History
UPDATE venues
SET library_pass = '{
  "eligible": true,
  "program": "Fulton County Library Partnership Passes",
  "benefit": "Discounted admission — check terms at branch",
  "passes_per_checkout": null,
  "notes": "Discount amount varies; confirm at your library branch",
  "url": "https://www.fulcolibrary.org/"
}'::jsonb
WHERE active = true
  AND name ILIKE '%fernbank museum%';

-- Alliance Theatre
UPDATE venues
SET library_pass = '{
  "eligible": true,
  "program": "Fulton County Library Partnership Passes",
  "benefit": "Discounted tickets",
  "passes_per_checkout": null,
  "notes": "Check availability at your library branch",
  "url": "https://www.fulcolibrary.org/"
}'::jsonb
WHERE active = true
  AND name ILIKE '%alliance theatre%';

-- Fox Theatre
UPDATE venues
SET library_pass = '{
  "eligible": true,
  "program": "Fulton County Library Partnership Passes",
  "benefit": "Discounted tour tickets",
  "passes_per_checkout": null,
  "notes": "Historic tour discount; check availability at your library branch",
  "url": "https://www.fulcolibrary.org/"
}'::jsonb
WHERE active = true
  AND name ILIKE '%fox theatre%';

-- Tellus Science Museum
UPDATE venues
SET library_pass = '{
  "eligible": true,
  "program": "Georgia Experience Passes",
  "benefit": "Free admissions per checkout",
  "passes_per_checkout": null,
  "notes": "Available at any Georgia public library branch",
  "url": "https://georgialibraries.org/passes/"
}'::jsonb
WHERE active = true
  AND name ILIKE '%tellus science%';

-- Georgia State Parks (parking pass + historic site admissions)
-- This maps to Stone Mountain Park or similar state park venues
UPDATE venues
SET library_pass = '{
  "eligible": true,
  "program": "Georgia Experience Passes",
  "benefit": "Free parking pass + 2 free historic site admissions",
  "passes_per_checkout": 2,
  "notes": "Covers Georgia State Parks system parking and selected historic sites",
  "url": "https://georgialibraries.org/passes/"
}'::jsonb
WHERE active = true
  AND (
    name ILIKE '%stone mountain%'
    OR (name ILIKE '%state park%' AND city = 'Atlanta')
    OR (name ILIKE '%state park%' AND state = 'GA')
  );

-- ── DOWN ────────────────────────────────────────────────────────────────────

-- To revert:
-- UPDATE venues SET library_pass = NULL WHERE library_pass IS NOT NULL;
-- ALTER TABLE venues DROP COLUMN IF EXISTS library_pass;
