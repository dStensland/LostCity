-- Split sports/fitness into sports/recreation/exercise
-- sports     = spectator (pro games, college, watch parties, esports)
-- recreation = participation (pickup, leagues, open gym, pickleball, batting cages, adaptive)
-- exercise   = movement (yoga, run clubs, cycling, HIIT, swimming, climbing, martial arts)

-- 1. Insert new categories
--    Columns: id, name, display_order, icon, color
INSERT INTO categories (id, name, display_order, icon, color)
VALUES
  ('recreation', 'Recreation', 6.5, 'PersonSimpleRun', '#86EFAC'),
  ('exercise',   'Exercise',   7,   'Barbell',         '#5EEAD4')
ON CONFLICT (id) DO NOTHING;

-- 2. Insert new subcategories (only if table exists — not present in all envs)
DO $$
BEGIN
  IF to_regclass('public.subcategories') IS NOT NULL THEN
    INSERT INTO subcategories (id, category_id, name, display_order)
    VALUES
      ('recreation.pickup',    'recreation', 'Pickup',          1),
      ('recreation.league',    'recreation', 'League',          2),
      ('recreation.open-play', 'recreation', 'Open Play',       3),
      ('recreation.adaptive',  'recreation', 'Adaptive Sports', 4),
      ('exercise.yoga',         'exercise', 'Yoga',             1),
      ('exercise.running',      'exercise', 'Running',          2),
      ('exercise.cycling',      'exercise', 'Cycling',          3),
      ('exercise.group-fitness','exercise', 'Group Fitness',    4),
      ('exercise.martial-arts', 'exercise', 'Martial Arts',     5),
      ('exercise.climbing',     'exercise', 'Climbing',         6),
      ('exercise.swimming',     'exercise', 'Swimming',         7)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- 3. Reclassify all fitness → exercise
UPDATE events SET category_id = 'exercise' WHERE category_id = 'fitness';

-- 4. Reclassify participation sports → recreation
--    Matches on genres array, tags array, or title keywords
UPDATE events SET category_id = 'recreation'
WHERE category_id = 'sports'
AND (
  genres && ARRAY['pickleball','cornhole','axe-throwing','softball','volleyball',
    'open-play','open-gym','pickup','league','adaptive-sports','wheelchair-sports',
    'recreation','batting-cage','public-play']
  OR tags && ARRAY['pickup','open-play','open-gym','public-play','league',
    'rec-league','adaptive-sports']
  OR title ~* '\y(pickup|open play|open gym|public play|rec league|batting cage|pickleball|cornhole|axe.?throw|adaptive sports|wheelchair)\y'
);

-- 5. fitness category row intentionally kept for backward compatibility
--    Remove only after all crawler code has migrated to exercise/recreation
