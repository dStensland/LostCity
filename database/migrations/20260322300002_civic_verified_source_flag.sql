-- Migration: Civic Verified Source Flag
--
-- Adds a civic_verified boolean to the sources table.
-- Sources flagged civic_verified = true are trusted civic sources whose events
-- always pass the CityPulse civic intent filter, regardless of tags.
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- No schema.sql update needed — sources table comment block tracks live semantics.

-- UP

ALTER TABLE sources ADD COLUMN IF NOT EXISTS civic_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- Mark known civic and nonprofit sources as verified
UPDATE sources SET civic_verified = true WHERE slug IN (
  -- Government / meetings
  'atlanta-city-meetings',
  'atlanta-city-planning',
  'marta-board',
  'marta-army',
  'atlanta-public-schools-board',
  'fulton-county-schools-board',
  'dekalb-county-schools-board',
  'cobb-county-schools-board',
  'gwinnett-county-schools-board',
  'clayton-county-schools-board',
  'cherokee-county-schools-board',
  'atlanta-city-council',
  'georgia-general-assembly',
  'georgia-ethics-commission',
  'cobb-county-schools-board',
  'cherokee-county-schools-board',

  -- Volunteer / nonprofit orgs
  'hands-on-atlanta',
  'united-way-atlanta',
  'atlanta-community-food-bank',
  'park-pride',
  'trees-atlanta',
  'keep-atlanta-beautiful',
  'lifeline-animal-project',
  'atlanta-humane-society',
  'furkids',
  'open-hand-atlanta',
  'concrete-jungle',
  'habitat-for-humanity-atlanta',
  'mobilize-us',

  -- Civic engagement / advocacy
  'fair-fight',
  'fair-count',
  'new-georgia-project',
  'common-cause-georgia',
  'lwv-atlanta',
  'atlanta-dsa',
  'aclu-georgia',
  'chattahoochee-riverkeeper',

  -- Youth / education nonprofits
  'everybody-wins-atlanta',
  'big-brothers-big-sisters-atl',
  'pebble-tossers',

  -- Social services
  'atlanta-mission',
  'hope-atlanta',
  'partnership-against-domestic-violence',
  'laamistad',
  'new-american-pathways',
  'atlanta-casa',
  'atlanta-victim-assistance',
  'canopy-atlanta',

  -- Civic aggregators
  'eventbrite-civic',
  'georgia-elections-calendar'
);

-- DOWN (rollback)
-- ALTER TABLE sources DROP COLUMN IF EXISTS civic_verified;
