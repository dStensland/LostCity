-- ============================================
-- MIGRATION 309: HelpATL Civic Participation Wave 2
-- ============================================
-- Adds Common Cause Georgia as a dated civic action source and seeds
-- structured civic participation roles for Common Cause Georgia and
-- Canopy Atlanta Documenters.

DO $$
DECLARE
  helpatl_id UUID;
  atlanta_id UUID;
  common_cause_source_id INTEGER;
BEGIN
  SELECT id INTO helpatl_id FROM portals WHERE slug = 'helpatl';
  SELECT id INTO atlanta_id FROM portals WHERE slug = 'atlanta';

  IF helpatl_id IS NULL THEN
    RAISE NOTICE 'HelpATL portal not found. Skipping.';
    RETURN;
  END IF;

  INSERT INTO sources (
    slug,
    name,
    url,
    source_type,
    crawl_frequency,
    is_active,
    integration_method,
    owner_portal_id
  )
  VALUES (
    'common-cause-georgia',
    'Common Cause Georgia',
    'https://www.commoncause.org/georgia/events/',
    'organization',
    'daily',
    true,
    'scrape',
    helpatl_id
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    source_type = EXCLUDED.source_type,
    crawl_frequency = EXCLUDED.crawl_frequency,
    is_active = true,
    integration_method = EXCLUDED.integration_method,
    owner_portal_id = helpatl_id;

  SELECT id INTO common_cause_source_id
  FROM sources
  WHERE slug = 'common-cause-georgia'
  LIMIT 1;

  IF common_cause_source_id IS NOT NULL THEN
    INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
    VALUES (common_cause_source_id, helpatl_id, 'all')
    ON CONFLICT (source_id) DO UPDATE SET
      owner_portal_id = helpatl_id,
      share_scope = 'all',
      updated_at = now();

    INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
    VALUES (helpatl_id, common_cause_source_id, 'all', true)
    ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE SET
      subscription_scope = 'all',
      is_active = true;

    IF atlanta_id IS NOT NULL THEN
      INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
      VALUES (atlanta_id, common_cause_source_id, 'all', true)
      ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE SET
        subscription_scope = 'all',
        is_active = true;
    END IF;
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
        'Common Cause Georgia',
        'common-cause-georgia',
        'community_group',
        'https://www.commoncause.org/georgia/',
        'Democracy and accountability organization focused on voting rights, public process, and civic action in Georgia.',
        ARRAY['community']
      ),
      (
        'Canopy Atlanta',
        'canopy-atlanta',
        'community_group',
        'https://canopyatlanta.org/documenters/',
        'Community journalism nonprofit that trains and pays residents to document civic meetings and keep Atlanta neighborhoods informed.',
        ARRAY['community', 'learning']
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
        'common-cause-georgia-volunteer-team',
        'common-cause-georgia',
        'common-cause-georgia',
        'Volunteer Team Member',
        'Join Common Cause Georgia''s volunteer team for democracy actions, outreach, and civic mobilization.',
        'Recurring civic participation role connected to Democracy Squad calls, advocacy days, and issue campaigns across Georgia.',
        'ongoing',
        'multi_month',
        'light',
        'Biweekly calls and periodic action days coordinated through Common Cause Georgia and Mobilize.',
        'Atlanta and online',
        ARRAY['advocacy'],
        ARRAY[]::text[],
        'low',
        NULL::integer,
        false,
        false,
        true,
        'Many actions can be joined remotely, with some in-person opportunities at the Capitol or public meetings.',
        false,
        false,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://www.mobilize.us/commoncause/event/634016/',
        'https://www.commoncause.org/georgia/take-action/',
        '{"cause":"civic_engagement"}'::jsonb
      ),
      (
        'canopy-atlanta-documenter',
        'canopy-atlanta',
        NULL::text,
        'Atlanta Documenter',
        'Train with Canopy Atlanta and get paid to document public meetings that affect Atlanta neighborhoods.',
        'Structured civic journalism pathway with workshops, meeting assignments, and reporting support through the Atlanta Documenters program.',
        'ongoing',
        'ongoing',
        'training_required',
        'Start with trainings, then join paid meeting assignments and the Documenters network.',
        'Atlanta neighborhoods and civic meetings',
        ARRAY['journalism'],
        ARRAY[]::text[],
        'low',
        NULL::integer,
        false,
        false,
        false,
        'Training and participation pathways are coordinated through Documenters.org and Canopy Atlanta.',
        false,
        true,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://atlanta-ga.documenters.org/become-a-documenter/',
        'https://canopyatlanta.org/documenters/',
        '{"cause":"civic_engagement"}'::jsonb
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

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
