-- Migration: Taxonomy Redesign Phase1
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.

-- Taxonomy Redesign Phase 1: Expand schema (additive only, nothing removed)

-- 1. Add new category rows
INSERT INTO categories (id, name, display_order, icon, color)
VALUES
  ('games', 'Games', 21, 'game-controller', '#4ADE80'),
  ('workshops', 'Workshops', 22, 'paint-brush', '#FBBF24'),
  ('education', 'Education', 23, 'graduation-cap', '#60A5FA'),
  ('conventions', 'Conventions', 24, 'buildings', '#38BDF8'),
  ('support', 'Support', 25, 'heart', '#F9A8D4'),
  ('fitness', 'Fitness', 26, 'barbell', '#5EEAD4')
ON CONFLICT (id) DO NOTHING;

-- 2. Add legacy_category_id for rollback capability
ALTER TABLE events ADD COLUMN IF NOT EXISTS legacy_category_id TEXT;

-- 3. Derived attribute columns (high-value = first-class)
ALTER TABLE events ADD COLUMN IF NOT EXISTS duration TEXT
  CHECK (duration IN ('short', 'medium', 'half-day', 'full-day', 'multi-day'));
ALTER TABLE events ADD COLUMN IF NOT EXISTS cost_tier TEXT
  CHECK (cost_tier IN ('free', '$', '$$', '$$$'));
ALTER TABLE events ADD COLUMN IF NOT EXISTS skill_level TEXT
  CHECK (skill_level IN ('beginner', 'intermediate', 'advanced', 'all-levels'));
ALTER TABLE events ADD COLUMN IF NOT EXISTS booking_required BOOLEAN;
ALTER TABLE events ADD COLUMN IF NOT EXISTS indoor_outdoor TEXT
  CHECK (indoor_outdoor IN ('indoor', 'outdoor', 'both'));

-- 4. JSONB column for medium-value derived attributes
ALTER TABLE events ADD COLUMN IF NOT EXISTS derived_attributes JSONB DEFAULT '{}';

-- 5. Significance columns
ALTER TABLE events ADD COLUMN IF NOT EXISTS significance TEXT
  CHECK (significance IN ('low', 'medium', 'high'));
ALTER TABLE events ADD COLUMN IF NOT EXISTS significance_signals TEXT[] DEFAULT '{}';

-- 6. Classification prompt version for auditability
ALTER TABLE events ADD COLUMN IF NOT EXISTS classification_prompt_version TEXT;

-- 7. Audience tags (explicit, separate from venue-inferred)
ALTER TABLE events ADD COLUMN IF NOT EXISTS audience_tags TEXT[] DEFAULT '{}';
COMMENT ON COLUMN events.audience_tags IS 'Explicit audience tags (toddler, preschool, kids, teen, 18+, 21+). Only event-explicit 21+ gates from anonymous feed; venue-inferred is soft label only.';

-- 8. Extend feed_events_ready with new columns
ALTER TABLE feed_events_ready ADD COLUMN IF NOT EXISTS duration TEXT;
ALTER TABLE feed_events_ready ADD COLUMN IF NOT EXISTS cost_tier TEXT;
ALTER TABLE feed_events_ready ADD COLUMN IF NOT EXISTS significance TEXT;
ALTER TABLE feed_events_ready ADD COLUMN IF NOT EXISTS audience_tags TEXT[] DEFAULT '{}';
