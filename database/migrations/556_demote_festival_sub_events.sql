-- Demote festival sub-events from major → standard.
--
-- Festival sub-events (individual sessions, screenings, lobby swaps) were
-- auto-promoted to major because they had festival_id set. But these don't
-- independently warrant advance planning — the parent festival (already
-- flagship) represents them. "Toylanta Lobby Swap" and "Pen Show Door Prize
-- Giveaway" shouldn't compete with arena concerts for horizon slots.
--
-- Events with festival_id that are ALSO at tier 4-5 venues or have sellout_risk
-- will get re-promoted by the other criteria — this only affects sub-events
-- that qualified solely through festival membership.

-- Demote events that got major only via festival_id
UPDATE events
SET importance = 'standard'
WHERE importance = 'major'
  AND is_active = true
  AND festival_id IS NOT NULL;

-- Also demote events in festival series
UPDATE events e
SET importance = 'standard'
FROM series s
WHERE e.series_id = s.id
  AND s.festival_id IS NOT NULL
  AND e.importance = 'major'
  AND e.is_active = true;

-- Re-promote any that ALSO qualify via venue capacity (tier 5 non-sports, tier 4 music)
UPDATE events e
SET importance = 'major'
FROM venues v
WHERE e.venue_id = v.id
  AND v.capacity_tier >= 5
  AND e.importance = 'standard'
  AND e.is_active = true
  AND e.start_date >= CURRENT_DATE
  AND e.festival_id IS NOT NULL
  AND e.category_id IN ('music', 'theater', 'comedy', 'art', 'food_drink', 'family')
  AND e.is_class IS NOT TRUE;

UPDATE events e
SET importance = 'major'
FROM venues v
WHERE e.venue_id = v.id
  AND v.capacity_tier = 4
  AND e.importance = 'standard'
  AND e.is_active = true
  AND e.start_date >= CURRENT_DATE
  AND e.festival_id IS NOT NULL
  AND e.category_id = 'music'
  AND e.is_class IS NOT TRUE;

-- Re-promote any with sellout risk
UPDATE events
SET importance = 'major'
WHERE importance = 'standard'
  AND is_active = true
  AND start_date >= CURRENT_DATE
  AND festival_id IS NOT NULL
  AND sellout_risk IN ('medium', 'high');
