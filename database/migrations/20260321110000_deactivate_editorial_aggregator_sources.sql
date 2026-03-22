-- Deactivate editorial aggregator sources that violate the original-source-only policy.
-- These duplicate events that should come from venue-direct crawlers.
-- See CRAWLER_STRATEGY.md "Source Rule: Original Sources Over Curators".

update sources set is_active = false
where slug in (
  'arts-atl', 'artsatl', 'creative-loafing', 'discover-atlanta',
  'access-atlanta', 'nashville-scene', 'visit-franklin', 'nashville-com'
) and is_active = true;
