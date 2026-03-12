-- Migration: Add 'dancing' to venue_occasions CHECK constraint
--
-- Keep this file mirrored in database/migrations and supabase/migrations.

-- Drop and recreate the CHECK constraint to add 'dancing'
ALTER TABLE venue_occasions DROP CONSTRAINT IF EXISTS venue_occasions_occasion_check;

ALTER TABLE venue_occasions ADD CONSTRAINT venue_occasions_occasion_check CHECK (
  occasion IN (
    'date_night',
    'groups',
    'solo',
    'outdoor_dining',
    'late_night',
    'quick_bite',
    'special_occasion',
    'beltline',
    'pre_game',
    'brunch',
    'family_friendly',
    'dog_friendly',
    'live_music',
    'dancing'
  )
);
