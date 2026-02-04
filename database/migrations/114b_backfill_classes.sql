-- Backfill existing events as classes based on source and content patterns.
-- Run after 114_classes_support.sql.

-- 1. Mark Painting With a Twist events as painting classes
UPDATE events
SET is_class = true, class_category = 'painting'
WHERE source_id IN (SELECT id FROM sources WHERE slug = 'painting-with-a-twist')
  AND is_class IS NOT TRUE;

-- 2. Mark Sur La Table events as cooking classes
UPDATE events
SET is_class = true, class_category = 'cooking'
WHERE source_id IN (SELECT id FROM sources WHERE slug = 'sur-la-table')
  AND is_class IS NOT TRUE;

-- 3. Mark Williams Sonoma events as cooking classes
UPDATE events
SET is_class = true, class_category = 'cooking'
WHERE source_id IN (SELECT id FROM sources WHERE slug = 'williams-sonoma')
  AND is_class IS NOT TRUE;

-- 4. Mark Arthur Murray events as dance classes
UPDATE events
SET is_class = true, class_category = 'dance'
WHERE source_id IN (SELECT id FROM sources WHERE slug = 'arthur-murray-atlanta')
  AND is_class IS NOT TRUE;

-- 5. Mark Atlanta Dance events as dance classes
UPDATE events
SET is_class = true, class_category = 'dance'
WHERE source_id IN (SELECT id FROM sources WHERE slug = 'atlanta-dance-ballroom')
  AND is_class IS NOT TRUE;

-- 6. Mark existing class crawlers (pottery, mixed arts, botanical, cooking)
UPDATE events
SET is_class = true, class_category = 'pottery'
WHERE source_id IN (SELECT id FROM sources WHERE slug IN ('atlanta-clay-works', 'mudfire'))
  AND is_class IS NOT TRUE;

UPDATE events
SET is_class = true, class_category = 'mixed'
WHERE source_id IN (SELECT id FROM sources WHERE slug IN ('spruill-center', 'atlanta-botanical'))
  AND is_class IS NOT TRUE;

UPDATE events
SET is_class = true, class_category = 'cooking'
WHERE source_id IN (SELECT id FROM sources WHERE slug IN ('irwin-street-cooking', 'publix-aprons'))
  AND is_class IS NOT TRUE;

-- 7. Mark dance studio events as dance classes
UPDATE events
SET is_class = true, class_category = 'dance'
WHERE source_id IN (SELECT id FROM sources WHERE slug IN (
    'academy-ballroom', 'ballroom-impact', 'dancing4fun',
    'salsa-atlanta', 'pasofino-dance'
))
  AND is_class IS NOT TRUE;

-- 8. Mark yoga studio events as fitness classes
UPDATE events
SET is_class = true, class_category = 'fitness'
WHERE source_id IN (SELECT id FROM sources WHERE slug IN (
    'highland-yoga', 'dancing-dogs-yoga', 'evolation-yoga',
    'vista-yoga', 'yonder-yoga'
))
  AND is_class IS NOT TRUE;

-- 9. Mark makerspace events as classes
UPDATE events
SET is_class = true, class_category = 'woodworking'
WHERE source_id IN (SELECT id FROM sources WHERE slug IN ('decatur-makers', 'maker-station'))
  AND is_class IS NOT TRUE;

UPDATE events
SET is_class = true, class_category = 'mixed'
WHERE source_id IN (SELECT id FROM sources WHERE slug IN ('janke-studios', 'freeside-atlanta'))
  AND is_class IS NOT TRUE;

-- 10. Mark new class venue events
UPDATE events
SET is_class = true, class_category = 'crafts'
WHERE source_id IN (SELECT id FROM sources WHERE slug = 'candlelit-atl')
  AND is_class IS NOT TRUE;

UPDATE events
SET is_class = true, class_category = 'woodworking'
WHERE source_id IN (SELECT id FROM sources WHERE slug = 'rockler-woodworking')
  AND is_class IS NOT TRUE;

UPDATE events
SET is_class = true, class_category = 'floral'
WHERE source_id IN (SELECT id FROM sources WHERE slug = 'halls-floral')
  AND is_class IS NOT TRUE;

UPDATE events
SET is_class = true, class_category = 'fitness'
WHERE source_id IN (SELECT id FROM sources WHERE slug IN ('rei-atlanta', 'stone-summit'))
  AND is_class IS NOT TRUE;

UPDATE events
SET is_class = true, class_category = 'pottery'
WHERE source_id IN (SELECT id FROM sources WHERE slug = 'all-fired-up-art')
  AND is_class IS NOT TRUE;

-- 11. Mark events by subcategory patterns
UPDATE events
SET is_class = true
WHERE is_class IS NOT TRUE
  AND subcategory IN ('learning.workshop', 'learning.class', 'art.workshop', 'arts.workshop', 'food_drink.class', 'fitness.yoga', 'fitness.class', 'fitness.dance');

-- 8. Mark events by title keyword matching (conservative - require workshop/class/lesson context)
UPDATE events
SET is_class = true
WHERE is_class IS NOT TRUE
  AND (
    title ILIKE '%cooking class%'
    OR title ILIKE '%pottery class%'
    OR title ILIKE '%painting class%'
    OR title ILIKE '%dance class%'
    OR title ILIKE '%dance lesson%'
    OR title ILIKE '%yoga class%'
    OR title ILIKE '%art workshop%'
    OR title ILIKE '%craft workshop%'
    OR title ILIKE '%woodworking class%'
    OR title ILIKE '%candle making%'
    OR title ILIKE '%flower arranging%'
    OR title ILIKE '%floral design%'
  );
