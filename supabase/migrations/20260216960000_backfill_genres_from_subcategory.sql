-- Backfill genres[] and tags[] from the legacy subcategory column.
-- Targets: 2,630 events that have subcategory but empty/null genres.
-- Does NOT drop the subcategory column — left as historical data.

BEGIN;

-- ============================================================
-- 1. Genre-type subcategories → append to genres[]
--    These represent artistic disciplines / activity types.
-- ============================================================
UPDATE events
SET genres = COALESCE(genres, '{}') || ARRAY[
  CASE
    -- Strip dotted prefix to get the genre value
    -- music.*
    WHEN subcategory = 'music.live' THEN 'live'
    WHEN subcategory = 'music.live.rock' THEN 'rock'
    WHEN subcategory = 'music.live.hiphop' THEN 'hiphop'
    WHEN subcategory = 'music.live.electronic' THEN 'electronic'
    WHEN subcategory = 'music.live.jazz' THEN 'jazz'
    WHEN subcategory = 'music.live.country' THEN 'country'
    WHEN subcategory = 'music.live.metal' THEN 'metal'
    WHEN subcategory = 'music.classical' THEN 'classical'
    WHEN subcategory = 'music.openmic' THEN 'open_mic'
    -- comedy.*
    WHEN subcategory = 'comedy.standup' THEN 'standup'
    WHEN subcategory = 'comedy.improv' THEN 'improv'
    WHEN subcategory = 'comedy.openmic' THEN 'open_mic'
    -- theater.*
    WHEN subcategory = 'theater.play' THEN 'play'
    WHEN subcategory = 'theater.musical' THEN 'musical'
    WHEN subcategory = 'theater.dance' THEN 'dance'
    WHEN subcategory = 'theater.opera' THEN 'opera'
    -- film.*
    WHEN subcategory = 'film.new' THEN 'new_release'
    WHEN subcategory = 'film.repertory' THEN 'repertory'
    WHEN subcategory = 'film.documentary' THEN 'documentary'
    WHEN subcategory = 'film.festival' THEN 'film_festival'
    -- museums.*
    WHEN subcategory = 'museums.art' THEN 'art'
    WHEN subcategory = 'museums.history' THEN 'history'
    WHEN subcategory = 'museums.science' THEN 'science'
    WHEN subcategory = 'museums.children' THEN 'children'
    WHEN subcategory = 'museums.cultural' THEN 'cultural'
    WHEN subcategory = 'museums.exhibition' THEN 'exhibition'
    -- nightlife.*
    WHEN subcategory = 'nightlife.dj' THEN 'dj'
    WHEN subcategory = 'nightlife.drag' THEN 'drag'
    WHEN subcategory = 'nightlife.trivia' THEN 'trivia'
    WHEN subcategory = 'nightlife.karaoke' THEN 'karaoke'
    WHEN subcategory = 'nightlife.bar_games' THEN 'bar_games'
    WHEN subcategory = 'nightlife.poker' THEN 'poker'
    WHEN subcategory = 'nightlife.party' THEN 'party'
    WHEN subcategory = 'nightlife.bingo' THEN 'bingo'
    WHEN subcategory = 'nightlife.pub_crawl' THEN 'pub_crawl'
    WHEN subcategory = 'nightlife.specials' THEN 'specials'
    WHEN subcategory = 'nightlife.latin_night' THEN 'latin_night'
    WHEN subcategory = 'nightlife.line_dancing' THEN 'line_dancing'
    WHEN subcategory = 'nightlife.strip' THEN 'strip'
    WHEN subcategory = 'nightlife.burlesque' THEN 'burlesque'
    WHEN subcategory = 'nightlife.lifestyle' THEN 'lifestyle'
    WHEN subcategory = 'nightlife.revue' THEN 'revue'
    -- words.*
    WHEN subcategory = 'words.reading' THEN 'reading'
    WHEN subcategory = 'words.bookclub' THEN 'book_club'
    WHEN subcategory = 'words.poetry' THEN 'poetry'
    WHEN subcategory = 'words.storytelling' THEN 'storytelling'
    WHEN subcategory = 'words.workshop' THEN 'workshop'
    WHEN subcategory = 'words.lecture' THEN 'lecture'
    -- meetup.*
    WHEN subcategory = 'meetup.tech' THEN 'tech'
    WHEN subcategory = 'meetup.professional' THEN 'professional'
    WHEN subcategory = 'meetup.social' THEN 'social'
    WHEN subcategory = 'meetup.hobbies' THEN 'hobbies'
    WHEN subcategory = 'meetup.outdoors' THEN 'outdoors'
    WHEN subcategory = 'meetup.learning' THEN 'learning'
    WHEN subcategory = 'meetup.health' THEN 'health'
    WHEN subcategory = 'meetup.creative' THEN 'creative'
    WHEN subcategory = 'meetup.sports' THEN 'sports'
    WHEN subcategory = 'meetup.food' THEN 'food'
    WHEN subcategory = 'meetup.parents' THEN 'parents'
    WHEN subcategory = 'meetup.lgbtq' THEN 'lgbtq'
    -- community.*
    WHEN subcategory = 'community.volunteer' THEN 'volunteer'
    WHEN subcategory = 'community.meetup' THEN 'meetup'
    WHEN subcategory = 'community.networking' THEN 'networking'
    WHEN subcategory = 'community.lgbtq' THEN 'lgbtq'
    -- fitness.*
    WHEN subcategory = 'fitness.yoga' THEN 'yoga'
    WHEN subcategory = 'fitness.run' THEN 'running'
    WHEN subcategory = 'fitness.cycling' THEN 'cycling'
    WHEN subcategory = 'fitness.dance' THEN 'dance'
    WHEN subcategory = 'fitness.hike' THEN 'hiking'
    WHEN subcategory = 'fitness.class' THEN 'fitness_class'
    -- learning.*
    WHEN subcategory = 'learning.workshop' THEN 'workshop'
    WHEN subcategory = 'learning.class' THEN 'class'
    WHEN subcategory = 'learning.lecture' THEN 'lecture'
    WHEN subcategory = 'learning.seminar' THEN 'seminar'
    WHEN subcategory = 'learning.museum' THEN 'museum'
    -- Simple non-dotted values (used directly as genre)
    WHEN subcategory = 'concert' THEN 'concert'
    WHEN subcategory = 'rock' THEN 'rock'
    WHEN subcategory = 'jazz' THEN 'jazz'
    WHEN subcategory = 'blues' THEN 'blues'
    WHEN subcategory = 'hip-hop' THEN 'hiphop'
    WHEN subcategory = 'r&b' THEN 'rnb'
    WHEN subcategory = 'electronic' THEN 'electronic'
    WHEN subcategory = 'country' THEN 'country'
    WHEN subcategory = 'folk' THEN 'folk'
    WHEN subcategory = 'metal' THEN 'metal'
    WHEN subcategory = 'punk' THEN 'punk'
    WHEN subcategory = 'classical' THEN 'classical'
    WHEN subcategory = 'opera' THEN 'opera'
    WHEN subcategory = 'exhibition' THEN 'exhibition'
    WHEN subcategory = 'standup' THEN 'standup'
    WHEN subcategory = 'improv' THEN 'improv'
    WHEN subcategory = 'open_mic' THEN 'open_mic'
    WHEN subcategory = 'karaoke' THEN 'karaoke'
    WHEN subcategory = 'trivia' THEN 'trivia'
    WHEN subcategory = 'drag' THEN 'drag'
    WHEN subcategory = 'dj' THEN 'dj'
    WHEN subcategory = 'documentary' THEN 'documentary'
    WHEN subcategory = 'yoga' THEN 'yoga'
    WHEN subcategory = 'dance' THEN 'dance'
    WHEN subcategory = 'workshop' THEN 'workshop'
    WHEN subcategory = 'lecture' THEN 'lecture'
    WHEN subcategory = 'volunteer' THEN 'volunteer'
    ELSE NULL
  END
]
WHERE subcategory IS NOT NULL
  AND (genres IS NULL OR genres = '{}')
  -- Only backfill rows where the CASE actually produces a non-null value
  AND subcategory IN (
    'music.live', 'music.live.rock', 'music.live.hiphop', 'music.live.electronic',
    'music.live.jazz', 'music.live.country', 'music.live.metal', 'music.classical',
    'music.openmic',
    'comedy.standup', 'comedy.improv', 'comedy.openmic',
    'theater.play', 'theater.musical', 'theater.dance', 'theater.opera',
    'film.new', 'film.repertory', 'film.documentary', 'film.festival',
    'museums.art', 'museums.history', 'museums.science', 'museums.children',
    'museums.cultural', 'museums.exhibition',
    'nightlife.dj', 'nightlife.drag', 'nightlife.trivia', 'nightlife.karaoke',
    'nightlife.bar_games', 'nightlife.poker', 'nightlife.party', 'nightlife.bingo',
    'nightlife.pub_crawl', 'nightlife.specials', 'nightlife.latin_night',
    'nightlife.line_dancing', 'nightlife.strip', 'nightlife.burlesque',
    'nightlife.lifestyle', 'nightlife.revue',
    'words.reading', 'words.bookclub', 'words.poetry', 'words.storytelling',
    'words.workshop', 'words.lecture',
    'meetup.tech', 'meetup.professional', 'meetup.social', 'meetup.hobbies',
    'meetup.outdoors', 'meetup.learning', 'meetup.health', 'meetup.creative',
    'meetup.sports', 'meetup.food', 'meetup.parents', 'meetup.lgbtq',
    'community.volunteer', 'community.meetup', 'community.networking', 'community.lgbtq',
    'fitness.yoga', 'fitness.run', 'fitness.cycling', 'fitness.dance',
    'fitness.hike', 'fitness.class',
    'learning.workshop', 'learning.class', 'learning.lecture', 'learning.seminar',
    'learning.museum',
    'concert', 'rock', 'jazz', 'blues', 'hip-hop', 'r&b', 'electronic',
    'country', 'folk', 'metal', 'punk', 'classical', 'opera',
    'exhibition', 'standup', 'improv', 'open_mic', 'karaoke', 'trivia',
    'drag', 'dj', 'documentary', 'yoga', 'dance', 'workshop', 'lecture', 'volunteer'
  );

-- ============================================================
-- 2. Tag-type subcategories → append to tags[]
--    These are format/audience metadata, not genres.
-- ============================================================
UPDATE events
SET tags = COALESCE(tags, '{}') || ARRAY[subcategory]
WHERE subcategory IS NOT NULL
  AND (genres IS NULL OR genres = '{}')
  AND subcategory IN (
    'sightseeing', 'gaming', 'cinema', 'museum', 'networking',
    'convention', 'fundraiser', 'gala', 'class', 'seminar',
    'conference', 'panel', 'screening', 'tasting', 'tour',
    'retreat', 'festival', 'market', 'fair', 'parade',
    'ceremony', 'celebration', 'competition', 'tournament'
  )
  -- Don't double-add if already in tags
  AND NOT (tags @> ARRAY[subcategory]);

-- ============================================================
-- 3. Exhibition special case: ensure 'exhibition' is in genres
--    for ALL events with category='art' or category='museums'
--    that have subcategory containing 'exhibition'
-- ============================================================
UPDATE events
SET genres = COALESCE(genres, '{}') || ARRAY['exhibition']
WHERE subcategory ILIKE '%exhibition%'
  AND NOT (COALESCE(genres, '{}') @> ARRAY['exhibition']);

COMMIT;
