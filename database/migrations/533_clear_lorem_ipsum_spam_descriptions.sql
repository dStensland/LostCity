-- Migration 533: Clear lorem ipsum placeholder and domain-parking spam from venue descriptions
-- Sets description/short_description to NULL for venues with clearly fake content.
-- Never deletes venues — only clears the bad text.

-- Clear lorem ipsum placeholder text
UPDATE venues
SET
  description = NULL,
  short_description = NULL
WHERE
  active = true
  AND (
    description ILIKE '%lorem ipsum%'
    OR description ILIKE '%aenean%'
    OR description ILIKE '%suspendisse potenti%'
    OR short_description ILIKE '%lorem ipsum%'
    OR short_description ILIKE '%aenean%'
    OR short_description ILIKE '%suspendisse potenti%'
  );

-- Clear domain-parking / SEO spam text
UPDATE venues
SET
  description = NULL,
  short_description = NULL
WHERE
  active = true
  AND (
    description ILIKE '%this website is for sale%'
    OR description ILIKE '%is your first and best source for%'
    OR short_description ILIKE '%this website is for sale%'
    OR short_description ILIKE '%is your first and best source for%'
  );

-- DOWN: no restore — this content has no value
