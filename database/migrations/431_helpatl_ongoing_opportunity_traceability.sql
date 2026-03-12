-- ============================================
-- MIGRATION 431: HelpATL Ongoing Opportunity Traceability
-- ============================================
-- Activates/creates ongoing-opportunity backing sources for structured roles
-- that were previously org-first only, then links the existing HelpATL roles
-- to those source records.

DO $$
DECLARE
  helpatl_id UUID;
  canopy_source_id INTEGER;
  hope_source_id INTEGER;
  irc_source_id INTEGER;
  fair_fight_source_id INTEGER;
  new_georgia_project_source_id INTEGER;
BEGIN
  SELECT id INTO helpatl_id
  FROM portals
  WHERE slug = 'helpatl'
  LIMIT 1;

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
    'canopy-atlanta',
    'Canopy Atlanta',
    'https://canopyatlanta.org/documenters/',
    'organization',
    'weekly',
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

  UPDATE sources
  SET is_active = true,
      owner_portal_id = helpatl_id,
      integration_method = COALESCE(NULLIF(integration_method, ''), 'manual'),
      crawl_frequency = COALESCE(NULLIF(crawl_frequency, ''), 'weekly')
  WHERE slug IN (
    'hope-atlanta',
    'irc-atlanta',
    'fair-fight',
    'new-georgia-project'
  );

  SELECT id INTO canopy_source_id
  FROM sources
  WHERE slug = 'canopy-atlanta'
  LIMIT 1;

  SELECT id INTO hope_source_id
  FROM sources
  WHERE slug = 'hope-atlanta'
  LIMIT 1;

  SELECT id INTO irc_source_id
  FROM sources
  WHERE slug = 'irc-atlanta'
  LIMIT 1;

  SELECT id INTO fair_fight_source_id
  FROM sources
  WHERE slug = 'fair-fight'
  LIMIT 1;

  SELECT id INTO new_georgia_project_source_id
  FROM sources
  WHERE slug = 'new-georgia-project'
  LIMIT 1;

  INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
  SELECT source_id, helpatl_id, 'all'
  FROM (
    VALUES
      (canopy_source_id),
      (hope_source_id),
      (irc_source_id),
      (fair_fight_source_id),
      (new_georgia_project_source_id)
  ) AS source_ids(source_id)
  WHERE source_id IS NOT NULL
  ON CONFLICT (source_id) DO UPDATE SET
    owner_portal_id = helpatl_id,
    share_scope = 'all',
    updated_at = now();

  UPDATE volunteer_opportunities
  SET source_id = canopy_source_id,
      updated_at = now()
  WHERE slug = 'canopy-atlanta-documenter'
    AND source_id IS NULL
    AND canopy_source_id IS NOT NULL;

  UPDATE volunteer_opportunities
  SET source_id = hope_source_id,
      updated_at = now()
  WHERE slug IN (
      'hope-community-kitchen-volunteer',
      'hope-donation-sorting-support'
    )
    AND source_id IS NULL
    AND hope_source_id IS NOT NULL;

  UPDATE volunteer_opportunities
  SET source_id = irc_source_id,
      updated_at = now()
  WHERE slug IN (
      'irc-donations-volunteer',
      'irc-esl-class-assistant',
      'irc-volunteer-driver',
      'irc-youth-afterschool-tutor'
    )
    AND source_id IS NULL
    AND irc_source_id IS NOT NULL;

  UPDATE volunteer_opportunities
  SET source_id = fair_fight_source_id,
      updated_at = now()
  WHERE slug IN (
      'fair-fight-election-day-opportunities',
      'fair-fight-volunteer-team'
    )
    AND source_id IS NULL
    AND fair_fight_source_id IS NOT NULL;

  UPDATE volunteer_opportunities
  SET source_id = new_georgia_project_source_id,
      updated_at = now()
  WHERE slug IN (
      'new-georgia-project-peanut-gallery',
      'new-georgia-project-volunteer'
    )
    AND source_id IS NULL
    AND new_georgia_project_source_id IS NOT NULL;

  REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
END $$;
