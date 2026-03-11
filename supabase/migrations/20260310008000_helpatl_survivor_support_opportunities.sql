-- 20260310008000_helpatl_survivor_support_opportunities.sql
-- Mirrors database/migrations/320_helpatl_survivor_support_opportunities.sql

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
      'partnership-against-domestic-violence',
      'Partnership Against Domestic Violence',
      'https://padv.org/',
      'organization',
      'monthly',
      true,
      'manual',
      helpatl_id
    ),
    (
      'atlanta-victim-assistance',
      'Atlanta Victim Assistance',
      'https://atlantava.org/get-involved/',
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
  WHERE s.slug IN ('partnership-against-domestic-violence', 'atlanta-victim-assistance')
  ON CONFLICT (source_id) DO UPDATE SET
    owner_portal_id = helpatl_id,
    share_scope = 'all',
    updated_at = now();

  INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
  SELECT helpatl_id, s.id, 'all', true
  FROM sources s
  WHERE s.slug IN ('partnership-against-domestic-violence', 'atlanta-victim-assistance')
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
        'Partnership Against Domestic Violence',
        'partnership-against-domestic-violence',
        'community_group',
        'https://padv.org/',
        'Atlanta survivor-support organization providing crisis intervention, safe housing, legal advocacy, children''s services, and support groups for survivors of intimate partner violence.',
        ARRAY['community']
      ),
      (
        'Atlanta Victim Assistance',
        'atlanta-victim-assistance',
        'community_group',
        'https://atlantava.org/',
        'Atlanta victim-services nonprofit that supports crime victims and their families through advocacy, court support, practical assistance, and community healing programs.',
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
        'padv-crisis-line-and-shelter-volunteer',
        'partnership-against-domestic-violence',
        'partnership-against-domestic-violence',
        'Support PADV Crisis Line and Shelter Programs',
        'Help survivors of intimate partner violence through crisis-line support, shelter service, and survivor-centered program work.',
        'PADV''s official volunteer materials say supporters can answer crisis lines, work in a shelter, assist with children''s programs, lead support groups, organize special events, and become legal advocates.',
        'ongoing',
        'multi_month',
        'training_required',
        'Recurring survivor-support role coordinated through PADV volunteer intake and training.',
        'Atlanta survivor-support and shelter settings',
        ARRAY['advocacy']::text[],
        ARRAY[]::text[],
        'medium',
        NULL::integer,
        false,
        false,
        false,
        'Best suited for volunteers prepared for confidential, survivor-centered support work.',
        false,
        true,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://padv.org/wp-content/uploads/2022/05/general-padv-brochure.pdf',
        'https://padv.org/wp-content/uploads/2022/05/general-padv-brochure.pdf',
        '{"cause":"family_support"}'::jsonb
      ),
      (
        'padv-childrens-program-support',
        'partnership-against-domestic-violence',
        'partnership-against-domestic-violence',
        'Support PADV Children and Family Programs',
        'Work with PADV programs that support children and caregivers rebuilding after violence.',
        'PADV''s official volunteer brochure explicitly lists assisting in children''s programs and leading survivor support groups as part of its volunteer opportunities, making this a direct family-support pathway rather than a generic donation role.',
        'ongoing',
        'multi_week',
        'light',
        'Program support role coordinated with PADV volunteer intake and survivor-services staff.',
        'Atlanta survivor-support settings',
        ARRAY['reading']::text[],
        ARRAY[]::text[],
        'low',
        NULL::integer,
        false,
        false,
        false,
        'Strong fit for volunteers who want survivor-support work centered on children and family recovery.',
        false,
        false,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://padv.org/wp-content/uploads/2022/05/general-padv-brochure.pdf',
        'https://padv.org/wp-content/uploads/2022/05/general-padv-brochure.pdf',
        '{"cause":"family_support"}'::jsonb
      ),
      (
        'ava-victim-support-volunteer',
        'atlanta-victim-assistance',
        'atlanta-victim-assistance',
        'Volunteer with Atlanta Victim Assistance',
        'Support crime victims and their families through Atlanta Victim Assistance''s volunteer program.',
        'Atlanta Victim Assistance publishes a formal volunteer program focused on advocating for the rights of crime victims, helping remove barriers, and supporting families as they move from victimization toward recovery.',
        'ongoing',
        'multi_week',
        'light',
        'Recurring volunteer intake coordinated through Atlanta Victim Assistance''s get-involved program.',
        'Atlanta Municipal Court and victim-support settings',
        ARRAY['advocacy']::text[],
        ARRAY[]::text[],
        'low',
        NULL::integer,
        false,
        false,
        false,
        'Useful for volunteers who want trauma-informed survivor-support work beyond legal services alone.',
        false,
        false,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://atlantava.org/get-involved/',
        'https://atlantava.org/get-involved/',
        '{"cause":"family_support"}'::jsonb
      ),
      (
        'ava-closet-and-resource-drive-support',
        'atlanta-victim-assistance',
        'atlanta-victim-assistance',
        'Support AVA''s Closet and Resource Drives',
        'Organize or contribute practical support drives that help victims with clothing, toiletries, and immediate basic needs.',
        'Atlanta Victim Assistance''s public get-involved page highlights AVA''s Closet and community support drives as a direct way to help restore dignity and stability for victims affected by crime.',
        'ongoing',
        'multi_week',
        'none',
        'Flexible support-drive and supply-collection role tied to AVA''s victim-support infrastructure.',
        'Atlanta',
        ARRAY['food_service']::text[],
        ARRAY[]::text[],
        'low',
        NULL::integer,
        false,
        true,
        true,
        'Good fit for volunteers or groups who want a lower-barrier survivor-support role with practical impact.',
        false,
        false,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://atlantava.org/get-involved/',
        'https://atlantava.org/get-involved/',
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
