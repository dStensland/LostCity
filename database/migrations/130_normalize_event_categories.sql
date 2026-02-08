-- Normalize non-canonical category values on future events
UPDATE events SET category = 'art'       WHERE category = 'arts'          AND start_date >= CURRENT_DATE;
UPDATE events SET category = 'community' WHERE category = 'cultural'      AND start_date >= CURRENT_DATE;
UPDATE events SET category = 'nightlife' WHERE category = 'haunted'       AND start_date >= CURRENT_DATE;
UPDATE events SET category = 'nightlife' WHERE category = 'eatertainment' AND start_date >= CURRENT_DATE;
UPDATE events SET category = 'family'    WHERE category = 'entertainment' AND start_date >= CURRENT_DATE;
UPDATE events SET category = 'food_drink'WHERE category = 'food'          AND start_date >= CURRENT_DATE;
UPDATE events SET category = 'fitness'   WHERE category = 'yoga'          AND start_date >= CURRENT_DATE;
UPDATE events SET category = 'learning'  WHERE category = 'cooking'       AND start_date >= CURRENT_DATE;
UPDATE events SET category = 'learning'  WHERE category = 'class'         AND start_date >= CURRENT_DATE;
