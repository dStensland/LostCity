-- Archive Emory demo portal
-- Digital healthcare vertical deprioritized. Portal data preserved for potential reactivation.
-- Setting status to 'inactive' causes getPortalBySlug() to return null → 404.

UPDATE portals SET status = 'inactive', updated_at = NOW()
WHERE slug = 'emory-demo';

-- Also deactivate Emory-specific sources so they don't run in the crawler pipeline
UPDATE sources SET is_active = false
WHERE owner_portal_id = (SELECT id FROM portals WHERE slug = 'emory-demo');
