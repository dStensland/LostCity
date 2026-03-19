-- Link African Film Festival Atlanta source and open calls to a canonical organization row.

WITH arts_portal AS (
  SELECT id
  FROM portals
  WHERE slug = 'arts-atlanta'
  LIMIT 1
),
upserted_org AS (
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
    featured,
    is_verified
  )
  SELECT
    COALESCE(
      (SELECT o.id FROM organizations o WHERE o.slug = 'african-film-festival-atlanta'),
      gen_random_uuid()::text
    ),
    'African Film Festival Atlanta',
    'african-film-festival-atlanta',
    'film',
    'https://africanfilmfestatl.com/',
    'Atlanta-based film festival and arts organization presenting African cinema and related artist opportunities.',
    ARRAY['film', 'festival', 'arts']::text[],
    'Atlanta',
    p.id,
    FALSE,
    FALSE,
    TRUE
  FROM arts_portal p
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    org_type = EXCLUDED.org_type,
    website = COALESCE(organizations.website, EXCLUDED.website),
    description = COALESCE(organizations.description, EXCLUDED.description),
    categories = COALESCE(organizations.categories, EXCLUDED.categories),
    city = COALESCE(organizations.city, EXCLUDED.city),
    portal_id = COALESCE(organizations.portal_id, EXCLUDED.portal_id),
    hidden = FALSE,
    is_verified = COALESCE(organizations.is_verified, EXCLUDED.is_verified)
  RETURNING id
),
linked_source AS (
  UPDATE sources s
  SET organization_id = o.id
  FROM upserted_org o
  WHERE s.slug = 'african-film-festival-atlanta'
  RETURNING s.id
)
UPDATE open_calls oc
SET organization_id = o.id
FROM upserted_org o
WHERE oc.source_id IN (SELECT id FROM linked_source)
  AND oc.organization_id IS NULL;
