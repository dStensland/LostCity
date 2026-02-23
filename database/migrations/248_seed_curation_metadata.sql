-- 248_seed_curation_metadata.sql
-- Backfill vibe_tags, accent_color, and category for existing curations
-- These were created before the curation evolution added these columns

-- Best Neighborhood Bar in Atlanta
UPDATE lists SET
  vibe_tags = ARRAY['nightlife', 'neighborhood', 'drinks'],
  accent_color = '#F59E0B',
  category = 'best_of'
WHERE slug = 'best-neighborhood-bar-in-atlanta' AND status = 'active';

-- Best Dive Bars in Atlanta
UPDATE lists SET
  vibe_tags = ARRAY['nightlife', 'dive-bar', 'budget-friendly'],
  accent_color = '#EF4444',
  category = 'hidden_gems'
WHERE slug = 'best-dive-bars-in-atlanta' AND status = 'active';

-- Late Night Eats (After Midnight)
UPDATE lists SET
  vibe_tags = ARRAY['late-night', 'food', 'after-hours'],
  accent_color = '#8B5CF6',
  category = 'best_of'
WHERE slug = 'late-night-eats-after-midnight' AND status = 'active';

-- Best Live Music Venues
UPDATE lists SET
  vibe_tags = ARRAY['live-music', 'nightlife', 'concerts'],
  accent_color = '#EC4899',
  category = 'best_of'
WHERE slug = 'best-live-music-venues' AND status = 'active';

-- Best Small Music Venues
UPDATE lists SET
  vibe_tags = ARRAY['live-music', 'intimate', 'hidden-gems'],
  accent_color = '#F472B6',
  category = 'hidden_gems'
WHERE slug = 'best-small-music-venues' AND status = 'active';

-- Gallery Crawl Essentials
UPDATE lists SET
  vibe_tags = ARRAY['art', 'gallery', 'culture'],
  accent_color = '#A78BFA',
  category = 'special_occasion'
WHERE slug = 'gallery-crawl-essentials' AND status = 'active';

-- Best Taprooms in Atlanta
UPDATE lists SET
  vibe_tags = ARRAY['beer', 'brewery', 'chill'],
  accent_color = '#F59E0B',
  category = 'with_friends'
WHERE slug = 'best-taprooms-in-atlanta' AND status = 'active';

-- Atlanta Theater Guide
UPDATE lists SET
  vibe_tags = ARRAY['theater', 'performing-arts', 'culture'],
  accent_color = '#DC2626',
  category = 'best_of'
WHERE slug = 'atlanta-theater-guide' AND status = 'active';

-- Best Comedy Spots in Atlanta
UPDATE lists SET
  vibe_tags = ARRAY['comedy', 'nightlife', 'entertainment'],
  accent_color = '#FBBF24',
  category = 'best_of'
WHERE slug = 'best-comedy-spots-in-atlanta' AND status = 'active';

-- Best Dance Clubs & DJ Nights
UPDATE lists SET
  vibe_tags = ARRAY['nightlife', 'dancing', 'dj'],
  accent_color = '#D946EF',
  category = 'best_of'
WHERE slug = 'best-dance-clubs-dj-nights' AND status = 'active';

-- The Edgewood Bar Crawl
UPDATE lists SET
  vibe_tags = ARRAY['nightlife', 'edgewood', 'bar-crawl'],
  accent_color = '#10B981',
  category = 'with_friends'
WHERE slug = 'the-edgewood-bar-crawl' AND status = 'active';

-- Keep L5P Weird
UPDATE lists SET
  vibe_tags = ARRAY['little-five-points', 'alternative', 'culture'],
  accent_color = '#06B6D4',
  category = 'hidden_gems'
WHERE slug = 'keep-l5p-weird' AND status = 'active';

-- Best of Decatur Square
UPDATE lists SET
  vibe_tags = ARRAY['decatur', 'neighborhood', 'food'],
  accent_color = '#14B8A6',
  category = 'best_of'
WHERE slug = 'best-of-decatur-square' AND status = 'active';

-- Late Night Eats (After 2am)
UPDATE lists SET
  vibe_tags = ARRAY['late-night', 'food', 'after-hours', 'dive'],
  accent_color = '#7C3AED',
  category = 'best_of'
WHERE slug = 'late-night-eats-after-2am' AND status = 'active';

-- Dive Bar Hall of Fame
UPDATE lists SET
  vibe_tags = ARRAY['dive-bar', 'nightlife', 'classic'],
  accent_color = '#B91C1C',
  category = 'best_of'
WHERE slug = 'dive-bar-hall-of-fame' AND status = 'active';

-- Queer Atlanta: Best LGBTQ+ Spots
UPDATE lists SET
  vibe_tags = ARRAY['lgbtq', 'nightlife', 'community', 'inclusive'],
  accent_color = '#E879F9',
  category = 'best_of'
WHERE slug = 'queer-atlanta-best-lgbtq-spots' AND status = 'active';

-- Best Movie Theaters in Atlanta
UPDATE lists SET
  vibe_tags = ARRAY['film', 'entertainment', 'date-night'],
  accent_color = '#6366F1',
  category = 'date_night'
WHERE slug = 'best-movie-theaters-in-atlanta' AND status = 'active';

-- Best Arcade & Game Bars
UPDATE lists SET
  vibe_tags = ARRAY['gaming', 'nightlife', 'retro', 'with-friends'],
  accent_color = '#22C55E',
  category = 'with_friends'
WHERE slug = 'best-arcade-game-bars' AND status = 'active';
