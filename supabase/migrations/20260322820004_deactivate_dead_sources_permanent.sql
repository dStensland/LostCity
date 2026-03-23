-- Permanently deactivate sources confirmed dead by crawler investigation 2026-03-22.

UPDATE sources SET is_active = false,
  health_tags = array_append(COALESCE(health_tags, '{}'), 'deactivated:permanently_dead')
WHERE slug IN (
  'irc-atlanta',              -- IRC national site, no local events page
  'new-american-pathways',    -- Tribe Events API 404, plugin removed
  'worksource-atlanta'        -- Google Calendar abandoned since mid-2024
) AND is_active = true;

-- Deactivate any future events
UPDATE events SET is_active = false
WHERE source_id IN (
  SELECT id FROM sources WHERE slug IN (
    'irc-atlanta', 'new-american-pathways', 'worksource-atlanta'
  )
) AND start_date >= CURRENT_DATE AND is_active = true;
