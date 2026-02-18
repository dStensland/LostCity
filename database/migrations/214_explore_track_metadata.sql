-- Move explore track accent colors, categories, and group names from
-- hardcoded frontend constants into the database so they're fully data-driven.

ALTER TABLE explore_tracks ADD COLUMN IF NOT EXISTS accent_color text;
ALTER TABLE explore_tracks ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE explore_tracks ADD COLUMN IF NOT EXISTS group_name text;

-- Backfill accent colors (previously TRACK_ACCENT_COLORS in explore-tracks.ts)
UPDATE explore_tracks SET accent_color = CASE slug
  WHEN 'welcome-to-atlanta' THEN '#C1D32F'
  WHEN 'good-trouble' THEN '#E03A3E'
  WHEN 'the-south-got-something-to-say' THEN '#D4A574'
  WHEN 'keep-moving-forward' THEN '#10B981'
  WHEN 'the-itis' THEN '#FB923C'
  WHEN 'city-in-a-forest' THEN '#34D399'
  WHEN 'hard-in-da-paint' THEN '#14B8A6'
  WHEN 'a-beautiful-mosaic' THEN '#8B5CF6'
  WHEN 'too-busy-to-hate' THEN '#EAB308'
  WHEN 'the-midnight-train' THEN '#A78BFA'
  WHEN 'keep-swinging' THEN '#F472B6'
  WHEN 'lifes-like-a-movie' THEN '#F59E0B'
  WHEN 'say-less' THEN '#D97706'
  WHEN 'yallywood' THEN '#EF4444'
  WHEN 'spelhouse-spirit' THEN '#9F1239'
  WHEN 'resurgens' THEN '#D4AF37'
  WHEN 'up-on-the-roof' THEN '#38BDF8'
  WHEN 'artefacts-of-the-lost-city' THEN '#FB923C'
  WHEN 'not-from-around-here' THEN '#E07C4F'
  WHEN 'as-seen-on-tv' THEN '#60A5FA'
  WHEN 'comedy-live' THEN '#FBBF24'
  WHEN 'native-heritage' THEN '#92400E'
  WHEN 'hell-of-an-engineer' THEN '#B89B5E'
END
WHERE accent_color IS NULL;

-- Backfill categories (previously TRACK_CATEGORIES in explore-tracks.ts)
UPDATE explore_tracks SET category = CASE slug
  WHEN 'welcome-to-atlanta' THEN 'Classic Atlanta'
  WHEN 'good-trouble' THEN 'Civil Rights Heritage'
  WHEN 'the-south-got-something-to-say' THEN 'Dirty South'
  WHEN 'keep-moving-forward' THEN 'The BeltLine'
  WHEN 'the-itis' THEN 'Food Scene'
  WHEN 'city-in-a-forest' THEN 'Great Outdoors'
  WHEN 'hard-in-da-paint' THEN 'Street Art & Local Art'
  WHEN 'a-beautiful-mosaic' THEN 'Global Atlanta'
  WHEN 'too-busy-to-hate' THEN 'LGBTQ+ Culture'
  WHEN 'the-midnight-train' THEN 'Weird Spots for Freaks'
  WHEN 'keep-swinging' THEN 'Sports & Game Day'
  WHEN 'lifes-like-a-movie' THEN 'Family & Kids'
  WHEN 'say-less' THEN 'Speakeasy & Cocktails'
  WHEN 'yallywood' THEN 'Cinema'
  WHEN 'spelhouse-spirit' THEN 'HBCU Culture'
  WHEN 'resurgens' THEN 'Skyline & Architecture'
  WHEN 'up-on-the-roof' THEN 'Rooftop & Skyline Views'
  WHEN 'artefacts-of-the-lost-city' THEN 'Artefacts & Curiosities'
  WHEN 'not-from-around-here' THEN 'International & Regional Eats'
  WHEN 'as-seen-on-tv' THEN 'Filming Locations'
  WHEN 'comedy-live' THEN 'Comedy & Live Performance'
  WHEN 'native-heritage' THEN 'Creek & Cherokee Heritage'
  WHEN 'hell-of-an-engineer' THEN 'Georgia Tech'
END
WHERE category IS NULL;

-- Backfill group names (previously TRACK_GROUPS in ExploreTrackList.tsx)
UPDATE explore_tracks SET group_name = CASE slug
  WHEN 'welcome-to-atlanta' THEN 'Essential Atlanta'
  WHEN 'good-trouble' THEN 'Essential Atlanta'
  WHEN 'the-south-got-something-to-say' THEN 'Essential Atlanta'
  WHEN 'the-itis' THEN 'Eat & Drink'
  WHEN 'not-from-around-here' THEN 'Eat & Drink'
  WHEN 'say-less' THEN 'Eat & Drink'
  WHEN 'up-on-the-roof' THEN 'Eat & Drink'
  WHEN 'city-in-a-forest' THEN 'Outdoors & Active'
  WHEN 'keep-moving-forward' THEN 'Outdoors & Active'
  WHEN 'keep-swinging' THEN 'Outdoors & Active'
  WHEN 'hard-in-da-paint' THEN 'Culture & Community'
  WHEN 'a-beautiful-mosaic' THEN 'Culture & Community'
  WHEN 'too-busy-to-hate' THEN 'Culture & Community'
  WHEN 'spelhouse-spirit' THEN 'Culture & Community'
  WHEN 'native-heritage' THEN 'Culture & Community'
  WHEN 'yallywood' THEN 'Stage & Screen'
  WHEN 'as-seen-on-tv' THEN 'Stage & Screen'
  WHEN 'comedy-live' THEN 'Stage & Screen'
  WHEN 'the-midnight-train' THEN 'Stage & Screen'
  WHEN 'lifes-like-a-movie' THEN 'Stage & Screen'
  WHEN 'hell-of-an-engineer' THEN 'Campus Life'
  WHEN 'artefacts-of-the-lost-city' THEN 'Only in Atlanta'
  WHEN 'resurgens' THEN 'Only in Atlanta'
END
WHERE group_name IS NULL;
