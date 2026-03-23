-- Migration: Resanitize Html Descriptions
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.

-- Re-sanitize descriptions containing HTML tags.
-- sanitize_text() was added to the pipeline but these events predate it.

-- Strip HTML tags from descriptions
UPDATE events
SET
  description = trim(regexp_replace(
    regexp_replace(description, '<[^>]+>', ' ', 'g'),
    '\s+', ' ', 'g'
  )),
  updated_at = NOW()
WHERE description ~ '<[a-zA-Z/][^>]*>'
  AND is_active = true;

-- Clear descriptions that are identical to the title
UPDATE events
SET description = NULL, updated_at = NOW()
WHERE description IS NOT NULL
  AND lower(trim(description)) = lower(trim(title))
  AND is_active = true;
