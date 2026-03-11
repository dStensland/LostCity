-- 20260310004000_helpatl_metro_election_worker_opportunities.sql
-- Mirrors database/migrations/316_helpatl_metro_election_worker_opportunities.sql

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
      'fulton-county-elections',
      'Fulton County Registration and Elections',
      'https://fultoncountyga.gov/services/voting-and-elections/become-a-poll-worker',
      'organization',
      'monthly',
      true,
      'manual',
      helpatl_id
    ),
    (
      'dekalb-county-elections',
      'DeKalb County Voter Registration and Elections',
      'https://www.dekalbcountyga.gov/voter-registration-elections/poll-workers',
      'organization',
      'monthly',
      true,
      'manual',
      helpatl_id
    ),
    (
      'cobb-county-elections',
      'Cobb County Elections and Registration',
      'https://www.cobbcounty.org/elections/employment/poll-worker-jobs',
      'organization',
      'monthly',
      true,
      'manual',
      helpatl_id
    ),
    (
      'gwinnett-county-elections',
      'Gwinnett County Voter Registrations and Elections',
      'https://www.gwinnettcounty.com/departments/elections/becomeapollofficial',
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
  WHERE s.slug IN (
    'fulton-county-elections',
    'dekalb-county-elections',
    'cobb-county-elections',
    'gwinnett-county-elections'
  )
  ON CONFLICT (source_id) DO UPDATE SET
    owner_portal_id = helpatl_id,
    share_scope = 'all',
    updated_at = now();

  INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
  SELECT helpatl_id, s.id, 'all', true
  FROM sources s
  WHERE s.slug IN (
    'fulton-county-elections',
    'dekalb-county-elections',
    'cobb-county-elections',
    'gwinnett-county-elections'
  )
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
    'Metro Atlanta',
    (SELECT id FROM helpatl)
  FROM (
    VALUES
      (
        'Fulton County Registration and Elections',
        'fulton-county-elections',
        'government',
        'https://fultoncountyga.gov/services/voting-and-elections',
        'Official Fulton County department responsible for election administration, poll workers, and voter operations.',
        ARRAY['community']
      ),
      (
        'DeKalb County Voter Registration and Elections',
        'dekalb-county-elections',
        'government',
        'https://www.dekalbcountyga.gov/voter-registration-elections',
        'Official DeKalb County department responsible for election administration and poll worker recruitment.',
        ARRAY['community']
      ),
      (
        'Cobb County Elections and Registration',
        'cobb-county-elections',
        'government',
        'https://www.cobbcounty.org/elections',
        'Official Cobb County elections department responsible for registration, election administration, and poll worker hiring.',
        ARRAY['community']
      ),
      (
        'Gwinnett County Voter Registrations and Elections',
        'gwinnett-county-elections',
        'government',
        'https://www.gwinnettcounty.com/departments/elections',
        'Official Gwinnett County elections department responsible for election administration and poll official recruitment.',
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
        'fulton-county-poll-worker',
        'fulton-county-elections',
        'fulton-county-elections',
        'Become a Fulton County Poll Worker',
        'Help staff polling places and support election operations in Fulton County.',
        'Official poll-worker pathway through Fulton County Registration and Elections. The county recruits civic-minded residents to serve voters at polling locations and help run elections smoothly.',
        'ongoing',
        'multi_week',
        'training_required',
        'Election-cycle role with required training and Election Day service.',
        'Fulton County polling locations',
        ARRAY['leadership']::text[],
        ARRAY[]::text[],
        'medium',
        NULL::integer,
        false,
        false,
        false,
        'Best fit for residents who want hands-on election administration experience.',
        false,
        true,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://fultoncountyga.gov/services/voting-and-elections/become-a-poll-worker',
        'https://fultoncountyga.gov/services/voting-and-elections/become-a-poll-worker',
        '{"cause":"civic_engagement"}'::jsonb
      ),
      (
        'dekalb-county-poll-worker',
        'dekalb-county-elections',
        'dekalb-county-elections',
        'Become a DeKalb County Poll Worker',
        'Serve voters in DeKalb County by working at polling places during elections.',
        'Official poll-worker pathway through DeKalb County Voter Registration and Elections. The county recruits election workers and publishes requirements, training expectations, and election-day responsibilities.',
        'ongoing',
        'multi_week',
        'training_required',
        'Election-cycle role with training before assigned Election Day work.',
        'DeKalb County polling locations',
        ARRAY['leadership']::text[],
        ARRAY[]::text[],
        'medium',
        16,
        false,
        false,
        false,
        'DeKalb publishes specific eligibility requirements, including youth poll-worker eligibility.',
        false,
        true,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://www.dekalbcountyga.gov/voter-registration-elections/poll-workers',
        'https://www.dekalbcountyga.gov/voter-registration-elections/poll-workers',
        '{"cause":"civic_engagement"}'::jsonb
      ),
      (
        'cobb-county-poll-worker',
        'cobb-county-elections',
        'cobb-county-elections',
        'Become a Cobb County Poll Worker',
        'Work at Cobb County polling places and support safe, orderly voting operations.',
        'Official poll-worker employment pathway through Cobb County Elections and Registration. The county hires and trains poll workers for election operations throughout Cobb.',
        'ongoing',
        'multi_week',
        'training_required',
        'Election-cycle paid role with pre-election training and polling-place assignments.',
        'Cobb County polling locations',
        ARRAY['leadership']::text[],
        ARRAY[]::text[],
        'medium',
        16,
        false,
        false,
        false,
        'Useful for residents seeking a hands-on civic role tied directly to election administration.',
        false,
        true,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://www.cobbcounty.org/elections/employment/poll-worker-jobs',
        'https://www.cobbcounty.org/elections/employment/poll-worker-jobs',
        '{"cause":"civic_engagement"}'::jsonb
      ),
      (
        'gwinnett-county-poll-official',
        'gwinnett-county-elections',
        'gwinnett-county-elections',
        'Become a Gwinnett County Poll Official',
        'Serve as a poll official and help administer elections in Gwinnett County.',
        'Official poll-official pathway through Gwinnett County Voter Registrations and Elections. The county recruits residents for precinct roles that support voter check-in, ballot handling, and election operations.',
        'ongoing',
        'multi_week',
        'training_required',
        'Election-cycle service role with county training and precinct assignments.',
        'Gwinnett County polling locations',
        ARRAY['leadership']::text[],
        ARRAY[]::text[],
        'medium',
        NULL::integer,
        false,
        false,
        false,
        'Appropriate for residents who want to support election operations directly rather than through advocacy alone.',
        false,
        true,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://www.gwinnettcounty.com/departments/elections/becomeapollofficial',
        'https://www.gwinnettcounty.com/departments/elections/becomeapollofficial',
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
