-- ============================================
-- MIGRATION 318: HelpATL Family and Refugee Opportunities
-- ============================================
-- Adds structured family-support and refugee-support opportunities for local
-- Atlanta organizations with strong official volunteer pathways.

DO $$
DECLARE
  helpatl_id UUID;
BEGIN
  SELECT id INTO helpatl_id FROM portals WHERE slug = 'helpatl';

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
  VALUES
    (
      'new-american-pathways',
      'New American Pathways',
      'https://newamericanpathways.org/get-involved/',
      'organization',
      'monthly',
      true,
      'manual',
      helpatl_id
    ),
    (
      'our-house',
      'Our House',
      'https://oh.ourhousega.org/volunteer/',
      'organization',
      'monthly',
      true,
      'manual',
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

  INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
  SELECT s.id, helpatl_id, 'all'
  FROM sources s
  WHERE s.slug IN ('new-american-pathways', 'our-house')
  ON CONFLICT (source_id) DO UPDATE SET
    owner_portal_id = helpatl_id,
    share_scope = 'all',
    updated_at = now();

  INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
  SELECT helpatl_id, s.id, 'all', true
  FROM sources s
  WHERE s.slug IN ('new-american-pathways', 'our-house')
  ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE SET
    subscription_scope = 'all',
    is_active = true;
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
        'New American Pathways',
        'new-american-pathways',
        'community_group',
        'https://newamericanpathways.org/',
        'Atlanta refugee-resettlement and immigrant-support organization helping new Americans with education, social adjustment, career support, and community belonging.',
        ARRAY['community']
      ),
      (
        'Our House',
        'our-house',
        'community_group',
        'https://ourhousega.org/',
        'Atlanta organization working to end the cycle of family homelessness through shelter, early childhood support, and practical family-stability services.',
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
        'new-ap-bright-futures-volunteer',
        'new-american-pathways',
        'new-american-pathways',
        'Volunteer with Bright Futures After School',
        'Support refugee and immigrant students with homework, English skills, and enrichment through New American Pathways.',
        'New American Pathways invites volunteers to support its Bright Futures After School Program, where volunteers help refugee and immigrant students with academics, English development, and social adjustment. The published role requires a 3 to 4 month commitment and fingerprinting.',
        'ongoing',
        'multi_month',
        'screening_required',
        'Elementary and middle-school after-school support Monday through Thursday during the school year.',
        'Metro Atlanta school and youth-program settings',
        ARRAY['tutoring']::text[],
        ARRAY[]::text[],
        'low',
        NULL::integer,
        false,
        false,
        false,
        'Good fit for volunteers who want steady direct work with refugee and immigrant youth.',
        false,
        false,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://newamericanpathways.org/get-involved/',
        'https://newamericanpathways.org/get-involved/',
        '{"cause":"immigrant_refugee"}'::jsonb
      ),
      (
        'new-ap-job-ready-english-volunteer',
        'new-american-pathways',
        'new-american-pathways',
        'Volunteer with Job Ready English',
        'Help new Americans build English and workplace readiness through New American Pathways'' adult education programming.',
        'New American Pathways publishes volunteer openings connected to English-language and workforce-readiness support for new Americans. This pathway is a strong fit for volunteers who want recurring immigrant-support work beyond one-time donation or setup projects.',
        'ongoing',
        'multi_month',
        'light',
        'Recurring adult education and language-support role coordinated through New American Pathways volunteer intake.',
        'Metro Atlanta and possible remote support',
        ARRAY['tutoring']::text[],
        ARRAY[]::text[],
        'low',
        NULL::integer,
        false,
        false,
        true,
        'Useful for volunteers who prefer structured recurring support with adults and workforce readiness.',
        false,
        false,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://newamericanpathways.org/get-involved/',
        'https://newamericanpathways.org/our-programs',
        '{"cause":"immigrant_refugee"}'::jsonb
      ),
      (
        'our-house-meal-host',
        'our-house',
        'our-house',
        'Serve as an Our House Meal Host',
        'Help families experiencing homelessness by organizing or providing meals for Our House shelter residents.',
        'Our House recruits volunteers and groups to serve as meal hosts for families residing in its Atlanta shelter. The organization publishes this as one of its core volunteer pathways for direct family-support service.',
        'ongoing',
        'multi_week',
        'light',
        'Meal-host opportunities run Monday through Sunday for breakfast or dinner depending on shelter need.',
        'Atlanta shelter setting',
        ARRAY['food_service']::text[],
        ARRAY[]::text[],
        'medium',
        16,
        false,
        true,
        false,
        'Strong fit for individuals or groups who want a practical, recurring family-support role.',
        false,
        false,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://oh.ourhousega.org/volunteer/',
        'https://oh.ourhousega.org/volunteer/',
        '{"cause":"family_support"}'::jsonb
      ),
      (
        'our-house-virtual-storyteller',
        'our-house',
        'our-house',
        'Volunteer as a Virtual Storyteller',
        'Read and record age-appropriate stories for children enrolled in Our House early learning programs.',
        'Our House publishes a virtual storyteller pathway for community volunteers who want to support children in early learning programs through recorded or live story time sessions.',
        'ongoing',
        'multi_week',
        'light',
        'Flexible recurring remote or scheduled read-aloud support for early childhood programming.',
        'Remote and Atlanta family-support programming',
        ARRAY['reading']::text[],
        ARRAY[]::text[],
        'low',
        NULL::integer,
        false,
        false,
        true,
        'Good fit for volunteers who want family-support work that is lower-lift and compatible with remote participation.',
        false,
        false,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://oh.ourhousega.org/volunteer/',
        'https://oh.ourhousega.org/volunteer/',
        '{"cause":"family_support"}'::jsonb
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
  event_id,
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
  org.id,
  src.id,
  (SELECT id FROM helpatl),
  NULL::integer,
  seed.title,
  seed.summary,
  seed.description,
  seed.commitment_level::text,
  seed.time_horizon::text,
  seed.onboarding_level::text,
  seed.schedule_summary,
  seed.location_summary,
  seed.skills_required,
  seed.language_support,
  seed.physical_demand::text,
  seed.min_age,
  seed.family_friendly,
  seed.group_friendly,
  seed.remote_allowed,
  seed.accessibility_notes,
  seed.background_check_required,
  seed.training_required,
  seed.capacity_total,
  seed.capacity_remaining,
  seed.urgency_level::text,
  seed.starts_on,
  seed.ends_on,
  seed.application_url,
  seed.source_url,
  seed.metadata,
  true
FROM opportunity_seed seed
JOIN organizations org ON org.slug = seed.org_slug
LEFT JOIN sources src ON src.slug = seed.source_slug
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
