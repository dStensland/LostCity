-- 20260310001000_helpatl_official_boards_commissions_opportunities.sql
-- Mirrors database/migrations/313_helpatl_official_boards_commissions_opportunities.sql

DO $$
DECLARE
  helpatl_id UUID;
  atlanta_id UUID;
  boards_source_id INTEGER;
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
    'atlanta-boards-commissions',
    'City of Atlanta Boards and Commissions',
    'https://www.atlantaga.gov/government/boards-and-commissions',
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

  SELECT id INTO boards_source_id
  FROM sources
  WHERE slug = 'atlanta-boards-commissions'
  LIMIT 1;

  IF boards_source_id IS NOT NULL THEN
    INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
    VALUES (boards_source_id, helpatl_id, 'all')
    ON CONFLICT (source_id) DO UPDATE SET
      owner_portal_id = helpatl_id,
      share_scope = 'all',
      updated_at = now();

    INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
    VALUES (helpatl_id, boards_source_id, 'all', true)
    ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE SET
      subscription_scope = 'all',
      is_active = true;

    IF atlanta_id IS NOT NULL THEN
      INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
      VALUES (atlanta_id, boards_source_id, 'all', true)
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
        'City of Atlanta Boards and Commissions',
        'city-of-atlanta-boards-commissions',
        'government',
        'https://www.atlantaga.gov/government/boards-and-commissions',
        'Official City of Atlanta boards and commissions participation surface covering board applications, BACE appointment materials, and related civic service pathways.',
        ARRAY['community']
      ),
      (
        'City of Atlanta Commission on Aging',
        'city-of-atlanta-commission-on-aging',
        'government',
        'https://www.atlantaga.gov/government/boards-and-commissions/city-of-atlanta-commission-on-aging/commission-on-aging-2026-meeting-schedule',
        'Official City of Atlanta commission focused on aging issues, with recurring public meetings and opportunities for residents to participate in policy discussion.',
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
        'atlanta-board-commission-seat-applicant',
        'city-of-atlanta-boards-commissions',
        'atlanta-boards-commissions',
        'Apply for a City Board or Commission Seat',
        'Submit materials to be considered for service on a City of Atlanta board, authority, commission, or related body.',
        'Official participation path for residents who want to serve in a lead civic role. The city''s boards and commissions application flow routes applicants through the BACE process and municipal clerk materials.',
        'lead_role',
        'multi_month',
        'screening_required',
        'Review openings, complete the board application flow, and submit requested materials through the official city process.',
        'City of Atlanta',
        ARRAY['leadership']::text[],
        ARRAY[]::text[],
        'low',
        NULL::integer,
        false,
        false,
        true,
        'Applicants should expect an appointment and review process rather than instant placement.',
        false,
        false,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://www.atlantaga.gov/government/boards-and-commissions/application-for-board-membership',
        'https://www.atlantaga.gov/government/boards-and-commissions',
        '{"cause":"civic_engagement"}'::jsonb
      ),
      (
        'atlanta-bace-appointment-process',
        'city-of-atlanta-boards-commissions',
        'atlanta-boards-commissions',
        'Complete the BACE Appointment Process',
        'Prepare your BACE contact form, resume, and board preferences for the City of Atlanta appointment workflow.',
        'Official BACE participation path for residents pursuing appointments. The municipal clerk instructions call for a signed BACE Contact Information form, a resume, and stated board preferences submitted through the city''s appointment channel.',
        'lead_role',
        'multi_week',
        'light',
        'Gather your materials, complete the BACE information form, and submit them through the official city contact path.',
        'City of Atlanta',
        ARRAY['leadership']::text[],
        ARRAY[]::text[],
        'low',
        NULL::integer,
        false,
        false,
        true,
        'The official process includes document submission and follow-up through the municipal clerk''s BACE channel.',
        false,
        false,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://www.atlantaga.gov/home/showpublisheddocument/14346/637031172570370000',
        'https://citycouncil.atlantaga.gov/council-divisions/municipal-clerk/board-authority-commission-etc-bace',
        '{"cause":"civic_engagement"}'::jsonb
      ),
      (
        'atlanta-commission-on-aging-public-meetings',
        'city-of-atlanta-commission-on-aging',
        'atlanta-boards-commissions',
        'Attend Commission on Aging Public Meetings',
        'Join the public meetings of the City of Atlanta Commission on Aging and weigh in on issues affecting older adults in the city.',
        'Official civic participation pathway for residents who want regular input on aging policy. The public meeting schedule lists recurring meetings on the third Tuesday of each month at the C.T. Martin Natatorium and Recreation Center.',
        'ongoing',
        'ongoing',
        'none',
        'Recurring monthly public meetings, currently listed for the third Tuesday at 10:00 AM.',
        'C.T. Martin Natatorium and Recreation Center, Atlanta',
        ARRAY['advocacy']::text[],
        ARRAY[]::text[],
        'low',
        NULL::integer,
        false,
        false,
        false,
        'Meeting participation is public-facing and does not require a formal appointment to attend.',
        false,
        false,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://www.atlantaga.gov/government/boards-and-commissions/city-of-atlanta-commission-on-aging/commission-on-aging-2026-meeting-schedule',
        'https://www.atlantaga.gov/government/boards-and-commissions/city-of-atlanta-commission-on-aging/commission-on-aging-2026-meeting-schedule',
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
