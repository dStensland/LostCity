-- Migration 153: Add Oddities & Curiosities Expo as a festival
--
-- Two-day traveling expo of oddities, curiosities, taxidermy, macabre art,
-- and handcrafted items. Annual stop at Atlanta Convention Center at AmericasMart.
-- Feb 21-22, 2026. ~20,000 expected attendees. Organized by odditiesandcuriositiesexpo.com.
--
-- Also links the existing Oddities Museum producer/source as an associated entity.

BEGIN;

-- 1. Insert festival record
INSERT INTO festivals (
  id, slug, name, website, typical_month, typical_duration_days,
  location, neighborhood, categories, free, festival_type,
  description, ticket_url, image_url,
  announced_2026, announced_start, announced_end,
  primary_type, experience_tags, audience, size_tier, indoor_outdoor, price_tier
) VALUES (
  'oddities-curiosities-expo',
  'oddities-curiosities-expo',
  'Oddities & Curiosities Expo',
  'https://odditiesandcuriositiesexpo.com',
  2,
  2,
  'Atlanta Convention Center at AmericasMart',
  'Downtown',
  '{art,markets,community}',
  false,
  'convention',
  'Annual traveling expo celebrating the strange, unusual, and bizarre. Over 100 vendors showcase taxidermy, macabre art, oddities, vintage curiosities, handcrafted jewelry, and home decor. Features educational classes, live demonstrations, and a vibrant marketplace. Part of a 40-city tour across the US and Canada.',
  'https://www.showpass.com/atlanta-oddities-curiosities-expo-2026/',
  NULL,
  true,
  '2026-02-21',
  '2026-02-22',
  'hobby_expo',
  '{shopping,art_exhibits,workshops,cultural_heritage}',
  'all_ages',
  'major',
  'indoor',
  'budget'
)
ON CONFLICT (id) DO UPDATE SET
  website = EXCLUDED.website,
  announced_2026 = EXCLUDED.announced_2026,
  announced_start = EXCLUDED.announced_start,
  announced_end = EXCLUDED.announced_end,
  ticket_url = EXCLUDED.ticket_url,
  description = EXCLUDED.description,
  primary_type = EXCLUDED.primary_type,
  experience_tags = EXCLUDED.experience_tags,
  audience = EXCLUDED.audience,
  size_tier = EXCLUDED.size_tier,
  indoor_outdoor = EXCLUDED.indoor_outdoor,
  price_tier = EXCLUDED.price_tier;

COMMIT;
