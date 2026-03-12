-- 20260309173000_volunteer_opportunities_phase1.sql
-- Structured volunteer opportunity model for long-term and event-backed roles.

CREATE TABLE IF NOT EXISTS volunteer_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_id INTEGER REFERENCES sources(id) ON DELETE SET NULL,
  portal_id UUID REFERENCES portals(id) ON DELETE SET NULL,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT,
  description TEXT,
  commitment_level TEXT NOT NULL CHECK (commitment_level IN ('drop_in', 'ongoing', 'lead_role')),
  time_horizon TEXT CHECK (time_horizon IN ('one_day', 'multi_week', 'multi_month', 'ongoing')),
  onboarding_level TEXT CHECK (onboarding_level IN ('none', 'light', 'screening_required', 'training_required')),
  schedule_summary TEXT,
  location_summary TEXT,
  skills_required TEXT[] NOT NULL DEFAULT '{}'::text[],
  language_support TEXT[] NOT NULL DEFAULT '{}'::text[],
  physical_demand TEXT CHECK (physical_demand IN ('low', 'medium', 'high')),
  min_age INTEGER,
  family_friendly BOOLEAN NOT NULL DEFAULT FALSE,
  group_friendly BOOLEAN NOT NULL DEFAULT FALSE,
  remote_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  accessibility_notes TEXT,
  background_check_required BOOLEAN NOT NULL DEFAULT FALSE,
  training_required BOOLEAN NOT NULL DEFAULT FALSE,
  capacity_total INTEGER,
  capacity_remaining INTEGER,
  urgency_level TEXT NOT NULL DEFAULT 'normal' CHECK (urgency_level IN ('normal', 'urgent')),
  starts_on DATE,
  ends_on DATE,
  application_url TEXT NOT NULL,
  source_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT volunteer_opportunities_date_order_check CHECK (
    starts_on IS NULL OR ends_on IS NULL OR starts_on <= ends_on
  ),
  CONSTRAINT volunteer_opportunities_capacity_check CHECK (
    capacity_total IS NULL OR capacity_total >= 0
  ),
  CONSTRAINT volunteer_opportunities_capacity_remaining_check CHECK (
    capacity_remaining IS NULL OR capacity_remaining >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_volunteer_opportunities_org_active
  ON volunteer_opportunities(organization_id, is_active, commitment_level, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_volunteer_opportunities_source_active
  ON volunteer_opportunities(source_id, is_active, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_volunteer_opportunities_portal_active
  ON volunteer_opportunities(portal_id, is_active, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_volunteer_opportunities_event
  ON volunteer_opportunities(event_id)
  WHERE event_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_volunteer_profile (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  causes TEXT[] NOT NULL DEFAULT '{}'::text[],
  skills TEXT[] NOT NULL DEFAULT '{}'::text[],
  availability_windows JSONB NOT NULL DEFAULT '[]'::jsonb,
  travel_radius_km INTEGER,
  mobility_constraints TEXT,
  languages TEXT[] NOT NULL DEFAULT '{}'::text[],
  commitment_preference TEXT CHECK (commitment_preference IN ('drop_in', 'ongoing', 'lead_role', 'mixed')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS volunteer_engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES volunteer_opportunities(id) ON DELETE CASCADE,
  event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
  portal_id UUID REFERENCES portals(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('interested', 'committed', 'attended', 'cancelled', 'no_show')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, opportunity_id)
);

CREATE INDEX IF NOT EXISTS idx_volunteer_engagements_user_status
  ON volunteer_engagements(user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_volunteer_engagements_opportunity
  ON volunteer_engagements(opportunity_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_volunteer_engagements_portal
  ON volunteer_engagements(portal_id, updated_at DESC)
  WHERE portal_id IS NOT NULL;

DROP TRIGGER IF EXISTS update_volunteer_opportunities_updated_at ON volunteer_opportunities;
CREATE TRIGGER update_volunteer_opportunities_updated_at
  BEFORE UPDATE ON volunteer_opportunities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_volunteer_engagements_updated_at ON volunteer_engagements;
CREATE TRIGGER update_volunteer_engagements_updated_at
  BEFORE UPDATE ON volunteer_engagements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_volunteer_profile_updated_at ON user_volunteer_profile;
CREATE TRIGGER update_user_volunteer_profile_updated_at
  BEFORE UPDATE ON user_volunteer_profile
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE volunteer_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_volunteer_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteer_engagements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'volunteer_opportunities'
      AND policyname = 'volunteer_opportunities_public_select_active'
  ) THEN
    CREATE POLICY volunteer_opportunities_public_select_active
      ON volunteer_opportunities
      FOR SELECT
      USING (
        is_active = true
        AND EXISTS (
          SELECT 1
          FROM organizations
          WHERE organizations.id = volunteer_opportunities.organization_id
            AND organizations.hidden = false
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_volunteer_profile'
      AND policyname = 'user_volunteer_profile_owner_all'
  ) THEN
    CREATE POLICY user_volunteer_profile_owner_all
      ON user_volunteer_profile
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'volunteer_engagements'
      AND policyname = 'volunteer_engagements_owner_all'
  ) THEN
    CREATE POLICY volunteer_engagements_owner_all
      ON volunteer_engagements
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

WITH helpatl AS (
  SELECT id
  FROM portals
  WHERE slug = 'helpatl'
  LIMIT 1
),
org_seed(name, slug, org_type, website, description, categories, city, portal_id) AS (
  SELECT
    seed.name,
    seed.slug,
    seed.org_type,
    seed.website,
    seed.description,
    seed.categories,
    'Atlanta',
    (SELECT id FROM helpatl)
  FROM (
    VALUES
      (
        'Big Brothers Big Sisters of Metro Atlanta',
        'big-brothers-big-sisters-atl',
        'community_group',
        'https://bbbsatl.org/be-a-big/',
        'Youth mentorship organization serving metro Atlanta through long-term volunteer matches.',
        ARRAY['community']
      ),
      (
        'Everybody Wins! Atlanta',
        'everybody-wins-atlanta',
        'community_group',
        'https://everybodywinsatlanta.org/power-lunch/',
        'Reading and mentoring nonprofit focused on consistent literacy support for Atlanta students.',
        ARRAY['community']
      ),
      (
        'Atlanta CASA',
        'atlanta-casa',
        'community_group',
        'https://atlantacasa.org/get-involved/become-a-volunteer/',
        'Court Appointed Special Advocates for children involved in the foster care system.',
        ARRAY['community']
      ),
      (
        'LaAmistad',
        'laamistad',
        'community_group',
        'https://laamistadinc.org/volunteer/',
        'Education and family support nonprofit serving immigrant communities in Atlanta.',
        ARRAY['community']
      ),
      (
        'Chattahoochee Riverkeeper',
        'chattahoochee-riverkeeper',
        'community_group',
        'https://chattahoochee.org/volunteer',
        'Watershed protection nonprofit organizing river stewardship and community science work.',
        ARRAY['community', 'outdoors']
      ),
      (
        'Atlanta Community Food Bank',
        'atlanta-community-food-bank',
        'community_group',
        'https://www.acfb.org/volunteer/',
        'Regional hunger relief organization with volunteer pathways across food access programs.',
        ARRAY['community']
      )
  ) AS seed(name, slug, org_type, website, description, categories)
)
INSERT INTO organizations (
  id,
  name,
  slug,
  org_type,
  website,
  description,
  categories,
  city,
  portal_id,
  hidden,
  featured
)
SELECT
  gen_random_uuid(),
  name,
  slug,
  org_type,
  website,
  description,
  categories,
  city,
  portal_id,
  false,
  false
FROM org_seed
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  org_type = EXCLUDED.org_type,
  website = COALESCE(organizations.website, EXCLUDED.website),
  description = COALESCE(organizations.description, EXCLUDED.description),
  categories = COALESCE(organizations.categories, EXCLUDED.categories),
  city = COALESCE(organizations.city, EXCLUDED.city),
  portal_id = COALESCE(organizations.portal_id, EXCLUDED.portal_id),
  hidden = false;

WITH helpatl AS (
  SELECT id
  FROM portals
  WHERE slug = 'helpatl'
  LIMIT 1
),
opportunity_seed AS (
  SELECT *
  FROM (
    VALUES
      (
        'become-a-big',
        'big-brothers-big-sisters-atl',
        'big-brothers-big-sisters-atl',
        'Become a Big',
        'Mentor a young person through a structured long-term match in metro Atlanta.',
        'Long-term mentorship role with orientation, screening, and match support.',
        'ongoing',
        'multi_month',
        'screening_required',
        'School-year or multi-month mentorship commitment with orientation and match process.',
        'Metro Atlanta',
        ARRAY['mentoring'],
        ARRAY[]::text[],
        'low',
        NULL::integer,
        false,
        false,
        false,
        'Match placement depends on youth and volunteer accessibility needs.',
        true,
        true,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://bbbsatl.org/be-a-big/',
        'https://bbbsatl.org/be-a-big/',
        '{"cause":"youth_education"}'::jsonb
      ),
      (
        'power-lunch-reading-mentor',
        'everybody-wins-atlanta',
        'everybody-wins-atlanta',
        'Power Lunch Reading Mentor',
        'Read weekly with elementary students during the school year.',
        'School-based literacy role centered on consistent weekly reading support.',
        'ongoing',
        'multi_month',
        'training_required',
        'Weekly school-year commitment with orientation before classroom placement.',
        'Atlanta schools',
        ARRAY['reading','mentoring'],
        ARRAY[]::text[],
        'low',
        NULL::integer,
        false,
        false,
        false,
        'School placement and volunteer training details are coordinated by the organization.',
        false,
        true,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://everybodywinsatlanta.org/power-lunch/',
        'https://everybodywinsatlanta.org/power-lunch/',
        '{"cause":"youth_education"}'::jsonb
      ),
      (
        'volunteer-advocate',
        'atlanta-casa',
        'atlanta-casa',
        'Volunteer Advocate',
        'Advocate for children in foster care through court-appointed volunteer service.',
        'High-commitment advocacy role with screening, training, and case assignment.',
        'lead_role',
        'multi_month',
        'screening_required',
        'Multi-month case commitment with training and structured court advocacy responsibilities.',
        'Metro Atlanta',
        ARRAY['advocacy'],
        ARRAY[]::text[],
        'low',
        NULL::integer,
        false,
        false,
        false,
        'Training and case support are provided through Atlanta CASA.',
        true,
        true,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://atlantacasa.org/get-involved/become-a-volunteer/',
        'https://atlantacasa.org/get-involved/become-a-volunteer/',
        '{"cause":"family_support"}'::jsonb
      ),
      (
        'volunteer-tutor-and-mentor',
        'laamistad',
        'laamistad',
        'Volunteer Tutor and Mentor',
        'Support students and families through tutoring, mentoring, and education programs.',
        'Recurring education support role with placement based on program needs.',
        'ongoing',
        'multi_month',
        'light',
        'Weekly or recurring commitment based on tutoring and program placement.',
        'Metro Atlanta',
        ARRAY['tutoring','mentoring'],
        ARRAY['spanish'],
        'low',
        NULL::integer,
        false,
        false,
        false,
        'Bilingual volunteers may be especially useful depending on program placement.',
        false,
        false,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://laamistadinc.org/volunteer/',
        'https://laamistadinc.org/volunteer/',
        '{"cause":"education"}'::jsonb
      ),
      (
        'green-shirt-volunteer-pathway',
        'trees-atlanta',
        'trees-atlanta',
        'Green Shirt Volunteer Pathway',
        'Move from drop-in projects into repeat urban forestry leadership with Trees Atlanta.',
        'Ongoing volunteer pathway for people who want to build skills and return regularly.',
        'ongoing',
        'multi_month',
        'training_required',
        'Recurring service pathway following field experience and training milestones.',
        'Atlanta parks and neighborhoods',
        ARRAY['outdoors'],
        ARRAY[]::text[],
        'medium',
        NULL::integer,
        false,
        false,
        false,
        'Outdoor field work varies by project and season.',
        false,
        true,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://www.treesatlanta.org/volunteer-pathways/',
        'https://www.treesatlanta.org/volunteer-pathways/',
        '{"cause":"environment"}'::jsonb
      ),
      (
        'neighborhood-water-watch',
        'chattahoochee-riverkeeper',
        'chattahoochee-riverkeeper',
        'Neighborhood Water Watch',
        'Join recurring watershed monitoring and stewardship work across the metro area.',
        'Community science and river stewardship role for volunteers who want regular participation.',
        'ongoing',
        'multi_month',
        'training_required',
        'Recurring monitoring and stewardship schedule after training.',
        'Metro Atlanta watershed',
        ARRAY['outdoors','community_science'],
        ARRAY[]::text[],
        'medium',
        NULL::integer,
        false,
        false,
        false,
        'Field conditions vary by monitoring site and cleanup assignment.',
        false,
        true,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://chattahoochee.org/volunteer',
        'https://chattahoochee.org/volunteer',
        '{"cause":"environment"}'::jsonb
      ),
      (
        'recurring-kitchen-and-delivery-support',
        'open-hand-atlanta',
        'open-hand-atlanta',
        'Recurring Kitchen and Delivery Support',
        'Return regularly for meal prep, packing, or delivery support with Open Hand Atlanta.',
        'Repeat volunteer pathway across food preparation, packing, and service operations.',
        'ongoing',
        'multi_week',
        'light',
        'Recurring shifts available based on program and delivery needs.',
        'Atlanta service sites',
        ARRAY['food_service'],
        ARRAY[]::text[],
        'medium',
        NULL::integer,
        false,
        true,
        false,
        'Role selection depends on site and mobility requirements.',
        false,
        false,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://www.openhandatlanta.org/get-involved/volunteer/',
        'https://www.openhandatlanta.org/get-involved/volunteer/',
        '{"cause":"food_security"}'::jsonb
      ),
      (
        'park-stewardship-academy',
        'park-pride',
        'park-pride',
        'Park Stewardship Academy',
        'Develop into a neighborhood park leader through Park Pride training and stewardship work.',
        'Leadership-oriented stewardship pathway for volunteers ready to take on deeper responsibility.',
        'lead_role',
        'multi_month',
        'training_required',
        'Multi-session stewardship training followed by neighborhood park leadership work.',
        'Atlanta parks',
        ARRAY['leadership','outdoors'],
        ARRAY[]::text[],
        'medium',
        NULL::integer,
        false,
        false,
        false,
        'Outdoor sessions and neighborhood park work vary by site.',
        false,
        true,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://parkpride.org/we-can-help/park-stewardship-academy/',
        'https://parkpride.org/we-can-help/park-stewardship-academy/',
        '{"cause":"environment"}'::jsonb
      ),
      (
        'recurring-food-access-support',
        'atlanta-community-food-bank',
        'atlanta-community-food-bank',
        'Recurring Food Access Support',
        'Join repeat volunteer work supporting hunger relief operations across the food bank network.',
        'Ongoing volunteer pathway for warehouse, sorting, and distribution support.',
        'ongoing',
        'multi_week',
        'light',
        'Recurring shifts available based on site and distribution calendar.',
        'Metro Atlanta',
        ARRAY['food_service'],
        ARRAY[]::text[],
        'medium',
        NULL::integer,
        false,
        true,
        false,
        'Assignments vary by warehouse and partner distribution site.',
        false,
        false,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://www.acfb.org/volunteer/',
        'https://www.acfb.org/volunteer/',
        '{"cause":"food_security"}'::jsonb
      )
  ) AS seed(
    slug,
    org_slug,
    source_slug,
    title,
    summary,
    description,
    commitment_level,
    time_horizon,
    onboarding_level,
    schedule_summary,
    location_summary,
    skills_required,
    language_support,
    physical_demand,
    min_age,
    family_friendly,
    group_friendly,
    remote_allowed,
    accessibility_notes,
    background_check_required,
    training_required,
    capacity_total,
    capacity_remaining,
    urgency_level,
    starts_on,
    ends_on,
    application_url,
    source_url,
    metadata
  )
)
INSERT INTO volunteer_opportunities (
  slug,
  organization_id,
  source_id,
  portal_id,
  title,
  summary,
  description,
  commitment_level,
  time_horizon,
  onboarding_level,
  schedule_summary,
  location_summary,
  skills_required,
  language_support,
  physical_demand,
  min_age,
  family_friendly,
  group_friendly,
  remote_allowed,
  accessibility_notes,
  background_check_required,
  training_required,
  capacity_total,
  capacity_remaining,
  urgency_level,
  starts_on,
  ends_on,
  application_url,
  source_url,
  metadata,
  is_active
)
SELECT
  seed.slug,
  organizations.id,
  sources.id,
  (SELECT id FROM helpatl),
  seed.title,
  seed.summary,
  seed.description,
  seed.commitment_level,
  seed.time_horizon,
  seed.onboarding_level,
  seed.schedule_summary,
  seed.location_summary,
  seed.skills_required,
  seed.language_support,
  seed.physical_demand,
  seed.min_age,
  seed.family_friendly,
  seed.group_friendly,
  seed.remote_allowed,
  seed.accessibility_notes,
  seed.background_check_required,
  seed.training_required,
  seed.capacity_total,
  seed.capacity_remaining,
  seed.urgency_level,
  seed.starts_on,
  seed.ends_on,
  seed.application_url,
  seed.source_url,
  seed.metadata,
  true
FROM opportunity_seed AS seed
JOIN organizations
  ON organizations.slug = seed.org_slug
LEFT JOIN sources
  ON sources.slug = seed.source_slug
ON CONFLICT (slug) DO UPDATE SET
  organization_id = EXCLUDED.organization_id,
  source_id = EXCLUDED.source_id,
  portal_id = EXCLUDED.portal_id,
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  description = EXCLUDED.description,
  commitment_level = EXCLUDED.commitment_level,
  time_horizon = EXCLUDED.time_horizon,
  onboarding_level = EXCLUDED.onboarding_level,
  schedule_summary = EXCLUDED.schedule_summary,
  location_summary = EXCLUDED.location_summary,
  skills_required = EXCLUDED.skills_required,
  language_support = EXCLUDED.language_support,
  physical_demand = EXCLUDED.physical_demand,
  min_age = EXCLUDED.min_age,
  family_friendly = EXCLUDED.family_friendly,
  group_friendly = EXCLUDED.group_friendly,
  remote_allowed = EXCLUDED.remote_allowed,
  accessibility_notes = EXCLUDED.accessibility_notes,
  background_check_required = EXCLUDED.background_check_required,
  training_required = EXCLUDED.training_required,
  capacity_total = EXCLUDED.capacity_total,
  capacity_remaining = EXCLUDED.capacity_remaining,
  urgency_level = EXCLUDED.urgency_level,
  starts_on = EXCLUDED.starts_on,
  ends_on = EXCLUDED.ends_on,
  application_url = EXCLUDED.application_url,
  source_url = EXCLUDED.source_url,
  metadata = EXCLUDED.metadata,
  is_active = true,
  updated_at = now();
