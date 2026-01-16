-- Seed editorial collections for Lost City
-- Run this after add_collections.sql

-- Create editorial collections (featured, owned by system/admin)
-- Note: These should be owned by an admin user. If no admin exists, leave user_id NULL.

INSERT INTO collections (slug, title, description, visibility, is_featured, featured_order)
VALUES
  ('free-date-nights', 'Free Date Nights', 'Romantic outings that won''t break the bank. From outdoor movies to gallery openings, Atlanta has plenty of free ways to impress.', 'public', true, 1),
  ('best-patios', 'Best Patios', 'Soak up the Atlanta sun at these top outdoor spots. Perfect for brunch, happy hour, or people-watching.', 'public', true, 2),
  ('live-music-tonight', 'Live Music Tonight', 'Catch a show tonight! From intimate jazz clubs to packed rock venues, here''s what''s playing.', 'public', true, 3),
  ('weekend-brunch', 'Weekend Brunch', 'Start your weekend right with bottomless mimosas, live DJs, and the best biscuits in town.', 'public', true, 4),
  ('comedy-nights', 'Comedy Nights', 'Need a laugh? These comedy shows and open mics will have you in stitches.', 'public', true, 5),
  ('art-gallery-openings', 'Art Gallery Openings', 'Free wine, local artists, and that cultured feeling. Atlanta''s gallery scene is thriving.', 'public', true, 6),
  ('family-friendly', 'Family-Friendly Fun', 'Keep the kids entertained with festivals, workshops, and outdoor adventures the whole family will enjoy.', 'public', true, 7),
  ('late-night-eats', 'Late Night Eats', 'When the clubs close but hunger calls. These spots serve great food well past midnight.', 'public', true, 8)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  is_featured = EXCLUDED.is_featured,
  featured_order = EXCLUDED.featured_order,
  updated_at = now();

-- To populate with real events, run queries like:
-- INSERT INTO collection_items (collection_id, event_id, position)
-- SELECT c.id, e.id, ROW_NUMBER() OVER (ORDER BY e.start_date)
-- FROM collections c, events e
-- WHERE c.slug = 'free-date-nights'
--   AND e.is_free = true
--   AND e.start_date >= CURRENT_DATE
--   AND e.category IN ('music', 'art', 'film')
-- LIMIT 10;
