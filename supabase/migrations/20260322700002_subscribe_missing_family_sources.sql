-- Subscribe missing family-relevant sources to the family portal.
-- All Fired Up Art Studio (1100) — pottery/art classes for kids
-- Atlanta Science Festival (627) — annual STEM festival for families
-- Column names: subscriber_portal_id (not portal_id), plus subscription_scope and is_active required.

INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
SELECT p.id, s.id, 'full', true
FROM sources s
CROSS JOIN portals p
WHERE p.slug = 'atlanta-families'
  AND s.id IN (1100, 627)
ON CONFLICT (subscriber_portal_id, source_id) DO NOTHING;
