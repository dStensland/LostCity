-- Migration: Edgewood Corridor Neighborhood Fix
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.

-- Standardize the Edgewood Ave SE corridor (337-600 block) to "Old Fourth Ward".
-- This is the historic bar corridor between Downtown and Inman Park.
-- Edgewood Ave NE (700+ block) is in Inman Park — leave those alone.

-- Phase 1: Standardize Edgewood Ave SE venues to Old Fourth Ward
UPDATE venues
SET neighborhood = 'Old Fourth Ward'
WHERE address ILIKE '%Edgewood Ave SE%'
  AND city = 'Atlanta'
  AND (neighborhood IS NULL OR neighborhood NOT IN ('Old Fourth Ward', 'Inman Park'));

-- Phase 2: Merge Sister Louisa's duplicates
-- Two slugs exist for the same venue at 466 Edgewood Ave SE:
--   - sister-louisas (from sister_louisas.py — produces Tarot + Karaoke)
--   - sister-louisas-church (from sister_louisas_church.py — produces Drag Bingo)
-- Keep sister-louisas as canonical. Reassign events from the church slug, then deactivate.

-- Reassign events from the duplicate venue to the canonical one
UPDATE events
SET venue_id = (SELECT id FROM venues WHERE slug = 'sister-louisas' LIMIT 1)
WHERE venue_id = (SELECT id FROM venues WHERE slug = 'sister-louisas-church' LIMIT 1)
  AND EXISTS (SELECT 1 FROM venues WHERE slug = 'sister-louisas')
  AND EXISTS (SELECT 1 FROM venues WHERE slug = 'sister-louisas-church');

-- Reassign venue_specials if any
UPDATE venue_specials
SET venue_id = (SELECT id FROM venues WHERE slug = 'sister-louisas' LIMIT 1)
WHERE venue_id = (SELECT id FROM venues WHERE slug = 'sister-louisas-church' LIMIT 1)
  AND EXISTS (SELECT 1 FROM venues WHERE slug = 'sister-louisas')
  AND EXISTS (SELECT 1 FROM venues WHERE slug = 'sister-louisas-church');

-- Reassign editorial_mentions if any
UPDATE editorial_mentions
SET venue_id = (SELECT id FROM venues WHERE slug = 'sister-louisas' LIMIT 1)
WHERE venue_id = (SELECT id FROM venues WHERE slug = 'sister-louisas-church' LIMIT 1)
  AND EXISTS (SELECT 1 FROM venues WHERE slug = 'sister-louisas')
  AND EXISTS (SELECT 1 FROM venues WHERE slug = 'sister-louisas-church');

-- Deactivate the duplicate venue
UPDATE venues
SET active = false
WHERE slug = 'sister-louisas-church'
  AND EXISTS (SELECT 1 FROM venues WHERE slug = 'sister-louisas');

-- Deactivate the duplicate source
UPDATE sources
SET is_active = false
WHERE slug = 'sister-louisas-church'
  AND EXISTS (SELECT 1 FROM sources WHERE slug = 'sister-louisas');
