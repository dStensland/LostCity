-- Deactivate stale Evolation Yoga Atlanta source.
--
-- The official site no longer exposes an Atlanta-local classes/events endpoint;
-- the old URL now returns a generic 404 page while the remaining inventory is
-- global teacher-training content that does not fit the Atlanta consumer feed.

UPDATE sources
SET is_active = false
WHERE slug = 'evolation-yoga';
