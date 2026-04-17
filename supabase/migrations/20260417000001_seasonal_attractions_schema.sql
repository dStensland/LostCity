-- Migration: seasonal attractions schema
-- Adds season-carrier hooks to exhibitions + series, and seasonal-only flag to places.
-- Keep this file mirrored in database/migrations and supabase/migrations.

BEGIN;

-- 1. series.exhibition_id — nullable FK for recurring rituals scoped to a seasonal exhibition.
ALTER TABLE series
  ADD COLUMN IF NOT EXISTS exhibition_id UUID REFERENCES exhibitions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_series_exhibition_id
  ON series(exhibition_id)
  WHERE exhibition_id IS NOT NULL;

-- 2. exhibitions.operating_schedule — JSONB per-day operating hours during the exhibition window.
-- Shape:
--   {
--     "default_hours": {"open": "17:30", "close": "21:30"},
--     "days": {"friday": {"open": "17:30", "close": "22:00"}, ...},
--     "overrides": {"2025-12-24": {"open": "17:30", "close": "20:00"}, "2025-12-25": null}
--   }
ALTER TABLE exhibitions
  ADD COLUMN IF NOT EXISTS operating_schedule JSONB;

-- 3. places.is_seasonal_only — true when the place exists ONLY as the seasonal attraction.
-- Used by search_unified() to scope off-season event suppression (Shape F persistent
-- places with seasonal overlays must remain unaffected).
ALTER TABLE places
  ADD COLUMN IF NOT EXISTS is_seasonal_only BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_places_is_seasonal_only
  ON places(is_seasonal_only)
  WHERE is_seasonal_only = true;

COMMIT;
