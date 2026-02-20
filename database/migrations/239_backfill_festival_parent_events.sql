-- Migration 239: Create parent events for festivals with announced dates
-- These "parent events" allow festivals to appear in the main events feed.
-- Each festival with announced_start gets a corresponding all-day event.

-- Create parent events for festivals that have announced dates in 2025/2026
-- and don't already have a matching parent event.
INSERT INTO events (
  title,
  description,
  start_date,
  end_date,
  is_all_day,
  content_kind,
  category,
  is_free,
  source_url,
  ticket_url,
  image_url,
  festival_id,
  is_tentpole
)
SELECT
  f.name,
  f.description,
  f.announced_start::date,
  COALESCE(f.announced_end::date, f.announced_start::date),
  true,
  'event',
  f.categories[1],  -- use first category
  f.free,
  COALESCE(f.website, 'https://lostcity.app/festivals/' || f.slug),
  f.ticket_url,
  f.image_url,
  f.id,
  -- Mark tier-1 festivals as tentpole
  CASE WHEN f.id IN (
    'dragon-con',
    'atlanta-pride',
    'shaky-knees',
    'music-midtown',
    'atlanta-jazz-festival',
    'atlanta-film-festival',
    'peachtree-road-race',
    'atlanta-dogwood-festival'
  ) THEN true ELSE false END
FROM festivals f
WHERE f.announced_start IS NOT NULL
  AND EXTRACT(YEAR FROM f.announced_start::date) >= 2025
  -- Don't create duplicate parent events
  AND NOT EXISTS (
    SELECT 1 FROM events e
    WHERE e.festival_id = f.id
      AND e.start_date = f.announced_start::date
      AND e.is_all_day = true
      AND e.series_id IS NULL
  );

-- Also flag any non-festival tentpole events (major sports, one-off spectacles)
-- by title pattern matching for well-known events
UPDATE events SET is_tentpole = true
WHERE is_tentpole = false
  AND start_date >= CURRENT_DATE
  AND (
    title ILIKE '%SEC Championship%'
    OR title ILIKE '%Peach Bowl%'
    OR title ILIKE '%Chick-fil-A Bowl%'
    OR title ILIKE '%College Football Playoff%'
    OR title ILIKE '%Super Bowl%'
    OR title ILIKE '%MLS Cup%'
    OR title ILIKE '%All-Star Game%'
    OR title ILIKE '%NCAA Final Four%'
  );
