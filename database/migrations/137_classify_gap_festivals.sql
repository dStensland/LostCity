-- Migration 137: Classify festivals from migration 136 (gap-fill batch)
--
-- Sets primary_type, experience_tags, audience, size_tier, indoor_outdoor, price_tier
-- for all new festivals added in 136_festival_gaps.sql.
--
-- Extends primary_type taxonomy with: comedy_festival, fashion_event,
-- wellness_festival, performing_arts_festival (supplements the list in migration 135).

-- Update comment to reflect expanded taxonomy
COMMENT ON COLUMN festivals.primary_type IS
  'Mutually exclusive classification: music_festival, food_festival, arts_festival, film_festival, cultural_festival, pop_culture_con, hobby_expo, tech_conference, athletic_event, holiday_spectacle, community_festival, fair, market, comedy_festival, fashion_event, wellness_festival, performing_arts_festival';

-- =============================================
-- COMEDY FESTIVALS
-- =============================================

UPDATE festivals SET
  primary_type = 'comedy_festival',
  experience_tags = '{live_music,nightlife}',
  audience = 'adults_only',
  size_tier = 'local',
  indoor_outdoor = 'indoor',
  price_tier = 'moderate'
WHERE slug = 'laughing-skull-comedy-fest';

UPDATE festivals SET
  primary_type = 'comedy_festival',
  experience_tags = '{nightlife}',
  audience = 'adults_only',
  size_tier = 'local',
  indoor_outdoor = 'indoor',
  price_tier = 'moderate'
WHERE slug = 'atlanta-comedy-festival';

UPDATE festivals SET
  primary_type = 'comedy_festival',
  experience_tags = '{workshops,nightlife}',
  audience = 'all_ages',
  size_tier = 'local',
  indoor_outdoor = 'indoor',
  price_tier = 'moderate'
WHERE slug = 'dads-garage-improv-fest';

UPDATE festivals SET
  primary_type = 'comedy_festival',
  experience_tags = '{workshops,nightlife}',
  audience = 'all_ages',
  size_tier = 'intimate',
  indoor_outdoor = 'indoor',
  price_tier = 'budget'
WHERE slug = 'whole-world-comedy-fest';

-- =============================================
-- FASHION EVENTS
-- =============================================

UPDATE festivals SET
  primary_type = 'fashion_event',
  experience_tags = '{shopping,nightlife}',
  audience = 'all_ages',
  size_tier = 'major',
  indoor_outdoor = 'indoor',
  price_tier = 'moderate'
WHERE slug = 'atlanta-fashion-week';

UPDATE festivals SET
  primary_type = 'fashion_event',
  experience_tags = '{art_exhibits}',
  audience = 'all_ages',
  size_tier = 'local',
  indoor_outdoor = 'indoor',
  price_tier = 'free'
WHERE slug = 'scad-fashwknd';

UPDATE festivals SET
  primary_type = 'fashion_event',
  experience_tags = '{shopping,speakers}',
  audience = 'industry',
  size_tier = 'mega',
  indoor_outdoor = 'indoor',
  price_tier = 'premium'
WHERE slug = 'atlanta-apparel-market';

-- =============================================
-- WELLNESS / YOGA
-- =============================================

UPDATE festivals SET
  primary_type = 'wellness_festival',
  experience_tags = '{outdoor,workshops}',
  audience = 'all_ages',
  size_tier = 'local',
  indoor_outdoor = 'outdoor',
  price_tier = 'moderate'
WHERE slug = 'atlanta-yoga-festival';

UPDATE festivals SET
  primary_type = 'wellness_festival',
  experience_tags = '{outdoor}',
  audience = 'all_ages',
  size_tier = 'local',
  indoor_outdoor = 'outdoor',
  price_tier = 'free'
WHERE slug = 'beltline-yoga-fest';

UPDATE festivals SET
  primary_type = 'wellness_festival',
  experience_tags = '{workshops,speakers,shopping}',
  audience = 'all_ages',
  size_tier = 'local',
  indoor_outdoor = 'indoor',
  price_tier = 'moderate'
WHERE slug = 'atlanta-wellness-festival';

-- =============================================
-- DANCE
-- =============================================

UPDATE festivals SET
  primary_type = 'performing_arts_festival',
  experience_tags = '{live_music,art_exhibits,nightlife}',
  audience = 'all_ages',
  size_tier = 'major',
  indoor_outdoor = 'both',
  price_tier = 'budget'
WHERE slug = 'atlanta-fringe-festival';

UPDATE festivals SET
  primary_type = 'cultural_festival',
  experience_tags = '{live_music,workshops,nightlife}',
  audience = 'adults_only',
  size_tier = 'local',
  indoor_outdoor = 'indoor',
  price_tier = 'moderate'
WHERE slug = 'atlanta-salsa-congress';

-- =============================================
-- MAJOR SPORTS EVENTS
-- =============================================

UPDATE festivals SET
  primary_type = 'athletic_event',
  experience_tags = '{outdoor}',
  audience = 'all_ages',
  size_tier = 'mega',
  indoor_outdoor = 'indoor',
  price_tier = 'premium'
WHERE slug = 'chick-fil-a-peach-bowl';

UPDATE festivals SET
  primary_type = 'athletic_event',
  experience_tags = '{outdoor}',
  audience = 'all_ages',
  size_tier = 'mega',
  indoor_outdoor = 'indoor',
  price_tier = 'premium'
WHERE slug = 'sec-championship-game';

UPDATE festivals SET
  primary_type = 'athletic_event',
  experience_tags = '{outdoor}',
  audience = 'all_ages',
  size_tier = 'mega',
  indoor_outdoor = 'indoor',
  price_tier = 'premium'
WHERE slug = 'chick-fil-a-kickoff-game';

UPDATE festivals SET
  primary_type = 'athletic_event',
  experience_tags = '{outdoor}',
  audience = 'all_ages',
  size_tier = 'major',
  indoor_outdoor = 'outdoor',
  price_tier = 'premium'
WHERE slug = 'tour-championship-pga';

UPDATE festivals SET
  primary_type = 'athletic_event',
  experience_tags = '{racing}',
  audience = 'all_ages',
  size_tier = 'mega',
  indoor_outdoor = 'indoor',
  price_tier = 'moderate'
WHERE slug = 'atlanta-supercross';

UPDATE festivals SET
  primary_type = 'athletic_event',
  experience_tags = '{racing,outdoor}',
  audience = 'all_ages',
  size_tier = 'mega',
  indoor_outdoor = 'outdoor',
  price_tier = 'moderate'
WHERE slug = 'nascar-atlanta';

UPDATE festivals SET
  primary_type = 'athletic_event',
  experience_tags = '{live_music,outdoor}',
  audience = 'all_ages',
  size_tier = 'mega',
  indoor_outdoor = 'indoor',
  price_tier = 'moderate'
WHERE slug = 'atlanta-united-season-opener';

UPDATE festivals SET
  primary_type = 'athletic_event',
  experience_tags = '{outdoor}',
  audience = 'all_ages',
  size_tier = 'mega',
  indoor_outdoor = 'outdoor',
  price_tier = 'moderate'
WHERE slug = 'atlanta-braves-opening-day';

UPDATE festivals SET
  primary_type = 'athletic_event',
  experience_tags = '{live_music}',
  audience = 'all_ages',
  size_tier = 'major',
  indoor_outdoor = 'indoor',
  price_tier = 'moderate'
WHERE slug = 'atlanta-hawks-home-opener';

UPDATE festivals SET
  primary_type = 'athletic_event',
  experience_tags = '{live_music,outdoor}',
  audience = 'all_ages',
  size_tier = 'mega',
  indoor_outdoor = 'indoor',
  price_tier = 'premium'
WHERE slug = 'college-football-playoff-natl';

-- =============================================
-- THEATER / PERFORMING ARTS FESTIVALS
-- =============================================

UPDATE festivals SET
  primary_type = 'performing_arts_festival',
  experience_tags = '{workshops,speakers}',
  audience = 'all_ages',
  size_tier = 'local',
  indoor_outdoor = 'indoor',
  price_tier = 'budget'
WHERE slug = 'essential-theatre-play-fest';

UPDATE festivals SET
  primary_type = 'performing_arts_festival',
  experience_tags = '{workshops,speakers}',
  audience = 'all_ages',
  size_tier = 'intimate',
  indoor_outdoor = 'indoor',
  price_tier = 'budget'
WHERE slug = 'horizon-new-south-fest';

UPDATE festivals SET
  primary_type = 'performing_arts_festival',
  experience_tags = '{workshops}',
  audience = 'all_ages',
  size_tier = 'intimate',
  indoor_outdoor = 'indoor',
  price_tier = 'free'
WHERE slug = 'alliance-collision-project';

UPDATE festivals SET
  primary_type = 'performing_arts_festival',
  experience_tags = '{nightlife}',
  audience = 'all_ages',
  size_tier = 'intimate',
  indoor_outdoor = 'indoor',
  price_tier = 'budget'
WHERE slug = 'atlanta-one-minute-play-fest';

-- =============================================
-- RESTAURANT / COCKTAIL WEEKS
-- =============================================

UPDATE festivals SET
  primary_type = 'food_festival',
  experience_tags = '{food_tasting}',
  audience = 'all_ages',
  size_tier = 'major',
  indoor_outdoor = 'indoor',
  price_tier = 'moderate'
WHERE slug = 'atlanta-restaurant-week';

UPDATE festivals SET
  primary_type = 'food_festival',
  experience_tags = '{food_tasting,nightlife}',
  audience = '21_plus',
  size_tier = 'local',
  indoor_outdoor = 'indoor',
  price_tier = 'moderate'
WHERE slug = 'atlanta-cocktail-week';

UPDATE festivals SET
  primary_type = 'food_festival',
  experience_tags = '{food_tasting,live_music,workshops,speakers}',
  audience = '21_plus',
  size_tier = 'major',
  indoor_outdoor = 'both',
  price_tier = 'premium'
WHERE slug = 'atlanta-wine-week';

-- =============================================
-- JULY 4TH & SEASONAL
-- =============================================

UPDATE festivals SET
  primary_type = 'holiday_spectacle',
  experience_tags = '{kids_activities,outdoor}',
  audience = 'family',
  size_tier = 'major',
  indoor_outdoor = 'outdoor',
  price_tier = 'free'
WHERE slug = 'lenox-july-4th-parade';

UPDATE festivals SET
  primary_type = 'holiday_spectacle',
  experience_tags = '{live_music,kids_activities,outdoor}',
  audience = 'family',
  size_tier = 'mega',
  indoor_outdoor = 'outdoor',
  price_tier = 'moderate'
WHERE slug = 'stone-mountain-fantastic-fourth';

UPDATE festivals SET
  primary_type = 'holiday_spectacle',
  experience_tags = '{live_music,kids_activities,outdoor}',
  audience = 'family',
  size_tier = 'major',
  indoor_outdoor = 'outdoor',
  price_tier = 'free'
WHERE slug = 'decatur-beach-party';

UPDATE festivals SET
  primary_type = 'holiday_spectacle',
  experience_tags = '{live_music,kids_activities,outdoor}',
  audience = 'family',
  size_tier = 'major',
  indoor_outdoor = 'outdoor',
  price_tier = 'free'
WHERE slug = 'centennial-park-july-4th';

UPDATE festivals SET
  primary_type = 'holiday_spectacle',
  experience_tags = '{kids_activities,outdoor}',
  audience = 'family',
  size_tier = 'local',
  indoor_outdoor = 'outdoor',
  price_tier = 'free'
WHERE slug = 'dunwoody-july-4th';

-- =============================================
-- ADDITIONAL SUBURBAN
-- =============================================

UPDATE festivals SET
  primary_type = 'community_festival',
  experience_tags = '{live_music,kids_activities,carnival_rides,outdoor}',
  audience = 'family',
  size_tier = 'local',
  indoor_outdoor = 'outdoor',
  price_tier = 'free'
WHERE slug = 'lilburn-daze';

UPDATE festivals SET
  primary_type = 'music_festival',
  experience_tags = '{live_music,outdoor,food_tasting}',
  audience = 'all_ages',
  size_tier = 'local',
  indoor_outdoor = 'outdoor',
  price_tier = 'free'
WHERE slug = 'woodstock-summer-concert-series';

UPDATE festivals SET
  primary_type = 'athletic_event',
  experience_tags = '{outdoor,cultural_heritage}',
  audience = 'all_ages',
  size_tier = 'local',
  indoor_outdoor = 'outdoor',
  price_tier = 'moderate'
WHERE slug = 'peachtree-city-dragon-boat';

UPDATE festivals SET
  primary_type = 'community_festival',
  experience_tags = '{live_music,kids_activities,carnival_rides,outdoor}',
  audience = 'family',
  size_tier = 'local',
  indoor_outdoor = 'outdoor',
  price_tier = 'free'
WHERE slug = 'milton-hometown-jubilee';

UPDATE festivals SET
  primary_type = 'community_festival',
  experience_tags = '{live_music,kids_activities,carnival_rides,outdoor}',
  audience = 'family',
  size_tier = 'local',
  indoor_outdoor = 'outdoor',
  price_tier = 'free'
WHERE slug = 'snellville-days';

UPDATE festivals SET
  primary_type = 'arts_festival',
  experience_tags = '{art_exhibits,live_music,outdoor}',
  audience = 'all_ages',
  size_tier = 'local',
  indoor_outdoor = 'outdoor',
  price_tier = 'free'
WHERE slug = 'johns-creek-arts-fest';
