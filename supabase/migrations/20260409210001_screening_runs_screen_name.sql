-- Add screen_name to screening_runs for multi-screen venues (e.g. Starlight Drive-In)
ALTER TABLE screening_runs ADD COLUMN IF NOT EXISTS screen_name TEXT;
