-- Add class-specific columns to events table
-- Classes are workshops, cooking classes, paint-and-sip sessions, pottery, dance lessons, etc.
-- Using a boolean flag rather than event_type enum for simplicity and backwards-compatibility.

ALTER TABLE events ADD COLUMN IF NOT EXISTS is_class boolean DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS skill_level text; -- 'beginner', 'intermediate', 'advanced', 'all-levels'
ALTER TABLE events ADD COLUMN IF NOT EXISTS class_category text; -- 'painting', 'cooking', 'pottery', 'dance', 'fitness', 'woodworking', 'floral', 'photography', 'candle-making', 'outdoor-skills'
ALTER TABLE events ADD COLUMN IF NOT EXISTS instructor text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS capacity integer;

-- Partial index for efficient class queries (only indexes rows where is_class = true)
CREATE INDEX IF NOT EXISTS idx_events_is_class ON events (is_class) WHERE is_class = true;

-- Composite index for class browsing (category + date filtering)
CREATE INDEX IF NOT EXISTS idx_events_class_category_date ON events (class_category, start_date) WHERE is_class = true;
