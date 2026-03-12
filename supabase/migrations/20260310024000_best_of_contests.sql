-- Best Of Contests: temporal wrapper around existing Best Of categories
-- Allows weekly featured contests with admin-managed editorial copy

CREATE TABLE best_of_contests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES best_of_categories(id),
  portal_id uuid NOT NULL REFERENCES portals(id),
  slug text NOT NULL,

  -- Admin-managed editorial copy
  title text NOT NULL,
  prompt text,
  description text,
  cover_image_url text,
  accent_color text,

  -- Schedule
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,

  -- Lifecycle
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'completed', 'archived')),

  -- Winner (set on completion)
  winner_venue_id int REFERENCES venues(id),
  winner_snapshot jsonb,
  winner_announced_at timestamptz,

  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT unique_contest_slug_per_portal UNIQUE (portal_id, slug)
);

-- Only one active contest per portal at a time
CREATE UNIQUE INDEX idx_one_active_contest
  ON best_of_contests (portal_id) WHERE status = 'active';

-- Efficient lookups
CREATE INDEX idx_contests_portal_status ON best_of_contests (portal_id, status);
CREATE INDEX idx_contests_category ON best_of_contests (category_id);

-- RLS
ALTER TABLE best_of_contests ENABLE ROW LEVEL SECURITY;

-- Public can see active and completed contests only (not drafts)
CREATE POLICY best_of_contests_select ON best_of_contests
  FOR SELECT USING (status IN ('active', 'completed'));

-- Cross-portal validation trigger
CREATE OR REPLACE FUNCTION check_contest_portal_match()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM best_of_categories
    WHERE id = NEW.category_id AND portal_id = NEW.portal_id
  ) THEN
    RAISE EXCEPTION 'Category does not belong to contest portal';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contest_portal_match
  BEFORE INSERT OR UPDATE ON best_of_contests
  FOR EACH ROW EXECUTE FUNCTION check_contest_portal_match();

-- Seed first contest: Medium-Effort First Date for Atlanta
INSERT INTO best_of_contests (
  category_id,
  portal_id,
  slug,
  title,
  prompt,
  description,
  accent_color,
  starts_at,
  ends_at,
  status
) VALUES (
  (SELECT id FROM best_of_categories WHERE slug = 'medium-effort-first-date' LIMIT 1),
  (SELECT id FROM portals WHERE slug = 'atlanta' LIMIT 1),
  'medium-effort-first-date-week-1',
  'Best Medium-Effort First Date',
  'Where are you taking someone that says ''I tried, but not too hard''?',
  'Vote for Atlanta''s best spot that''s impressive enough to show effort, but chill enough that you''re not sweating it.',
  '#E855A0',
  now(),
  now() + interval '7 days',
  'draft'
);
