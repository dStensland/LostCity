-- Add new event categories: religious, markets, wellness, gaming, outdoors

INSERT INTO categories (id, name, display_order, icon, color) VALUES
  ('religious', 'Religious', 17, 'church', '#DDD6FE'),
  ('markets', 'Markets', 18, 'shopping-bag', '#FCA5A5'),
  ('wellness', 'Wellness', 19, 'lotus', '#99F6E4'),
  ('gaming', 'Gaming', 20, 'gamepad', '#86EFAC'),
  ('outdoors', 'Outdoors', 21, 'mountain', '#BEF264')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  display_order = EXCLUDED.display_order,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color;

-- Add subcategories for new categories

-- RELIGIOUS subcategories
INSERT INTO subcategories (id, category_id, name, display_order) VALUES
  ('religious.service', 'religious', 'Service / Mass', 1),
  ('religious.gospel', 'religious', 'Gospel / Worship', 2),
  ('religious.study', 'religious', 'Bible Study / Discussion', 3),
  ('religious.retreat', 'religious', 'Retreat / Conference', 4),
  ('religious.interfaith', 'religious', 'Interfaith', 5),
  ('religious.holiday', 'religious', 'Religious Holiday', 6)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  display_order = EXCLUDED.display_order;

-- MARKETS subcategories
INSERT INTO subcategories (id, category_id, name, display_order) VALUES
  ('markets.farmers', 'markets', 'Farmers Market', 1),
  ('markets.flea', 'markets', 'Flea Market', 2),
  ('markets.craft', 'markets', 'Craft / Artisan', 3),
  ('markets.vintage', 'markets', 'Vintage / Antique', 4),
  ('markets.night', 'markets', 'Night Market', 5),
  ('markets.holiday', 'markets', 'Holiday Market', 6)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  display_order = EXCLUDED.display_order;

-- WELLNESS subcategories
INSERT INTO subcategories (id, category_id, name, display_order) VALUES
  ('wellness.meditation', 'wellness', 'Meditation', 1),
  ('wellness.sound', 'wellness', 'Sound Bath / Healing', 2),
  ('wellness.spa', 'wellness', 'Spa / Relaxation', 3),
  ('wellness.mental', 'wellness', 'Mental Health', 4),
  ('wellness.breathwork', 'wellness', 'Breathwork', 5),
  ('wellness.retreat', 'wellness', 'Wellness Retreat', 6)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  display_order = EXCLUDED.display_order;

-- GAMING subcategories
INSERT INTO subcategories (id, category_id, name, display_order) VALUES
  ('gaming.video', 'gaming', 'Video Games', 1),
  ('gaming.board', 'gaming', 'Board Games', 2),
  ('gaming.esports', 'gaming', 'Esports / Tournament', 3),
  ('gaming.lan', 'gaming', 'LAN Party', 4),
  ('gaming.tabletop', 'gaming', 'Tabletop / RPG', 5),
  ('gaming.arcade', 'gaming', 'Arcade / Retro', 6)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  display_order = EXCLUDED.display_order;

-- OUTDOORS subcategories
INSERT INTO subcategories (id, category_id, name, display_order) VALUES
  ('outdoors.hiking', 'outdoors', 'Hiking / Walking', 1),
  ('outdoors.camping', 'outdoors', 'Camping', 2),
  ('outdoors.nature', 'outdoors', 'Nature / Wildlife', 3),
  ('outdoors.kayak', 'outdoors', 'Kayak / Paddle', 4),
  ('outdoors.climbing', 'outdoors', 'Climbing', 5),
  ('outdoors.garden', 'outdoors', 'Garden / Botanical', 6)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  display_order = EXCLUDED.display_order;
