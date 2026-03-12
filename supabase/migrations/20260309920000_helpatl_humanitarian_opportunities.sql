-- ============================================
-- MIGRATION 308: HelpATL Humanitarian Opportunity Expansion
-- ============================================
-- Adds structured volunteer roles for Hope Atlanta, IRC Atlanta, and Atlanta
-- Legal Aid, and activates/federates Atlanta Legal Aid as a real dated source.

DO $$
DECLARE
  helpatl_id UUID;
  atlanta_id UUID;
  atlanta_support_id UUID;
  legal_aid_source_id INTEGER;
BEGIN
  SELECT id INTO helpatl_id FROM portals WHERE slug = 'helpatl';
  SELECT id INTO atlanta_id FROM portals WHERE slug = 'atlanta';
  SELECT id INTO atlanta_support_id FROM portals WHERE slug = 'atlanta-support';

  IF helpatl_id IS NULL THEN
    RAISE NOTICE 'HelpATL portal not found. Skipping.';
    RETURN;
  END IF;

  UPDATE sources
  SET is_active = true,
      owner_portal_id = COALESCE(owner_portal_id, atlanta_support_id),
      integration_method = COALESCE(integration_method, 'scrape')
  WHERE slug = 'atlanta-legal-aid';

  SELECT id INTO legal_aid_source_id
  FROM sources
  WHERE slug = 'atlanta-legal-aid'
  LIMIT 1;

  IF legal_aid_source_id IS NOT NULL AND atlanta_support_id IS NOT NULL THEN
    INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
    VALUES (legal_aid_source_id, atlanta_support_id, 'all')
    ON CONFLICT (source_id) DO UPDATE SET
      owner_portal_id = atlanta_support_id,
      share_scope = 'all',
      updated_at = now();

    INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
    VALUES (helpatl_id, legal_aid_source_id, 'all', true)
    ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE SET
      subscription_scope = 'all',
      is_active = true;

    IF atlanta_id IS NOT NULL THEN
      INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
      VALUES (atlanta_id, legal_aid_source_id, 'all', true)
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
        'Hope Atlanta',
        'hope-atlanta',
        'community_group',
        'https://hopeatlanta.org/volunteer/',
        'Homelessness prevention and response nonprofit with volunteer opportunities at outreach and community support sites.',
        ARRAY['community']
      ),
      (
        'International Rescue Committee Atlanta',
        'irc-atlanta',
        'community_group',
        'https://www.rescue.org/volunteer-opportunities/atlanta-ga',
        'Refugee and immigrant support organization offering education, donations, transportation, and youth support volunteer roles.',
        ARRAY['community']
      ),
      (
        'Atlanta Legal Aid Society',
        'atlanta-legal-aid',
        'community_group',
        'https://atlantalegalaid.org/volunteer/',
        'Civil legal aid organization with pro bono training and volunteer opportunities supporting low-income residents.',
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
        'hope-community-kitchen-volunteer',
        'hope-atlanta',
        NULL::text,
        'Community Kitchen Volunteer',
        'Prepare and serve meals at Hope Atlanta''s Women''s Community Kitchen and Outreach Center.',
        'Direct-service volunteer role supporting neighbors experiencing homelessness through meal prep and meal service.',
        'ongoing',
        'multi_week',
        'light',
        'Volunteer shifts are scheduled through Hope Atlanta''s volunteer portal.',
        'Women''s Community Kitchen and Outreach Center, Atlanta',
        ARRAY['food_service'],
        ARRAY[]::text[],
        'medium',
        15,
        false,
        true,
        false,
        'Volunteers ages 15-17 must be accompanied by a parent or guardian.',
        false,
        false,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://volunteer.hopeatlanta.org/',
        'https://hopeatlanta.org/volunteer/',
        '{"cause":"housing"}'::jsonb
      ),
      (
        'hope-donation-sorting-support',
        'hope-atlanta',
        NULL::text,
        'Donation Sorting and Supply Support',
        'Receive, stock, and organize donated items for outreach and newly housed clients.',
        'Recurring support role helping Hope Atlanta keep essential supplies ready for people transitioning out of homelessness.',
        'ongoing',
        'multi_week',
        'light',
        'Volunteer shifts are scheduled through Hope Atlanta''s volunteer portal.',
        'Atlanta',
        ARRAY['organization'],
        ARRAY[]::text[],
        'low',
        15,
        false,
        true,
        false,
        'Volunteers ages 15-17 must be accompanied by a parent or guardian.',
        false,
        false,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://volunteer.hopeatlanta.org/',
        'https://hopeatlanta.org/volunteer/',
        '{"cause":"housing"}'::jsonb
      ),
      (
        'irc-donations-volunteer',
        'irc-atlanta',
        NULL::text,
        'Donations Volunteer',
        'Sort and prepare physical donations for refugee and immigrant families.',
        'Hands-on support role helping the IRC in Atlanta distribute essential donated goods to new arrivals.',
        'ongoing',
        'multi_week',
        'light',
        'Current role listing is marked ongoing on the IRC volunteer opportunities page.',
        'Atlanta',
        ARRAY['organization'],
        ARRAY[]::text[],
        'low',
        NULL::integer,
        false,
        false,
        false,
        'Role details and screening are managed through the IRC volunteer process.',
        false,
        false,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        DATE '2027-08-31',
        'https://www.rescue.org/volunteer-opportunities/atlanta-ga',
        'https://www.rescue.org/volunteer-opportunities/atlanta-ga',
        '{"cause":"immigrant_refugee"}'::jsonb
      ),
      (
        'irc-volunteer-driver',
        'irc-atlanta',
        NULL::text,
        'Volunteer Driver',
        'Provide transportation support to refugee and immigrant clients in metro Atlanta.',
        'Direct-service role helping clients reach appointments, services, and key resettlement milestones.',
        'ongoing',
        'multi_week',
        'screening_required',
        'Current role listing is marked ongoing on the IRC volunteer opportunities page.',
        'Metro Atlanta',
        ARRAY['transportation'],
        ARRAY[]::text[],
        'medium',
        NULL::integer,
        false,
        false,
        false,
        'Driver screening and volunteer onboarding are managed through the IRC volunteer process.',
        false,
        false,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        DATE '2027-08-31',
        'https://www.rescue.org/volunteer-opportunities/atlanta-ga',
        'https://www.rescue.org/volunteer-opportunities/atlanta-ga',
        '{"cause":"immigrant_refugee"}'::jsonb
      ),
      (
        'irc-esl-class-assistant',
        'irc-atlanta',
        NULL::text,
        'ESL Class Assistant',
        'Support English-language instruction for refugee and immigrant adults.',
        'Education-focused volunteer role helping adult learners build language skills needed for life and work in Atlanta.',
        'ongoing',
        'multi_month',
        'light',
        'Current role listing is marked ongoing on the IRC volunteer opportunities page.',
        'Atlanta and Gwinnett County',
        ARRAY['tutoring','mentoring'],
        ARRAY[]::text[],
        'low',
        NULL::integer,
        false,
        false,
        false,
        'Role details and placement vary by class site and program needs.',
        false,
        false,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        DATE '2027-08-31',
        'https://www.rescue.org/volunteer-opportunities/atlanta-ga',
        'https://www.rescue.org/volunteer-opportunities/atlanta-ga',
        '{"cause":"immigrant_refugee"}'::jsonb
      ),
      (
        'irc-youth-afterschool-tutor',
        'irc-atlanta',
        NULL::text,
        'Youth Afterschool Tutor',
        'Provide homework help and academic support for refugee and immigrant youth.',
        'Recurring tutoring role supporting academic success, enrichment, and college preparation for youth served by the IRC in Atlanta.',
        'ongoing',
        'multi_month',
        'light',
        'Current role listing is marked ongoing on the IRC volunteer opportunities page.',
        'Atlanta',
        ARRAY['tutoring','mentoring'],
        ARRAY[]::text[],
        'low',
        NULL::integer,
        false,
        false,
        false,
        'Program details are coordinated through the IRC volunteer process.',
        false,
        false,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        DATE '2027-08-31',
        'https://www.rescue.org/volunteer-opportunities/atlanta-ga',
        'https://www.rescue.org/volunteer-opportunities/atlanta-ga',
        '{"cause":"immigrant_refugee"}'::jsonb
      ),
      (
        'atlanta-legal-aid-pro-bono-volunteer',
        'atlanta-legal-aid',
        'atlanta-legal-aid',
        'Pro Bono Volunteer Attorney',
        'Take on civil legal matters through Atlanta Legal Aid''s pro bono program.',
        'High-skill volunteer role spanning brief services, clinics, and longer case representation for low-income residents.',
        'lead_role',
        'multi_month',
        'training_required',
        'Training, resources, and ongoing guidance are provided through the volunteer program.',
        'Metro Atlanta',
        ARRAY['advocacy','leadership'],
        ARRAY[]::text[],
        'low',
        NULL::integer,
        false,
        false,
        false,
        'Role is designed for attorneys and legal professionals engaging through the pro bono program.',
        false,
        true,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://atlantalegalaid.org/volunteer/',
        'https://atlantalegalaid.org/volunteer/',
        '{"cause":"legal_aid"}'::jsonb
      ),
      (
        'atlanta-legal-aid-tpo-training',
        'atlanta-legal-aid',
        'atlanta-legal-aid',
        'Representing Survivors at TPO Hearings Training',
        'Free volunteer training for attorneys and advocates supporting survivors at temporary protective order hearings.',
        'Upcoming pro bono training designed to prepare volunteers to support survivors through Atlanta-area protective order proceedings.',
        'lead_role',
        'multi_week',
        'training_required',
        'April 2, 2026, 9 am - 12 pm',
        'RedBud Blossom Family Justice Center, Marietta',
        ARRAY['advocacy'],
        ARRAY[]::text[],
        'low',
        NULL::integer,
        false,
        false,
        false,
        'Training is free and tied to future pro bono case support.',
        false,
        true,
        NULL::integer,
        NULL::integer,
        'urgent',
        DATE '2026-04-02',
        DATE '2026-04-02',
        'https://docs.google.com/forms/d/e/1FAIpQLSfKNKEBMr5f8gGIAtieN-Pqp1diVnaz9aj-cY8RZkiaCGPEsg/viewform?usp=header',
        'https://atlantalegalaid.org/volunteer/',
        '{"cause":"legal_aid"}'::jsonb
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
  ON seed.source_slug IS NOT NULL
 AND sources.slug = seed.source_slug
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
