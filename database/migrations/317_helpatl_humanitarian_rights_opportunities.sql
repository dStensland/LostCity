-- ============================================
-- MIGRATION 317: HelpATL Humanitarian Rights Opportunities
-- ============================================
-- Adds structured humanitarian/community-rights opportunities for local
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
      'avlf',
      'Atlanta Volunteer Lawyers Foundation',
      'https://avlf.org/volunteer',
      'organization',
      'monthly',
      true,
      'manual',
      helpatl_id
    ),
    (
      'pad-atlanta',
      'Policing Alternatives & Diversion Initiative',
      'https://www.atlantapad.org/volunteer',
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
  WHERE s.slug IN ('avlf', 'pad-atlanta')
  ON CONFLICT (source_id) DO UPDATE SET
    owner_portal_id = helpatl_id,
    share_scope = 'all',
    updated_at = now();

  INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
  SELECT helpatl_id, s.id, 'all', true
  FROM sources s
  WHERE s.slug IN ('avlf', 'pad-atlanta')
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
        'Atlanta Volunteer Lawyers Foundation',
        'atlanta-volunteer-lawyers-foundation',
        'community_group',
        'https://avlf.org/',
        'Atlanta nonprofit that mobilizes pro bono legal services and community volunteers to support tenants, survivors of intimate partner abuse, and families seeking safe and stable homes.',
        ARRAY['community']
      ),
      (
        'Policing Alternatives & Diversion Initiative',
        'pad-atlanta',
        'community_group',
        'https://www.atlantapad.org/',
        'Atlanta nonprofit providing community response, diversion, and care navigation for people facing extreme poverty, behavioral health challenges, and housing instability.',
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
        'avlf-saturday-lawyer-program',
        'atlanta-volunteer-lawyers-foundation',
        'avlf',
        'Volunteer with the Saturday Lawyer Program',
        'Help Atlanta tenants facing eviction and unsafe housing through AVLF''s long-running Saturday legal clinic.',
        'AVLF''s Saturday Lawyer Program brings together volunteer attorneys, law students, paralegals, and community partners to help renters protect their homes and navigate housing instability.',
        'ongoing',
        'multi_week',
        'light',
        'Recurring Saturday-morning clinic support with legal and intake roles depending on experience.',
        'Atlanta and Fulton County housing court / clinic settings',
        ARRAY['advocacy']::text[],
        ARRAY[]::text[],
        'low',
        NULL::integer,
        false,
        true,
        false,
        'Open to attorneys, law students, paralegals, and community volunteers depending on the role.',
        false,
        false,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://avlf.org/programs/saturday-lawyer-program',
        'https://avlf.org/volunteer',
        '{"cause":"legal_aid"}'::jsonb
      ),
      (
        'avlf-protective-order-advocate',
        'atlanta-volunteer-lawyers-foundation',
        'avlf',
        'Support Survivors Seeking Protective Orders',
        'Stand with survivors of intimate partner abuse through AVLF''s protective-order and family-stability volunteer pathways.',
        'AVLF recruits volunteer attorneys and other supporters for programs that help survivors pursue protective orders and stabilize their families with legal and social-work support.',
        'ongoing',
        'multi_month',
        'training_required',
        'Recurring representation and support role coordinated with AVLF staff attorneys and survivor-support teams.',
        'Atlanta court and survivor-support settings',
        ARRAY['advocacy']::text[],
        ARRAY[]::text[],
        'low',
        NULL::integer,
        false,
        false,
        false,
        'Best suited for volunteers prepared for survivor-centered legal and advocacy work.',
        false,
        true,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://avlf.org/volunteer',
        'https://avlf.org/volunteer',
        '{"cause":"legal_aid"}'::jsonb
      ),
      (
        'pad-community-response-volunteer',
        'pad-atlanta',
        'pad-atlanta',
        'Volunteer with PAD Community Response',
        'Support Atlanta''s non-carceral community response work by helping PAD teams prepare supplies and respond to urgent neighborhood needs.',
        'PAD volunteers can support Community Response by preparing snack bags, stocking vans, and helping sustain the organization''s direct response to extreme poverty, substance use, and mental health concerns in Atlanta.',
        'ongoing',
        'multi_week',
        'light',
        'Volunteer orientations run on the fourth Tuesday and fourth Saturday of each month.',
        'Atlanta',
        ARRAY['advocacy']::text[],
        ARRAY[]::text[],
        'medium',
        NULL::integer,
        false,
        true,
        false,
        'Good fit for people who want practical humanitarian work tied to poverty response and community safety.',
        false,
        false,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://www.atlantapad.org/volunteer',
        'https://www.atlantapad.org/volunteer',
        '{"cause":"housing"}'::jsonb
      ),
      (
        'pad-care-navigation-volunteer',
        'pad-atlanta',
        'pad-atlanta',
        'Volunteer with PAD Care Navigation',
        'Help sustain PAD''s Living Room, Clothing Closet, and daily-living support for people facing crisis and instability.',
        'PAD''s volunteer program includes Care Navigation support through the Living Room, Clothing Closet, daily living workshops, and other practical care settings for people impacted by poverty and instability.',
        'ongoing',
        'multi_week',
        'light',
        'Volunteer orientations run twice monthly before assignment into care-navigation support roles.',
        'Atlanta',
        ARRAY['advocacy']::text[],
        ARRAY[]::text[],
        'medium',
        NULL::integer,
        false,
        true,
        false,
        'Useful for volunteers who want direct-service humanitarian work rather than policy-only engagement.',
        false,
        false,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://www.atlantapad.org/volunteer',
        'https://www.atlantapad.org/volunteer',
        '{"cause":"housing"}'::jsonb
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
