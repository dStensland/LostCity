-- ============================================
-- MIGRATION 344: HelpATL Activist Sources Wave 9
-- ============================================
-- Adds Fair Count as a live Mobilize-backed civic action source, registers
-- Georgia STAND-UP as a tracked activist event source, updates New Georgia
-- Project's source metadata away from its dead events page, and seeds
-- structured civic-engagement opportunities for Georgia STAND-UP, New Georgia
-- Project, Fair Fight, and Fair Count.

DO $$
DECLARE
  helpatl_id UUID;
  atlanta_id UUID;
  fair_count_source_id INTEGER;
  georgia_stand_up_source_id INTEGER;
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
  VALUES
    (
      'fair-count',
      'Fair Count',
      'https://www.mobilize.us/faircount/',
      'mobilize',
      'daily',
      true,
      'scrape',
      helpatl_id
    ),
    (
      'georgia-stand-up',
      'Georgia STAND-UP',
      'https://www.georgiastandup.org/event-list',
      'organization',
      'daily',
      true,
      'scrape',
      helpatl_id
    ),
    (
      'fair-fight',
      'Fair Fight',
      'https://fairfight.com/volunteer',
      'organization',
      'weekly',
      false,
      'scrape',
      helpatl_id
    ),
    (
      'new-georgia-project',
      'New Georgia Project',
      'https://newgeorgiaproject.org/get-involved/',
      'organization',
      'weekly',
      false,
      'scrape',
      helpatl_id
    )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    source_type = EXCLUDED.source_type,
    crawl_frequency = EXCLUDED.crawl_frequency,
    is_active = CASE
      WHEN EXCLUDED.slug IN ('fair-count', 'georgia-stand-up') THEN true
      ELSE false
    END,
    integration_method = EXCLUDED.integration_method,
    owner_portal_id = helpatl_id;

  SELECT id INTO fair_count_source_id
  FROM sources
  WHERE slug = 'fair-count'
  LIMIT 1;

  SELECT id INTO georgia_stand_up_source_id
  FROM sources
  WHERE slug = 'georgia-stand-up'
  LIMIT 1;

  IF fair_count_source_id IS NOT NULL THEN
    INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
    VALUES (fair_count_source_id, helpatl_id, 'all')
    ON CONFLICT (source_id) DO UPDATE SET
      owner_portal_id = helpatl_id,
      share_scope = 'all',
      updated_at = now();

    INSERT INTO source_subscriptions (
      subscriber_portal_id,
      source_id,
      subscription_scope,
      is_active
    )
    VALUES (helpatl_id, fair_count_source_id, 'all', true)
    ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE SET
      subscription_scope = 'all',
      is_active = true;

    IF atlanta_id IS NOT NULL THEN
      INSERT INTO source_subscriptions (
        subscriber_portal_id,
        source_id,
        subscription_scope,
        is_active
      )
      VALUES (atlanta_id, fair_count_source_id, 'all', true)
      ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE SET
        subscription_scope = 'all',
        is_active = true;
    END IF;
  END IF;

  IF georgia_stand_up_source_id IS NOT NULL THEN
    INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
    VALUES (georgia_stand_up_source_id, helpatl_id, 'all')
    ON CONFLICT (source_id) DO UPDATE SET
      owner_portal_id = helpatl_id,
      share_scope = 'all',
      updated_at = now();

    INSERT INTO source_subscriptions (
      subscriber_portal_id,
      source_id,
      subscription_scope,
      is_active
    )
    VALUES (helpatl_id, georgia_stand_up_source_id, 'all', true)
    ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE SET
      subscription_scope = 'all',
      is_active = true;

    IF atlanta_id IS NOT NULL THEN
      INSERT INTO source_subscriptions (
        subscriber_portal_id,
        source_id,
        subscription_scope,
        is_active
      )
      VALUES (atlanta_id, georgia_stand_up_source_id, 'all', true)
      ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE SET
        subscription_scope = 'all',
        is_active = true;
    END IF;
  END IF;

  INSERT INTO venues (
    name,
    slug,
    address,
    neighborhood,
    city,
    state,
    zip,
    lat,
    lng,
    venue_type,
    spot_type,
    website
  )
  VALUES (
    'Georgia STAND-UP',
    'georgia-stand-up',
    'Atlanta, GA',
    'Citywide',
    'Atlanta',
    'GA',
    '30303',
    33.7490,
    -84.3880,
    'organization',
    'organization',
    'https://www.georgiastandup.org'
  )
  ON CONFLICT (slug) DO NOTHING;
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
        'Georgia STAND-UP',
        'georgia-stand-up',
        'community_group',
        'https://www.georgiastandup.org/',
        'Metro Atlanta civic organizing group focused on worker power, transit equity, voter engagement, and community-led advocacy.',
        ARRAY['community']
      ),
      (
        'New Georgia Project',
        'new-georgia-project',
        'community_group',
        'https://newgeorgiaproject.org/',
        'Georgia civic-engagement organization focused on building power with Black, brown, and young voters through year-round organizing and voter protection.',
        ARRAY['community']
      ),
      (
        'Fair Fight',
        'fair-fight',
        'community_group',
        'https://fairfight.com/',
        'Pro-democracy organization focused on voter education, election protection, and volunteer mobilization in Georgia and across the South.',
        ARRAY['community']
      ),
      (
        'Fair Count',
        'fair-count',
        'community_group',
        'https://faircount.org/',
        'Civic-power organization focused on historically undercounted communities, democracy academies, and census-rooted organizing across Georgia and the Deep South.',
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
        'georgia-stand-up-individual-volunteer',
        'georgia-stand-up',
        'georgia-stand-up',
        'Individual Volunteer',
        'Join Georgia STAND-UP for voter registration, canvassing, phone banking, text banking, and letter writing.',
        'Georgia STAND-UP recruits volunteers for remote and in-person civic work tied to voter engagement, issue campaigns, and community outreach across metro Atlanta.',
        'ongoing',
        'multi_week',
        'light',
        'Volunteer activities include canvassing, phone and text banking, voter registration, and outreach coordinated through Georgia STAND-UP.',
        'Metro Atlanta and remote',
        ARRAY['advocacy', 'outreach']::text[],
        ARRAY[]::text[],
        'low',
        NULL::integer,
        false,
        false,
        true,
        'Suitable for volunteers with a wide range of skillsets; remote and in-person activities are both available.',
        false,
        false,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'http://eepurl.com/hRoFKf',
        'https://www.georgiastandup.org/volunteer',
        '{"cause":"civic_engagement"}'::jsonb
      ),
      (
        'georgia-stand-up-group-volunteer',
        'georgia-stand-up',
        'georgia-stand-up',
        'Group Volunteer',
        'Bring a team to support Georgia STAND-UP civic work through coordinated volunteer days and outreach efforts.',
        'Georgia STAND-UP offers a dedicated group volunteer intake for organizations, companies, congregations, and community teams that want to plug into civic-engagement work together.',
        'ongoing',
        'multi_week',
        'light',
        'Team-based volunteer support coordinated directly with Georgia STAND-UP through its group volunteer intake.',
        'Metro Atlanta',
        ARRAY['advocacy', 'outreach']::text[],
        ARRAY[]::text[],
        'low',
        NULL::integer,
        false,
        true,
        false,
        'Best fit for community teams or affinity groups that want coordinated in-person service or outreach.',
        false,
        false,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://form.jotform.com/242553716382055',
        'https://www.georgiastandup.org/volunteer',
        '{"cause":"civic_engagement"}'::jsonb
      ),
      (
        'new-georgia-project-volunteer',
        'new-georgia-project',
        NULL::text,
        'Volunteer with New Georgia Project',
        'Support year-round organizing, voter turnout, and movement building with New Georgia Project.',
        'New Georgia Project uses volunteer power for election-season mobilization and year-round organizing with Black, brown, and young Georgians across the state.',
        'ongoing',
        'multi_week',
        'light',
        'Volunteer intake runs through New Georgia Project''s main get-involved form and campaign team follow-up.',
        'Georgia and remote',
        ARRAY['advocacy', 'outreach']::text[],
        ARRAY[]::text[],
        'low',
        NULL::integer,
        false,
        false,
        true,
        'Good fit for volunteers who want to help with turnout, organizing, and movement-building work beyond a single election weekend.',
        false,
        false,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://newgeorgiaproject.org/get-involved/',
        'https://newgeorgiaproject.org/get-involved/',
        '{"cause":"civic_engagement"}'::jsonb
      ),
      (
        'new-georgia-project-peanut-gallery',
        'new-georgia-project',
        NULL::text,
        'Join the Georgia Peanut Gallery',
        'Monitor county boards of elections and help hold local election officials accountable.',
        'New Georgia Project''s Peanut Gallery program recruits volunteers statewide to watch county boards of elections, flag anti-voter changes, and support fair, transparent election administration.',
        'ongoing',
        'multi_month',
        'training_required',
        'Recurring county-level election oversight role with training and campaign coordination through New Georgia Project.',
        'Georgia county boards of elections',
        ARRAY['research', 'advocacy']::text[],
        ARRAY[]::text[],
        'low',
        NULL::integer,
        false,
        false,
        false,
        'Best for volunteers who want a concrete local democracy-watch role with accountability impact.',
        false,
        true,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://www.mobilize.us/ngp/event/554388/',
        'https://newgeorgiaproject.org/vopro/',
        '{"cause":"civic_engagement"}'::jsonb
      ),
      (
        'fair-fight-volunteer-team',
        'fair-fight',
        NULL::text,
        'Join Fair Fight''s Volunteer Team',
        'Sign up for pro-democracy volunteer roles spanning textbanking, phonebanking, canvassing, and research.',
        'Fair Fight''s volunteer intake routes people into voter outreach, research, canvassing, and in-person democracy work in Georgia and across the South.',
        'ongoing',
        'multi_week',
        'light',
        'Volunteer opportunities are matched through Fair Fight''s signup form and campaign follow-up.',
        'Georgia, the South, and remote',
        ARRAY['advocacy', 'outreach', 'research']::text[],
        ARRAY[]::text[],
        'low',
        NULL::integer,
        false,
        false,
        true,
        'Includes both remote and in-person civic action pathways.',
        false,
        false,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://fairfight.com/volunteer',
        'https://fairfight.com/volunteer',
        '{"cause":"civic_engagement"}'::jsonb
      ),
      (
        'fair-fight-election-day-opportunities',
        'fair-fight',
        NULL::text,
        'Election Day Opportunities',
        'Support line monitoring, poll watching, and other Election Day protection work through Fair Fight.',
        'Fair Fight''s volunteer intake explicitly includes Election Day roles such as line monitoring and poll watching, making it a strong fit for residents who want episodic but high-impact civic service.',
        'ongoing',
        'one_day',
        'training_required',
        'Election-cycle volunteer work with training and campaign coordination before major voting dates.',
        'Georgia polling places and election support hubs',
        ARRAY['advocacy', 'outreach']::text[],
        ARRAY[]::text[],
        'medium',
        NULL::integer,
        false,
        false,
        false,
        'Best for volunteers comfortable with time-bound civic work in community settings on major election dates.',
        false,
        true,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://fairfight.com/volunteer',
        'https://fairfight.com/volunteer',
        '{"cause":"civic_engagement"}'::jsonb
      ),
      (
        'fair-count-volunteer-with-us',
        'fair-count',
        'fair-count',
        'Volunteer with Fair Count',
        'Join Fair Count''s live event and volunteer network supporting historically undercounted communities.',
        'Fair Count routes volunteers into upcoming civic events and community power-building actions through its official Mobilize page.',
        'ongoing',
        'multi_week',
        'light',
        'Volunteer participation happens through recurring public events and action days published by Fair Count.',
        'Georgia and the Deep South',
        ARRAY['advocacy', 'outreach']::text[],
        ARRAY[]::text[],
        'low',
        NULL::integer,
        false,
        false,
        false,
        'Good fit for residents who want a civic-action path tied to a live public event stream.',
        false,
        false,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://www.mobilize.us/faircount/',
        'https://faircount.org/',
        '{"cause":"civic_engagement"}'::jsonb
      ),
      (
        'fair-count-democracy-academy',
        'fair-count',
        'fair-count',
        'Join a Democracy Academy',
        'Build civic leadership skills through Fair Count''s Democracy Academies and related training programs.',
        'Fair Count highlights Democracy Academies, Midterm Motivations, and F.A.I.R. training sessions as core infrastructure for long-term community leadership and civic power building.',
        'ongoing',
        'multi_month',
        'training_required',
        'Training-led engagement path centered on academies, workshops, and leadership development sessions.',
        'Georgia and regional training sessions',
        ARRAY['leadership', 'advocacy']::text[],
        ARRAY[]::text[],
        'low',
        NULL::integer,
        false,
        false,
        false,
        'Best for volunteers who want skill-building and leadership development rather than only one-off event attendance.',
        false,
        true,
        NULL::integer,
        NULL::integer,
        'normal',
        NULL::date,
        NULL::date,
        'https://faircount.org/',
        'https://faircount.org/',
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
JOIN organizations org
  ON org.slug = seed.org_slug
LEFT JOIN sources src
  ON seed.source_slug IS NOT NULL
 AND src.slug = seed.source_slug
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
