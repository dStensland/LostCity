-- ============================================
-- MIGRATION 319: HelpATL Health and Public Health Opportunities
-- ============================================
-- Adds structured health/public-health volunteer pathways for HelpATL.

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
      'dekalb-medical-reserve-corps',
      'DeKalb County Medical Reserve Corps',
      'https://www.dekalbpublichealth.com/services/emergency-preparedness/medical-reserve-corps/',
      'organization',
      'monthly',
      true,
      'manual',
      helpatl_id
    ),
    (
      'red-cross-georgia',
      'American Red Cross Georgia Region',
      'https://www.redcross.org/local/georgia/volunteer.html',
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
  WHERE s.slug IN ('dekalb-medical-reserve-corps', 'red-cross-georgia')
  ON CONFLICT (source_id) DO UPDATE SET
    owner_portal_id = helpatl_id,
    share_scope = 'all',
    updated_at = now();

  INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
  SELECT helpatl_id, s.id, 'all', true
  FROM sources s
  WHERE s.slug IN ('medshare', 'dekalb-medical-reserve-corps', 'red-cross-georgia')
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
        'MedShare',
        'medshare',
        'community_group',
        'https://www.medshare.org/',
        'Medical humanitarian organization that sorts, packs, and redistributes surplus medical supplies and equipment to support health systems locally and globally.',
        ARRAY['community']
      ),
      (
        'DeKalb County Medical Reserve Corps',
        'dekalb-medical-reserve-corps',
        'government',
        'https://www.dekalbpublichealth.com/services/emergency-preparedness/medical-reserve-corps/',
        'Official DeKalb County public-health volunteer corps that trains residents to support emergency preparedness, public-health response, and community resilience.',
        ARRAY['community']
      ),
      (
        'American Red Cross Greater Atlanta',
        'american-red-cross-greater-atlanta',
        'community_group',
        'https://www.redcross.org/local/georgia/about-us/locations/greater-atlanta.html',
        'Local Red Cross humanitarian network serving metro Atlanta through disaster response, sheltering, blood services, and emergency support.',
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
        'medshare-medical-supply-volunteer',
        'medshare',
        'medshare',
        'Volunteer with MedShare Medical Supply Processing',
        'Sort, inspect, and pack medical supplies for humanitarian distribution through MedShare''s Atlanta center.',
        'MedShare publishes recurring volunteer sessions in Atlanta focused on sorting and packing surplus medical supplies and equipment so they can be redistributed to healthcare partners and humanitarian missions.',
        'ongoing',
        'multi_week',
        'light',
        'Recurring weekday and weekend volunteer sessions at the Atlanta MedShare facility.',
        'MedShare Atlanta',
        ARRAY['community_science']::text[],
        ARRAY[]::text[],
        'medium',
        10,
        true,
        true,
        false,
        'Good fit for volunteers who want hands-on medical humanitarian work without clinical licensure.',
        false,
        false,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://www.medshare.org/volunteer/atlanta/',
        'https://www.medshare.org/volunteer/atlanta/',
        '{"cause":"health_wellness"}'::jsonb
      ),
      (
        'dekalb-medical-reserve-corps-volunteer',
        'dekalb-medical-reserve-corps',
        'dekalb-medical-reserve-corps',
        'Join the DeKalb Medical Reserve Corps',
        'Train to support public-health preparedness, emergency response, and community resilience in DeKalb County.',
        'The DeKalb County Medical Reserve Corps recruits medical and non-medical volunteers to strengthen public-health emergency response capacity and support preparedness efforts across the county.',
        'ongoing',
        'multi_month',
        'training_required',
        'Training-based public-health volunteer corps with activation during preparedness and response efforts.',
        'DeKalb County',
        ARRAY['leadership']::text[],
        ARRAY[]::text[],
        'medium',
        NULL::integer,
        false,
        false,
        false,
        'Open to both medical and non-medical volunteers who want an official public-health service role.',
        false,
        true,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://www.dekalbpublichealth.com/services/emergency-preparedness/medical-reserve-corps/',
        'https://www.dekalbpublichealth.com/services/emergency-preparedness/medical-reserve-corps/',
        '{"cause":"health_wellness"}'::jsonb
      ),
      (
        'red-cross-shelter-hero',
        'american-red-cross-greater-atlanta',
        'red-cross-georgia',
        'Volunteer as a Red Cross Shelter Hero',
        'Help open, staff, and support emergency shelters for people displaced by disasters in Georgia.',
        'The American Red Cross Georgia Region recruits Shelter Heroes to help communities recover when families are displaced by home fires, storms, and other emergencies.',
        'ongoing',
        'multi_week',
        'training_required',
        'On-call disaster service role with training before deployment into shelter operations.',
        'Metro Atlanta and Georgia disaster-response settings',
        ARRAY['leadership']::text[],
        ARRAY[]::text[],
        'medium',
        NULL::integer,
        false,
        false,
        false,
        'Strong fit for volunteers who want emergency-response work that directly supports health, safety, and shelter needs.',
        false,
        true,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://www.redcross.org/local/georgia/volunteer.html',
        'https://www.redcross.org/local/georgia/volunteer.html',
        '{"cause":"health_wellness"}'::jsonb
      ),
      (
        'red-cross-disaster-action-team',
        'american-red-cross-greater-atlanta',
        'red-cross-georgia',
        'Join the Red Cross Disaster Action Team',
        'Respond to local home fires and other urgent emergencies as part of the Red Cross disaster-response network.',
        'The American Red Cross recruits Disaster Action Team volunteers to respond to urgent local crises, provide immediate support to affected households, and connect people to recovery resources.',
        'ongoing',
        'multi_month',
        'training_required',
        'On-call response role with training and periodic activation for local emergencies.',
        'Metro Atlanta and Georgia',
        ARRAY['leadership']::text[],
        ARRAY[]::text[],
        'medium',
        NULL::integer,
        false,
        false,
        false,
        'Useful for volunteers who want a serious recurring role in humanitarian emergency response.',
        false,
        true,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://www.redcross.org/local/georgia/volunteer.html',
        'https://www.redcross.org/local/georgia/volunteer.html',
        '{"cause":"health_wellness"}'::jsonb
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
