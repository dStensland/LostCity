-- Remove legacy HelpATL subscription carryover that is not part of the
-- current HelpATL source pack and does not contribute active events or
-- structured opportunities.

UPDATE source_subscriptions
SET is_active = false
WHERE subscriber_portal_id = (SELECT id FROM portals WHERE slug = 'helpatl')
  AND source_id = (SELECT id FROM sources WHERE slug = 'atlanta-toolbank')
  AND is_active = true;
