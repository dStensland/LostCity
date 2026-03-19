-- Deactivate Callanwolde duplicate (source 1307, canonical = 809)
-- and Opera Nightclub (domain dead 37 days)

UPDATE sources SET is_active = false,
  health_tags = array_append(COALESCE(health_tags, '{}'), 'deactivated:duplicate')
WHERE id = 1307 AND is_active = true;

UPDATE sources SET is_active = false,
  health_tags = array_append(COALESCE(health_tags, '{}'), 'deactivated:venue_closed')
WHERE slug = 'opera-nightclub' AND is_active = true;

UPDATE events SET is_active = false
WHERE source_id IN (1307, (SELECT id FROM sources WHERE slug = 'opera-nightclub'))
  AND start_date >= CURRENT_DATE AND is_active = true;
